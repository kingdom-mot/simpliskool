"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { setFlash } from "@/lib/flash";
import { z } from "zod";
import { requireSchool, type Role } from "@/lib/auth";
import type { ActionState } from "@/components/forms";
import { normalizeEmail, normalizePhone } from "@/lib/people";
import { createAdminClient } from "@/lib/supabase/admin";
import { listBanks, paystackReady, paystackTestMode, resolveAccount, upsertSubaccount } from "@/lib/paystack";
import { SCHOOL_PALETTE } from "@/lib/theme";
import { teamEmail } from "@/lib/platform-mail";
import { isDemoRequest } from "@/lib/demo";

/** Only the school owner changes settings (same rule as the design). */
const SETTINGS_ROLES: Role[] = ["owner"];
const BUCKET = "school-logos";
const MAX_LOGO = 1024 * 1024;

function refresh() {
  // Colours and logo show on every page of the school.
  revalidatePath("/", "layout");
}

const profileSchema = z.object({
  name: z.string().trim().min(3, "Enter the school's full name").max(120, "The name is too long"),
  motto: z.string().trim().max(120, "Keep the motto under 120 characters"),
  email: z.string().trim(),
  phone: z.string().trim(),
  address: z.string().trim().max(300, "The address is too long"),
  principal_name: z.string().trim().max(120, "The name is too long"),
  about: z.string().trim().max(2000, "Keep the introduction under 2,000 characters"),
});

export async function saveProfile(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, school } = await requireSchool(SETTINGS_ROLES);
  const parsed = profileSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const email = d.email ? normalizeEmail(d.email) : null;
  if (d.email && !email) return { error: "That email doesn't look right." };
  // Keep the phone as typed (schools like "0803 123 4567"), but check it's a real number.
  if (d.phone && !normalizePhone(d.phone)) return { error: "That phone number doesn't look right. Use 11 digits, like 08031234567." };

  const { error } = await supabase
    .from("schools")
    .update({ name: d.name, motto: d.motto || null, email, phone: d.phone || null, address: d.address || null, principal_name: d.principal_name || null, about: d.about || null })
    .eq("id", school.id);
  if (error) return { error: "We couldn't save the details. Please try again." };
  refresh();
  return { ok: true, message: "School details saved.", at: Date.now() };
}

const allowed = new Set<string>(SCHOOL_PALETTE.map((c) => c.hex));

export async function saveColours(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, school } = await requireSchool(SETTINGS_ROLES);
  const picked = fd
    .getAll("colour")
    .map((c) => String(c).toUpperCase())
    .filter(Boolean);
  if (picked.length > 2) return { error: "Choose at most 2 colours." };
  if (picked.some((c) => !allowed.has(c))) return { error: "Choose colours from the palette." };
  if (picked.length === 2 && picked[0] === picked[1]) return { error: "Choose two different colours." };
  const { error } = await supabase
    .from("schools")
    .update({ primary_color: picked[0] ?? null, secondary_color: picked[1] ?? null })
    .eq("id", school.id);
  if (error) return { error: "We couldn't save the colours. Please try again." };
  refresh();
  const names = picked.map((h) => SCHOOL_PALETTE.find((c) => c.hex === h)!.name);
  return { ok: true, message: names.length ? `Colours saved: ${names.join(" and ")}.` : "Saved. Your school uses the Simpliskool colours.", at: Date.now() };
}

/** Works out the real image type from the file's first bytes (not its name). */
function sniff(buf: Uint8Array): { type: string; ext: string } | null {
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return { type: "image/png", ext: "png" };
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { type: "image/jpeg", ext: "jpg" };
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return { type: "image/webp", ext: "webp" };
  return null;
}

function ourPath(url: string | null, schoolId: string) {
  if (!url) return null;
  const m = url.match(new RegExp(`/storage/v1/object/public/${BUCKET}/(${schoolId}/[^?]+)`));
  return m ? m[1] : null;
}

export async function uploadLogo(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, school } = await requireSchool(SETTINGS_ROLES);
  const file = fd.get("logo");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a logo file first." };
  if (file.size > MAX_LOGO) return { error: "That file is bigger than 1 MB. Save a smaller version and try again." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniff(bytes);
  if (!kind) return { error: "Use a PNG, JPG or WebP picture." };

  const admin = createAdminClient();
  const path = `${school.id}/logo-${Date.now()}.${kind.ext}`;
  const { error: upErr } = await admin.storage.from(BUCKET).upload(path, bytes, { contentType: kind.type, cacheControl: "31536000", upsert: false });
  if (upErr) return { error: /bucket/i.test(upErr.message) ? "Logo storage isn't set up yet. Run 0009_school_settings.sql in Supabase." : "We couldn't upload the logo. Please try again." };
  const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);

  const old = ourPath(school.logo_url, school.id);
  const { error } = await supabase.from("schools").update({ logo_url: pub.publicUrl }).eq("id", school.id);
  if (error) {
    await admin.storage.from(BUCKET).remove([path]);
    return { error: "We couldn't save the logo. Please try again." };
  }
  if (old) await admin.storage.from(BUCKET).remove([old]);
  refresh();
  return { ok: true, message: "Logo uploaded.", at: Date.now() };
}

export async function removeLogo(): Promise<ActionState> {
  const { supabase, school } = await requireSchool(SETTINGS_ROLES);
  const old = ourPath(school.logo_url, school.id);
  const { error } = await supabase.from("schools").update({ logo_url: null }).eq("id", school.id);
  if (error) return { error: "We couldn't remove the logo. Please try again." };
  if (old) await createAdminClient().storage.from(BUCKET).remove([old]);
  refresh();
  return { ok: true, message: "Logo removed. Your school's initials show instead.", at: Date.now() };
}

const partSchema = z.object({ key: z.enum(["ca1", "ca2", "ca3", "exam"]), label: z.string().trim().min(1, "Give each part a short name").max(20, "Keep part names under 20 letters"), max: z.number().positive().max(100) });

export async function saveAssessment(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, school } = await requireSchool(SETTINGS_ROLES);
  let raw: unknown;
  try {
    raw = JSON.parse(String(fd.get("parts") ?? "[]"));
  } catch {
    return { error: "Something went wrong. Refresh the page and try again." };
  }
  const p = z.array(partSchema).min(1).max(4).safeParse(raw);
  if (!p.success) return { error: p.error.issues[0].message };
  const sum = p.data.reduce((a, x) => a + x.max, 0);
  if (Math.abs(sum - 100) > 0.001) return { error: `The parts add up to ${sum}. They must add up to 100.` };
  const { error } = await supabase.rpc("set_assessment", { p_school: school.id, p_parts: p.data });
  if (error) {
    const m = error.message.match(/don't fit \((\d+) scores\)/);
    if (m) return { error: `${m[1]} score${m[1] === "1" ? "" : "s"} already entered this term would no longer fit. Change the split before scores are entered, or at the start of a new term.` };
    return { error: "We couldn't save the mark split. Please try again." };
  }
  revalidatePath("/", "layout");
  return { ok: true, message: `Saved: ${p.data.map((x) => `${x.label} ${x.max}`).join(" + ")} = 100. Score sheets and report cards now use this split.`, at: Date.now() };
}

export async function saveGradingScale(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, school } = await requireSchool(SETTINGS_ROLES);
  let rows: { grade: string; min: number; remark: string }[];
  try {
    rows = JSON.parse(String(fd.get("rows") ?? "[]"));
  } catch {
    return { error: "Something went wrong. Refresh the page and try again." };
  }
  if (!Array.isArray(rows) || rows.length < 2 || rows.length > 12) return { error: "Use between 2 and 12 grades." };
  const clean = rows.map((r) => ({ grade: String(r.grade ?? "").trim().slice(0, 3), min: Number(r.min), remark: String(r.remark ?? "").trim().slice(0, 40) }));
  if (clean.some((r) => !r.grade)) return { error: "Give every grade a letter, like A." };
  if (clean.some((r) => !Number.isFinite(r.min) || r.min < 0 || r.min > 100)) return { error: "Minimum marks must be between 0 and 100." };
  clean.sort((a, b) => b.min - a.min);
  if (new Set(clean.map((r) => r.min)).size !== clean.length) return { error: "Two grades can't start at the same mark." };
  if (clean[clean.length - 1].min !== 0) return { error: "The lowest grade must start at 0." };
  if (new Set(clean.map((r) => r.grade.toUpperCase())).size !== clean.length) return { error: "Each grade needs a different letter." };
  const { error } = await supabase.rpc("set_grading_scale", { p_school: school.id, p_rows: clean });
  if (error) return { error: "We couldn't save the grading scale." };
  revalidatePath("/", "layout");
  return { ok: true, message: `Grading scale saved: ${clean.map((r) => `${r.grade} from ${r.min}`).join(", ")}. Report cards use it straight away.`, at: Date.now() };
}

export async function savePayout(_prev: ActionState, fd: FormData): Promise<ActionState> {
  if (await isDemoRequest()) return { error: "Payout accounts can't be changed in the demo." };
  const { supabase, school, user } = await requireSchool(SETTINGS_ROLES);
  const acct = String(fd.get("account_no") ?? "").replace(/\s/g, "");
  const typedName = String(fd.get("account_name") ?? "").trim();
  if (!/^\d{10}$/.test(acct)) return { error: "Account numbers have 10 digits." };

  // Without Paystack, just keep the details for later.
  if (!paystackReady()) {
    const bank = String(fd.get("bank_name") ?? "").trim();
    if (bank.length < 2) return { error: "Choose the bank." };
    if (typedName.length < 2) return { error: "Enter the account name exactly as the bank has it." };
    const { error } = await supabase.from("school_payouts").upsert({ school_id: school.id, bank_name: bank.slice(0, 60), account_no: acct, account_name: typedName.slice(0, 120), verified_at: null, updated_by: user.id, updated_at: new Date().toISOString() }, { onConflict: "school_id" });
    if (error) return { error: "We couldn't save the account." };
    revalidatePath("/admin/settings");
    return { ok: true, message: "Payout account saved. It will be checked with the bank when online payments are switched on.", at: Date.now() };
  }

  const code = String(fd.get("bank_code") ?? "").trim();
  const bank = (await listBanks()).find((b) => b.code === code);
  if (!bank) return { error: "Choose the bank from the list." };
  const found = await resolveAccount(acct, code);
  let name = found.ok ? found.data.account_name : null;
  if (!name) {
    // Paystack's test mode can only look up a few accounts; let the owner type the name while testing.
    if (paystackTestMode() && typedName.length >= 2) name = typedName;
    else return { error: `${bank.name} couldn't find account ${acct}. Check the number and the bank.` };
  }
  const { data: cur } = await supabase.from("school_payouts").select("paystack_subaccount").eq("school_id", school.id).maybeSingle<{ paystack_subaccount: string | null }>();
  const { data: sch } = await supabase.from("schools").select("name, email").eq("id", school.id).single<{ name: string; email: string | null }>();
  const sub = await upsertSubaccount({ existing: cur?.paystack_subaccount ?? null, schoolName: sch?.name ?? school.name, bankCode: code, accountNo: acct, email: sch?.email ?? null });
  if (!sub.ok) return { error: `Paystack couldn't set up the account: ${sub.error}` };
  const { error } = await supabase.from("school_payouts").upsert(
    { school_id: school.id, bank_name: bank.name.slice(0, 60), bank_code: code, account_no: acct, account_name: name.slice(0, 120), verified_at: found.ok ? new Date().toISOString() : null, paystack_subaccount: sub.code, updated_by: user.id, updated_at: new Date().toISOString() },
    { onConflict: "school_id" },
  );
  if (error) return { error: /column/i.test(error.message) ? "Run database file 0014_payments_sms_schedule.sql in Supabase first." : "We couldn't save the account." };
  revalidatePath("/admin/settings");
  const { data: chk } = await supabase.from("schools").select("payments_approved_at").eq("id", school.id).maybeSingle<{ payments_approved_at: string | null }>();
  if (chk && !chk.payments_approved_at) {
    const inbox = process.env.SUPPORT_EMAIL;
    if (inbox) await teamEmail(inbox, `Payout account to check: ${school.name}`, `${school.name} added a payout account`, [`${name}, ${bank.name} ••${acct.slice(-4)}. Check it before parents can pay online.`], { label: "Open new school checks", path: `/super/checks?sel=${school.id}` });
    return { ok: true, message: `Saved: ${name}, ${bank.name}. Simpliskool checks new accounts (usually within a working day); parents can pay online as soon as it's done.`, at: Date.now() };
  }
  return { ok: true, message: `Saved: ${name}, ${bank.name}. Online payment is on, so parents see a "Pay online" button on their fees page.`, at: Date.now() };
}

export async function pauseOnlinePayments(): Promise<ActionState> {
  if (await isDemoRequest()) return { error: "Not available in the demo." };
  const { supabase, school } = await requireSchool(SETTINGS_ROLES);
  const { error } = await supabase.from("school_payouts").update({ paystack_subaccount: null, updated_at: new Date().toISOString() }).eq("school_id", school.id);
  if (error) return { error: "We couldn't switch online payment off." };
  revalidatePath("/admin/settings");
  // The button disappears once it's off, so the confirmation is shown on the page.
  await setFlash("Online payment is off. Parents now see your pay-the-school instructions only. Save the account again to switch it back on.", "/admin/settings");
  redirect("/admin/settings#payouts");
}

export async function saveSms(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, school } = await requireSchool(SETTINGS_ROLES);
  const on = (k: string) => fd.get(k) === "1";
  const row = { sms_enabled: on("sms_enabled"), sms_absence: on("sms_absence"), sms_fees: on("sms_fees"), sms_receipts: on("sms_receipts") };
  const { error } = await supabase.from("schools").update(row).eq("id", school.id);
  if (error) return { error: /column/i.test(error.message) ? "Run database file 0014_payments_sms_schedule.sql in Supabase first." : "We couldn't save the SMS settings." };
  revalidatePath("/admin/settings");
  if (!row.sms_enabled) return { ok: true, message: "SMS is off. Parents get emails and app messages only.", at: Date.now() };
  const uses = [row.sms_absence && "absences", row.sms_fees && "fee reminders", row.sms_receipts && "payment receipts"].filter(Boolean) as string[];
  return { ok: true, message: `SMS is on${uses.length ? ` for ${uses.join(", ").replace(/, ([^,]*)$/, " and $1")}` : ""}. You can also text announcements when you send them.`, at: Date.now() };
}

/** The owner asks for their own SMS sender name; Simpliskool sends it to the SMS provider. */
export async function requestSenderName(_prev: ActionState, fd: FormData): Promise<ActionState> {
  if (await isDemoRequest()) return { error: "Sender names can't be requested from the demo." };
  const { supabase, school } = await requireSchool(["owner"]);
  const v = String(fd.get("sender_id") ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9 ]{3,11}$/.test(v)) return { error: "Use 3 to 11 letters or numbers, like GREENFIELD." };
  const { error } = await supabase.rpc("request_sender", { p_school: school.id, p_sender: v });
  if (error) return { error: /function/i.test(error.message) ? "This isn't switched on yet." : error.code === "P0001" ? error.message : "We couldn't send the request." };
  revalidatePath("/admin/settings");
  return { ok: true, message: `${v} sent to Simpliskool. The networks usually approve a name in a few days.`, at: Date.now() };
}
