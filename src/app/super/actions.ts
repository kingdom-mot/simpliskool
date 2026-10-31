"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/components/forms";
import { setFlash } from "@/lib/flash";
import { findOrCreateUser, normalizeEmail, normalizePhone } from "@/lib/people";
import { addDisputeEvidence, refundTransaction } from "@/lib/paystack";
import { logPlatform, requirePlatform, TEAM_ROLES, type Ability, type PlatformCtx, type TeamRole } from "@/lib/platform";
import { schoolEmails, teamEmail } from "@/lib/platform-mail";
import { DEFAULT_SETTINGS, FEATURES, getSettings, type FeatureKey, type PlatformSettings } from "@/lib/platform-settings";
import { requestSenderId } from "@/lib/sms";
import { VIEW_COOKIE } from "@/lib/viewing";

const uuid = z.string().uuid();
const NO = { error: "Your role can't do this. Ask a super admin." };
const str = (fd: FormData, k: string, max = 500) => String(fd.get(k) ?? "").trim().slice(0, max);

async function allowed(page: string, a: Ability): Promise<PlatformCtx | null> {
  const ctx = await requirePlatform(page);
  return ctx.can(a) ? ctx : null;
}
async function schoolName(ctx: PlatformCtx, id: string) {
  const { data } = await ctx.admin.from("schools").select("name").eq("id", id).maybeSingle<{ name: string }>();
  return data?.name ?? null;
}
const done = (message: string): ActionState => ({ ok: true, message, at: Date.now() });

// ===========================================================================
// Schools
// ===========================================================================

/** Signs a school up for someone (e.g. after a visit). The owner signs in with a one-time code. */
export async function addSchool(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await allowed("schools", "school.add");
  if (!ctx) return NO;
  const name = str(fd, "name", 120);
  const town = str(fd, "town", 120);
  const ownerName = str(fd, "owner_name", 120);
  const contact = str(fd, "owner_contact", 120);
  const plan = ["pilot", "single", "group"].includes(str(fd, "plan")) ? str(fd, "plan") : "pilot";
  const group = str(fd, "group");
  if (name.length < 3) return { error: "Enter the school's full name." };
  if (ownerName.length < 3) return { error: "Enter the owner's name." };
  const email = normalizeEmail(contact);
  const phone = email ? null : normalizePhone(contact);
  if (!email && !phone) return { error: "Enter the owner's email address or a Nigerian phone number." };
  let slug = (str(fd, "slug", 40) || name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  if (!/^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$/.test(slug)) return { error: "The web address needs 3 to 40 letters, numbers or hyphens." };
  if (["www", "app", "api", "admin"].includes(slug)) slug = `${slug}-school`;
  if (group === "new" && str(fd, "group_name").length < 3) return { error: "Name the new group." };
  if (group && group !== "new" && !uuid.safeParse(group).success) return { error: "Choose a group." };

  const owner = await findOrCreateUser({ email, phone, fullName: ownerName });
  if (!owner) return { error: "We couldn't create the owner's sign-in. Check the email or phone number." };
  const { data: taken } = await ctx.admin.from("schools").select("id").eq("slug", slug).maybeSingle();
  if (taken) return { error: `The web address ${slug} is taken. Type another one under Web address.` };
  const { data: school, error } = await ctx.admin.from("schools").insert({ name, slug, address: town || null, plan }).select("id").single<{ id: string }>();
  if (error || !school) return { error: error?.code === "23505" ? `The web address ${slug} is taken.` : "We couldn't create the school." };
  await ctx.admin.from("memberships").insert({ school_id: school.id, user_id: owner, role: "owner" });
  await ctx.admin.from("grading_scales").insert(
    [
      ["A", 70, 100, "Excellent"],
      ["B", 60, 69.99, "Very good"],
      ["C", 50, 59.99, "Good"],
      ["D", 45, 49.99, "Fair"],
      ["E", 40, 44.99, "Pass"],
      ["F", 0, 39.99, "Fail"],
    ].map(([grade, min, max, remark]) => ({ school_id: school.id, grade, min_score: min, max_score: max, remark })),
  );
  await ctx.admin.from("school_accounts").insert({ school_id: school.id, signed_up_by: ctx.user.id, account_manager: ctx.user.id });
  if (group === "new") {
    const { data: g } = await ctx.admin.from("school_groups").insert({ name: str(fd, "group_name", 120), created_by: owner }).select("id").single<{ id: string }>();
    if (g) {
      await ctx.admin.from("schools").update({ group_id: g.id }).eq("id", school.id);
      await ctx.admin.from("group_members").insert({ group_id: g.id, user_id: owner, role: "proprietor", invited_by: ctx.user.id });
    }
  } else if (group) {
    await ctx.admin.from("schools").update({ group_id: group }).eq("id", school.id);
    await ctx.admin.from("group_members").upsert({ group_id: group, user_id: owner, role: "proprietor", invited_by: ctx.user.id }, { onConflict: "group_id,user_id", ignoreDuplicates: true });
  }
  await logPlatform(ctx, "Added a school", "access", school.id, `${name} · owner ${ownerName} (${email ?? phone}) · ${plan}`);
  if (email) {
    await teamEmail(email, `${name} is ready on Simpliskool`, `Welcome to Simpliskool, ${ownerName.split(" ")[0]}`, [
      `${ctx.fullName} has set up ${name} on Simpliskool for you.`,
      `Sign in with this email address. We'll send you a one-time code each time, so there's no password to remember. Then finish setting up your classes, staff and fees.`,
    ], { label: "Sign in to Simpliskool", path: "/login" });
  }
  await setFlash(`${name} added. ${email ? "The owner has been emailed an invite." : "The owner can sign in with their phone number."}`, `/super/schools/${school.id}`);
  redirect(`/super/schools/${school.id}`);
}

/** Plan, pilot end date, the school's own feature switches, and team notes. */
export async function saveSchoolPlan(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await allowed("schools", "school.edit");
  if (!ctx) return NO;
  const id = uuid.safeParse(fd.get("school_id"));
  if (!id.success) return { error: "Choose a school." };
  const plan = ["pilot", "single", "group"].includes(str(fd, "plan")) ? str(fd, "plan") : null;
  if (!plan) return { error: "Choose a plan." };
  const ends = str(fd, "pilot_ends");
  if (ends && !/^\d{4}-\d{2}-\d{2}$/.test(ends)) return { error: "Enter the date the pilot ends." };
  const settings = await getSettings();
  const features: Partial<Record<FeatureKey, boolean>> = {};
  for (const f of FEATURES) {
    if (fd.get(`shown_${f.key}`) !== "1") continue;
    const on = fd.get(`f_${f.key}`) === "on";
    if (on !== settings.flags[f.key]) features[f.key] = on; // only store differences from the platform switch
  }
  const manager = str(fd, "account_manager");
  const { error } = await ctx.admin.from("schools").update({ plan, pilot_ends: ends || null, features }).eq("id", id.data);
  if (error) return { error: "We couldn't save the plan." };
  await ctx.admin.from("school_accounts").upsert(
    { school_id: id.data, team_note: str(fd, "team_note", 1000) || null, account_manager: uuid.safeParse(manager).success ? manager : null, updated_at: new Date().toISOString() },
    { onConflict: "school_id" },
  );
  const changed = Object.entries(features).map(([k, v]) => `${FEATURES.find((f) => f.key === k)?.label}: ${v ? "on" : "off"}`);
  await logPlatform(ctx, "Changed plan", "other", id.data, [`Plan: ${plan}`, ends ? `pilot ends ${ends}` : null, ...changed].filter(Boolean).join(" · "));
  revalidatePath(`/super/schools/${id.data}`);
  return done("Plan saved.");
}

export async function suspendSchool(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await allowed("schools", "school.suspend");
  if (!ctx) return NO;
  const id = uuid.safeParse(fd.get("school_id"));
  if (!id.success) return { error: "Choose a school." };
  const reason = str(fd, "reason", 300);
  if (reason.length < 5) return { error: "Say why the school is being suspended (the team sees this)." };
  if (str(fd, "confirm").toUpperCase() !== "SUSPEND") return { error: "Type SUSPEND to confirm." };
  await ctx.admin.from("schools").update({ status: "suspended", suspended_at: new Date().toISOString(), suspended_reason: reason }).eq("id", id.data);
  await logPlatform(ctx, "Suspended school", "access", id.data, reason);
  await setFlash("School suspended. Staff, parents and students can't sign in; parents can still pay what they owe.", `/super/schools/${id.data}`, "warn");
  redirect(`/super/schools/${id.data}?tab=acc`);
}

export async function unsuspendSchool(fd: FormData) {
  const ctx = await requirePlatform("schools");
  const id = uuid.safeParse(fd.get("school_id"));
  if (!ctx.can("school.suspend") || !id.success) redirect("/super/schools");
  await ctx.admin.from("schools").update({ status: "active", suspended_at: null, suspended_reason: null }).eq("id", id.data);
  await logPlatform(ctx, "Switched school back on", "access", id.data, null);
  await setFlash("School switched back on.", `/super/schools/${id.data}`);
  redirect(`/super/schools/${id.data}?tab=acc`);
}

/** After checking who they are by phone: changes the owner's sign-in email or phone. */
export async function changeOwnerSignin(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await allowed("schools", "school.owner");
  if (!ctx) return NO;
  const id = uuid.safeParse(fd.get("school_id"));
  if (!id.success) return { error: "Choose a school." };
  const contact = str(fd, "contact", 120);
  const how = str(fd, "how", 300);
  if (how.length < 5) return { error: "Say how you checked it's really the owner." };
  const email = normalizeEmail(contact);
  const phone = email ? null : normalizePhone(contact);
  if (!email && !phone) return { error: "Enter the new email address or Nigerian phone number." };
  const { data: m } = await ctx.admin.from("memberships").select("user_id, profiles(email, phone, full_name)").eq("school_id", id.data).eq("role", "owner").order("created_at").limit(1).maybeSingle<{ user_id: string; profiles: { email: string | null; phone: string | null; full_name: string | null } | null }>();
  if (!m) return { error: "This school has no owner yet." };
  const { data: clash } = email ? await ctx.admin.from("profiles").select("id").ilike("email", email).neq("id", m.user_id).limit(1) : await ctx.admin.from("profiles").select("id").in("phone", [phone!, phone!.slice(1)]).neq("id", m.user_id).limit(1);
  if (clash?.length) return { error: "Someone else already signs in with that. Use a different one." };
  const { error } = await ctx.admin.auth.admin.updateUserById(m.user_id, email ? { email, email_confirm: true } : { phone: phone!, phone_confirm: true });
  if (error) return { error: `We couldn't change it: ${error.message}` };
  await ctx.admin.from("profiles").update(email ? { email } : { phone }).eq("id", m.user_id);
  const before = email ? m.profiles?.email : m.profiles?.phone;
  await logPlatform(ctx, "Changed owner sign-in", "access", id.data, `${before ?? "none"} → ${email ?? phone} · ${how}`);
  const tell = [m.profiles?.email, email].filter((e): e is string => !!e);
  await teamEmail(tell, "Your Simpliskool sign-in was changed", "Your sign-in was changed", [`The Simpliskool team changed how ${m.profiles?.full_name ?? "the owner"} signs in to ${(await schoolName(ctx, id.data)) ?? "your school"} to ${email ?? phone}.`, "If you didn't ask for this, reply to this email straight away."]);
  revalidatePath(`/super/schools/${id.data}`);
  return done(`The owner now signs in with ${email ?? phone}.`);
}

/** Opens the school's portal as its owner, read only, for a limited time. */
export async function startViewing(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await allowed("schools", "view");
  if (!ctx) return NO;
  const id = uuid.safeParse(fd.get("school_id"));
  if (!id.success) return { error: "Choose a school." };
  const reasons = ["Helping with a support request", "Checking a payment problem", "Training the school", "Checking the school is set up properly"];
  const reason = str(fd, "reason");
  if (!reasons.includes(reason)) return { error: "Choose why you're viewing." };
  const ticket = str(fd, "ticket", 20).replace(/^#/, "");
  const settings = await getSettings();
  const mins = settings.view_minutes === 60 ? 60 : 30;
  const expires = new Date(Date.now() + mins * 60_000).toISOString();
  await ctx.admin.from("platform_views").update({ ended_at: new Date().toISOString() }).eq("user_id", ctx.user.id).is("ended_at", null);
  const { data: v, error } = await ctx.admin.from("platform_views").insert({ user_id: ctx.user.id, school_id: id.data, reason, ticket: ticket || null, expires_at: expires }).select("id").single<{ id: string }>();
  if (error || !v) return { error: "We couldn't start viewing." };
  const name = await schoolName(ctx, id.data);
  await logPlatform(ctx, "Viewed as school", "view", id.data, `${reason}${ticket ? ` · request #${ticket}` : ""} · read only, up to ${mins} minutes`);
  await teamEmail(await schoolEmails(ctx.admin, id.data), "The Simpliskool team viewed your school", "A Simpliskool team member is viewing your portal", [
    `${ctx.fullName} from the Simpliskool team opened ${name ?? "your school"}'s portal to look around, read only. Nothing can be changed while they view it.`,
    `Reason: ${reason}${ticket ? ` (support request #${ticket})` : ""}. It ends automatically after ${mins} minutes.`,
    "If you didn't expect this, reply to this email.",
  ]);
  (await cookies()).set(VIEW_COOKIE, v.id, { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: mins * 60 });
  redirect("/admin");
}

// ===========================================================================
// New school checks
// ===========================================================================

export async function recordCheck(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await allowed("approvals", "approve");
  if (!ctx) return NO;
  const id = uuid.safeParse(fd.get("school_id"));
  if (!id.success) return { error: "Choose a school." };
  const how = str(fd, "how", 200);
  const cac = str(fd, "cac", 30).toUpperCase();
  if (how.length < 3 && !cac) return { error: "Say how you checked the school is real, or add its CAC number." };
  if (cac && !/^(RC|BN|IT)?\s?\d{4,8}$/.test(cac)) return { error: "CAC numbers look like RC 1487220 or BN 2345678." };
  if (how.length >= 3) await ctx.admin.from("school_accounts").upsert({ school_id: id.data, real_check: how, real_checked_by: ctx.user.id, real_checked_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: "school_id" });
  if (cac) await ctx.admin.from("schools").update({ cac_number: cac.replace(/^(RC|BN|IT)\s?/, "$1 ") }).eq("id", id.data);
  await logPlatform(ctx, "Checked school", "access", id.data, [how, cac && `CAC ${cac}`].filter(Boolean).join(" · "));
  revalidatePath("/super/checks");
  return done("Saved.");
}

export async function approveSchool(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await allowed("approvals", "approve");
  if (!ctx) return NO;
  const id = uuid.safeParse(fd.get("school_id"));
  if (!id.success) return { error: "Choose a school." };
  const { data: p } = await ctx.admin.from("school_payouts").select("paystack_subaccount, account_name").eq("school_id", id.data).maybeSingle<{ paystack_subaccount: string | null; account_name: string }>();
  if (!p?.paystack_subaccount) return { error: "The school hasn't added a payout account that works yet. Ask them to add it in Settings." };
  const note = str(fd, "note", 500);
  await ctx.admin.from("schools").update({ payments_approved_at: new Date().toISOString(), payments_approved_by: ctx.user.id, check_status: "approved", check_note: null }).eq("id", id.data);
  await logPlatform(ctx, "Approved school", "access", id.data, `Payments turned on · account name ${p.account_name}${note ? ` · ${note}` : ""}`);
  await teamEmail(await schoolEmails(ctx.admin, id.data, ["owner", "bursar"]), "Online fee payments are on", "Parents can now pay fees online", [
    `We've checked ${(await schoolName(ctx, id.data)) ?? "your school"}'s payout account (${p.account_name}). Parents can now pay fees online in the Simpliskool app.`,
    "Each payment is paid into your account, usually the next working day.",
  ]);
  revalidatePath("/super/checks");
  return done("Approved. Payments are on and the owner has been told.");
}

export async function askSchoolToFix(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await allowed("approvals", "approve");
  if (!ctx) return NO;
  const id = uuid.safeParse(fd.get("school_id"));
  if (!id.success) return { error: "Choose a school." };
  const note = str(fd, "note", 500);
  if (note.length < 10) return { error: "Write what the school needs to fix. They'll see this note." };
  await ctx.admin.from("schools").update({ check_status: "asked", check_note: note }).eq("id", id.data);
  await logPlatform(ctx, "Asked school to fix", "access", id.data, note);
  await teamEmail(await schoolEmails(ctx.admin, id.data), "Please check your Simpliskool payout details", "One thing to fix before parents can pay online", [note, "Open Settings in Simpliskool to update it. We'll check again as soon as you do."], { label: "Open Settings", path: "/admin/settings#payouts" });
  revalidatePath("/super/checks");
  return done("Sent. We'll show it here again when the school updates its details.");
}

// ===========================================================================
// Money
// ===========================================================================

export async function refundPayment(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await allowed("payments", "money");
  if (!ctx) return NO;
  const id = uuid.safeParse(fd.get("request_id"));
  if (!id.success) return { error: "Choose a refund request." };
  const { data: r } = await ctx.admin.from("refund_requests").select("id, school_id, payment_id, amount_kobo, reason, status, requested_by, payments(paystack_reference, status, voided_at)").eq("id", id.data).maybeSingle<{ id: string; school_id: string; payment_id: string; amount_kobo: number; reason: string; status: string; requested_by: string | null; payments: { paystack_reference: string | null; status: string; voided_at: string | null } | null }>();
  if (!r || r.status !== "asked") return { error: "This request has already been dealt with." };
  const ref = r.payments?.paystack_reference;
  if (!ref || r.payments?.status !== "success" || r.payments.voided_at) return { error: "This payment can't be refunded (it was cancelled or isn't an online payment)." };
  const res = await refundTransaction(ref, r.reason);
  if (!res.ok) return { error: `Paystack didn't accept the refund: ${res.error}` };
  await ctx.admin.from("payments").update({ status: "failed", voided_at: new Date().toISOString(), void_reason: `Refunded to the parent: ${r.reason}`.slice(0, 200) }).eq("id", r.payment_id);
  await ctx.admin.from("refund_requests").update({ status: "refunded", decided_by: ctx.user.id, decided_at: new Date().toISOString(), paystack_refund: res.data.id ? String(res.data.id) : null }).eq("id", r.id);
  await logPlatform(ctx, "Refunded a payment", "money", r.school_id, `₦${(r.amount_kobo / 100).toLocaleString("en-NG")} · ${r.reason} · ${ref}`);
  await teamEmail(await schoolEmails(ctx.admin, r.school_id, ["owner", "bursar"]), "Refund sent to the parent", "We've refunded the parent", [`₦${(r.amount_kobo / 100).toLocaleString("en-NG")} (${r.reason}) is on its way back to the parent's card or account. The payment is now marked as refunded and the balance is back on the invoice.`, "The refund comes out of your next payout. Paystack's charge isn't returned."]);
  await setFlash("Refund sent to Paystack. The school has been told.", "/super/payments");
  redirect("/super/payments?tab=ds");
}

export async function declineRefund(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await allowed("payments", "money");
  if (!ctx) return NO;
  const id = uuid.safeParse(fd.get("request_id"));
  if (!id.success) return { error: "Choose a refund request." };
  const note = str(fd, "note", 300);
  if (note.length < 5) return { error: "Say why (the school sees this)." };
  const { data: r } = await ctx.admin.from("refund_requests").update({ status: "declined", decided_by: ctx.user.id, decided_at: new Date().toISOString(), decline_note: note }).eq("id", id.data).eq("status", "asked").select("school_id, amount_kobo").maybeSingle<{ school_id: string; amount_kobo: number }>();
  if (!r) return { error: "This request has already been dealt with." };
  await logPlatform(ctx, "Declined a refund", "money", r.school_id, note);
  await teamEmail(await schoolEmails(ctx.admin, r.school_id, ["owner", "bursar"]), "About your refund request", "We couldn't refund this payment", [note]);
  await setFlash("Declined. The school has been told why.", "/super/payments");
  redirect("/super/payments?tab=ds");
}

/** Sends the receipt and student record to Paystack for a chargeback. */
export async function sendDisputeEvidence(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await allowed("payments", "money");
  if (!ctx) return NO;
  const dispute = str(fd, "dispute_id", 40);
  const ref = str(fd, "reference", 80);
  if (!dispute || !ref) return { error: "Choose a dispute." };
  const { data: p } = await ctx.admin
    .from("payments")
    .select("school_id, amount_kobo, receipt_no, paid_at, schools(name), invoices(students(first_name, last_name, admission_no))")
    .eq("paystack_reference", ref)
    .maybeSingle<{ school_id: string; amount_kobo: number; receipt_no: string | null; paid_at: string | null; schools: { name: string } | null; invoices: { students: { first_name: string; last_name: string; admission_no: string | null } | null } | null }>();
  if (!p) return { error: "We can't find this payment in Simpliskool." };
  const { data: intent } = await ctx.admin.from("payment_intents").select("created_by, profiles(full_name, email, phone)").eq("reference", ref).maybeSingle<{ created_by: string; profiles: { full_name: string | null; email: string | null; phone: string | null } | null }>();
  const st = p.invoices?.students;
  const res = await addDisputeEvidence(dispute, {
    customer_email: intent?.profiles?.email ?? "parent@pay.simpliskool.com",
    customer_name: intent?.profiles?.full_name ?? "Parent",
    customer_phone: intent?.profiles?.phone ?? "",
    service_details: `School fees paid to ${p.schools?.name ?? "the school"} for ${st ? `${st.first_name} ${st.last_name}${st.admission_no ? ` (admission no. ${st.admission_no})` : ""}` : "a student"}. Receipt ${p.receipt_no ?? ref}, paid ${p.paid_at?.slice(0, 10) ?? ""} by the parent signed in to the school's Simpliskool parent portal.`,
    delivery_date: p.paid_at?.slice(0, 10),
  });
  if (!res.ok) return { error: `Paystack didn't accept it: ${res.error}` };
  await logPlatform(ctx, "Answered a chargeback", "money", p.school_id, `Dispute ${dispute} · ${ref} · receipt and student record sent`);
  return done("Sent to Paystack as proof.");
}

/** A payout bounced: asks the school to add a working account. */
export async function askNewAccount(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await allowed("payments", "money");
  if (!ctx) return NO;
  const id = uuid.safeParse(fd.get("school_id"));
  if (!id.success) return { error: "Choose a school." };
  const why = str(fd, "why", 200) || "the bank couldn't pay into it";
  await ctx.admin.from("schools").update({ check_status: "asked", check_note: `Your last payout failed (${why}). Add an account that's open and in the school's name.` }).eq("id", id.data);
  await logPlatform(ctx, "Asked for a new payout account", "money", id.data, why);
  await teamEmail(await schoolEmails(ctx.admin, id.data, ["owner"]), "Your payout didn't go through", "We couldn't pay fees into your account", [`Paystack tried to pay your fee collections into your account but ${why}. The money is safe and will be paid as soon as you add a working account.`, "Open Settings in Simpliskool and add an account that's open and in the school's name."], { label: "Update payout account", path: "/admin/settings#payouts" });
  return done("The owner has been asked for a new account.");
}

// ===========================================================================
// Plans and billing
// ===========================================================================

export async function savePlans(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await allowed("billing", "billing");
  if (!ctx) return NO;
  const s = await getSettings();
  const ends = str(fd, "pilot_ends");
  const plans = { ...s.plans };
  for (const k of ["pilot", "single", "group"] as const) plans[k] = { price: str(fd, `price_${k}`, 60), desc: str(fd, `desc_${k}`, 200) || s.plans[k].desc };
  await saveSettings(ctx, { ...s, plans, pilot_ends: /^\d{4}-\d{2}-\d{2}$/.test(ends) ? ends : null });
  await logPlatform(ctx, "Changed plan prices", "money", null, (["pilot", "single", "group"] as const).map((k) => `${k}: ${plans[k].price || "not set"}`).join(" · "));
  revalidatePath("/super/billing");
  return done("Plans saved.");
}

export async function setBillingTalk(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await allowed("billing", "billing.talk");
  if (!ctx) return NO;
  const id = uuid.safeParse(fd.get("school_id"));
  const talk = str(fd, "talk");
  if (!id.success || !["not_yet", "happy", "later", "unsure", "leaving"].includes(talk)) return { error: "Choose an answer." };
  await ctx.admin.from("school_accounts").upsert({ school_id: id.data, billing_talk: talk, updated_at: new Date().toISOString() }, { onConflict: "school_id" });
  revalidatePath("/super/billing");
  return done("Saved.");
}

// ===========================================================================
// Support
// ===========================================================================

export async function teamReply(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await allowed("support", "support.reply");
  if (!ctx) return NO;
  const ticket = Number(fd.get("ticket_id"));
  const body = str(fd, "body", 4000);
  const internal = fd.get("internal") === "on" && ctx.can("support");
  const close = fd.get("close") === "1" && ctx.can("support");
  if (!Number.isInteger(ticket)) return { error: "Choose a request." };
  if (!body && !close) return { error: "Write a reply first." };
  const { data: t } = await ctx.admin.from("support_tickets").select("id, school_id, subject, opened_by, profiles!support_tickets_opened_by_fkey(email)").eq("id", ticket).maybeSingle<{ id: number; school_id: string; subject: string; opened_by: string | null; profiles: { email: string | null } | null }>();
  if (!t) return { error: "That request doesn't exist." };
  if (body) await ctx.admin.from("support_messages").insert({ ticket_id: ticket, author_id: ctx.user.id, author_name: ctx.fullName, from_team: true, internal, body });
  await ctx.admin.from("support_tickets").update({ ...(internal ? {} : { last_from: "team" }), ...(close ? { status: "closed" } : { status: "open" }), updated_at: new Date().toISOString() }).eq("id", ticket);
  if (body && !internal && t.profiles?.email) {
    await teamEmail(t.profiles.email, `Re: ${t.subject} [#${t.id}]`, `Reply to your request #${t.id}`, [body, close ? "We've marked this request as done. Reply in Simpliskool if you need anything else." : "You can reply in Simpliskool under Get help."], { label: "Open the request", path: `/admin/help?t=${t.id}` });
  }
  if (close) {
    // The reply box is replaced by "Reopen", so the message goes with the next page.
    await setFlash(body ? "Reply sent and request closed." : "Request closed.", "/super/support");
    redirect(`/super/support?show=closed&t=${ticket}`);
  }
  revalidatePath("/super/support");
  return done(internal ? "Note added (the school can't see it)." : "Reply sent. They'll get it by email and in the app.");
}

export async function assignTicket(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await allowed("support", "support");
  if (!ctx) return NO;
  const ticket = Number(fd.get("ticket_id"));
  const to = str(fd, "assigned_to");
  if (!Number.isInteger(ticket)) return { error: "Choose a request." };
  await ctx.admin.from("support_tickets").update({ assigned_to: uuid.safeParse(to).success ? to : null }).eq("id", ticket);
  revalidatePath("/super/support");
  return done("Assigned.");
}

export async function reopenTicket(fd: FormData) {
  const ctx = await requirePlatform("support");
  const ticket = Number(fd.get("ticket_id"));
  if (ctx.can("support") && Number.isInteger(ticket)) await ctx.admin.from("support_tickets").update({ status: "open", updated_at: new Date().toISOString() }).eq("id", ticket);
  redirect(`/super/support?t=${ticket}`);
}

// ===========================================================================
// SMS and email
// ===========================================================================

export async function addSmsCredit(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await allowed("messaging", "sms");
  if (!ctx) return NO;
  const id = uuid.safeParse(fd.get("school_id"));
  const n = Math.round(Number(fd.get("credit")));
  const note = str(fd, "note", 200);
  if (!id.success) return { error: "Choose a school." };
  if (!Number.isFinite(n) || n === 0 || Math.abs(n) > 1_000_000) return { error: "Enter how many SMS to add (a minus number takes some away)." };
  if (note.length < 3) return { error: "Add a note, like the payment reference." };
  const { data, error } = await ctx.admin.rpc("add_sms_credit", { p_school: id.data, p_n: n });
  if (error) return { error: "We couldn't add the credit." };
  await logPlatform(ctx, n > 0 ? "Added SMS credit" : "Took away SMS credit", "money", id.data, `${n > 0 ? "+" : ""}${n.toLocaleString("en-NG")} SMS · ${note}`);
  revalidatePath("/super/messaging");
  return done(`Done. The school now has ${Number(data).toLocaleString("en-NG")} SMS credit.`);
}

export async function decideSender(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await allowed("messaging", "sender");
  if (!ctx) return NO;
  const id = uuid.safeParse(fd.get("school_id"));
  const step = str(fd, "step");
  if (!id.success) return { error: "Choose a school." };
  const { data: s } = await ctx.admin.from("schools").select("name, sender_id, sender_status").eq("id", id.data).maybeSingle<{ name: string; sender_id: string | null; sender_status: string }>();
  if (!s?.sender_id) return { error: "This school hasn't asked for a sender name." };
  if (step === "send") {
    const r = await requestSenderId(s.sender_id, s.name, `School notices to parents of ${s.name}: absence alerts, fee reminders, receipts and announcements.`);
    if (!r.ok) return { error: `The SMS provider didn't accept it: ${r.error}` };
    await ctx.admin.from("schools").update({ sender_status: "sent", sender_note: null }).eq("id", id.data);
    await logPlatform(ctx, "Sent sender name to provider", "other", id.data, s.sender_id);
    await setFlash(`${s.sender_id} sent to the SMS provider. Mark it live once the networks approve it (usually a few days).`, "/super/messaging");
    redirect("/super/messaging?tab=sn");
  }
  if (step === "live") {
    await ctx.admin.from("schools").update({ sender_status: "live", sender_note: null }).eq("id", id.data);
    await logPlatform(ctx, "Sender name approved", "other", id.data, s.sender_id);
    await teamEmail(await schoolEmails(ctx.admin, id.data), "Your SMS sender name is live", `Texts now come from ${s.sender_id}`, [`Parents will now see ${s.sender_id} instead of Simpliskool on texts from ${s.name}.`]);
    await setFlash(`${s.sender_id} is live. The school's texts now use it.`, "/super/messaging");
    redirect("/super/messaging?tab=sn");
  }
  if (step === "reject") {
    const note = str(fd, "note", 200);
    if (note.length < 5) return { error: "Say why (the school sees this)." };
    await ctx.admin.from("schools").update({ sender_status: "rejected", sender_note: note }).eq("id", id.data);
    await logPlatform(ctx, "Rejected sender name", "other", id.data, `${s.sender_id} · ${note}`);
    await setFlash("Rejected. The school sees your note in Settings.", "/super/messaging");
    redirect("/super/messaging?tab=sn");
  }
  return { error: "Choose what to do." };
}

// ===========================================================================
// Notices to schools
// ===========================================================================

export async function publishNotice(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await allowed("notices", "notices");
  if (!ctx) return NO;
  const kind = str(fd, "kind");
  const headline = str(fd, "headline", 120);
  const details = str(fd, "details", 500);
  const audience = str(fd, "audience");
  const until = str(fd, "show_until");
  const ids = fd.getAll("schools").map(String).filter((x) => uuid.safeParse(x).success);
  if (!["feat", "down", "change"].includes(kind)) return { error: "Choose the type of notice." };
  if (headline.length < 3) return { error: "Write a headline." };
  if (!["admins", "bursars", "pilot", "chosen"].includes(audience)) return { error: "Choose who sees it." };
  if (audience === "chosen" && !ids.length) return { error: "Tick at least one school." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(until)) return { error: "Choose the last day to show it." };
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date());
  if (until < today) return { error: "The last day can't be in the past." };
  const email = fd.get("email_owners") === "on";
  const { error } = await ctx.admin.from("platform_notices").insert({ kind, headline, details: details || null, audience, school_ids: audience === "chosen" ? ids : null, show_until: until, email_owners: email, created_by: ctx.user.id });
  if (error) return { error: "We couldn't publish the notice." };
  let emailed = 0;
  if (email) {
    let q = ctx.admin.from("schools").select("id, plan").eq("status", "active");
    if (audience === "chosen") q = q.in("id", ids);
    const { data: schools } = await q.returns<{ id: string; plan: string }[]>();
    const targets = (schools ?? []).filter((s) => audience !== "pilot" || s.plan === "pilot").map((s) => s.id);
    if (targets.length) {
      const { data: owners } = await ctx.admin.from("memberships").select("profiles(email)").in("school_id", targets).in("role", audience === "bursars" ? ["owner", "bursar"] : ["owner"]).returns<{ profiles: { email: string | null } | null }[]>();
      const list = [...new Set((owners ?? []).map((o) => o.profiles?.email).filter((e): e is string => !!e))];
      emailed = (await teamEmail(list, headline, headline, [details || headline], { label: "Open Simpliskool", path: "/admin" })).sent;
    }
  }
  await logPlatform(ctx, "Published a notice", "other", null, `${headline} · ${audience} · until ${until}${email ? ` · emailed ${emailed}` : ""}`);
  revalidatePath("/super/notices");
  return done(`Published.${email ? ` Emailed ${emailed} owner${emailed === 1 ? "" : "s"}.` : ""}`);
}

export async function endNotice(fd: FormData) {
  const ctx = await requirePlatform("notices");
  const id = uuid.safeParse(fd.get("notice_id"));
  if (ctx.can("notices") && id.success) {
    await ctx.admin.from("platform_notices").update({ ended_at: new Date().toISOString() }).eq("id", id.data);
    await setFlash("Notice taken down.", "/super/notices");
  }
  redirect("/super/notices");
}

// ===========================================================================
// Dream Savvy team
// ===========================================================================

export async function inviteTeam(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await allowed("team", "team");
  if (!ctx) return NO;
  const name = str(fd, "name", 120);
  const email = normalizeEmail(str(fd, "email", 200));
  const role = str(fd, "role") as TeamRole;
  if (name.length < 2) return { error: "Enter their name." };
  if (!email) return { error: "Enter their work email address." };
  if (!TEAM_ROLES.includes(role)) return { error: "Choose a role." };
  const id = await findOrCreateUser({ email, fullName: name });
  if (!id) return { error: "We couldn't create their sign-in." };
  const { error } = await ctx.admin.from("platform_team").insert({ user_id: id, role, invited_by: ctx.user.id });
  if (error) return { error: error.code === "23505" ? "They're already on the team." : "We couldn't add them." };
  await logPlatform(ctx, "Added a team member", "access", null, `${name} (${email}) · ${role}`);
  await teamEmail(email, "You've been added to the Simpliskool back office", `Welcome to the team, ${name.split(" ")[0]}`, [`${ctx.fullName} added you to the Simpliskool back office.`, "Sign in with this email address (we send a one-time code), then set up two-step sign-in with an authenticator app before you can see any school."], { label: "Sign in", path: "/login" });
  revalidatePath("/super/team");
  return done(`${name} added. They've been emailed an invite.`);
}

export async function changeTeamRole(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await allowed("team", "team");
  if (!ctx) return NO;
  const id = uuid.safeParse(fd.get("user_id"));
  const role = str(fd, "role") as TeamRole;
  if (!id.success || !TEAM_ROLES.includes(role)) return { error: "Choose a role." };
  if (id.data === ctx.user.id) return { error: "Ask another super admin to change your own role." };
  await ctx.admin.from("platform_team").update({ role }).eq("user_id", id.data);
  await logPlatform(ctx, "Changed a team role", "access", null, `${str(fd, "name")} → ${role}`);
  revalidatePath("/super/team");
  return done("Role changed.");
}

export async function removeTeam(fd: FormData) {
  const ctx = await requirePlatform("team");
  const id = uuid.safeParse(fd.get("user_id"));
  if (ctx.can("team") && id.success && id.data !== ctx.user.id) {
    await ctx.admin.from("platform_team").delete().eq("user_id", id.data);
    await ctx.admin.from("platform_views").update({ ended_at: new Date().toISOString() }).eq("user_id", id.data).is("ended_at", null);
    await logPlatform(ctx, "Removed a team member", "access", null, str(fd, "name"));
    await setFlash("Removed from the team.", "/super/team");
  }
  redirect("/super/team");
}

export async function resetTwoStep(fd: FormData) {
  const ctx = await requirePlatform("team");
  const id = uuid.safeParse(fd.get("user_id"));
  if (ctx.can("team") && id.success) {
    await ctx.admin.from("platform_team").update({ totp_secret: null, totp_on_at: null }).eq("user_id", id.data);
    await logPlatform(ctx, "Reset two-step sign-in", "access", null, str(fd, "name"));
    await setFlash("Two-step sign-in reset. They'll set it up again next time they sign in.", "/super/team");
  }
  redirect("/super/team");
}

// ===========================================================================
// Platform settings
// ===========================================================================

async function saveSettings(ctx: PlatformCtx, s: PlatformSettings) {
  await ctx.admin.from("platform_settings").upsert({ id: true, data: s, updated_by: ctx.user.id, updated_at: new Date().toISOString() }, { onConflict: "id" });
}

export async function savePlatformSettings(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await allowed("platform", "platform");
  if (!ctx) return NO;
  const old = await getSettings();
  const int = (k: string, min: number, max: number, dflt: number) => {
    const n = Math.round(Number(fd.get(k)));
    return Number.isFinite(n) && n >= min && n <= max ? n : dflt;
  };
  const flags = { ...old.flags };
  for (const f of FEATURES) flags[f.key] = fd.get(`flag_${f.key}`) === "on";
  const fee = Number(String(fd.get("fee") ?? "0").replace(/[₦,\s]/g, ""));
  const next: PlatformSettings = {
    ...old,
    flags,
    fee_kobo: Number.isFinite(fee) && fee >= 0 && fee <= 5000 ? Math.round(fee * 100) : old.fee_kobo,
    trial_days: [0, 14, 30].includes(int("trial_days", 0, 30, 30)) ? int("trial_days", 0, 30, 30) : 30,
    free_sms: int("free_sms", 0, 100_000, DEFAULT_SETTINGS.free_sms),
    sms_price: str(fd, "sms_price", 20),
    pin_tries: int("pin_tries", 3, 10, 5),
    pin_lock_minutes: int("pin_lock_minutes", 15, 60, 15) === 60 ? 60 : 15,
    view_minutes: int("view_minutes", 30, 60, 30) === 60 ? 60 : 30,
  };
  await saveSettings(ctx, next);
  const diff = [
    ...FEATURES.filter((f) => old.flags[f.key] !== next.flags[f.key]).map((f) => `${f.label} ${next.flags[f.key] ? "on" : "off"}`),
    ...(["fee_kobo", "trial_days", "free_sms", "sms_price", "pin_tries", "pin_lock_minutes", "view_minutes"] as const).filter((k) => old[k] !== next[k]).map((k) => `${k}: ${old[k]} → ${next[k]}`),
  ];
  await logPlatform(ctx, "Changed platform settings", "other", null, diff.join(" · ") || "No changes");
  revalidatePath("/super/platform");
  return done(diff.length ? "Settings saved. Every change is in the audit log." : "Nothing changed.");
}

/** One note box, two buttons: approve, or ask the school to fix something. */
export async function decideCheck(prev: ActionState, fd: FormData): Promise<ActionState> {
  return fd.get("do") === "approve" ? approveSchool(prev, fd) : askSchoolToFix(prev, fd);
}
