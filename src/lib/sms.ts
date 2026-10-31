import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhone } from "@/lib/people";
import { claim, finish } from "@/lib/notify";
import { optedOut } from "@/lib/optouts";

/**
 * Text messages through Termii (https://developers.termii.com).
 * Without TERMII_API_KEY nothing is sent and results say "skipped".
 *
 * TERMII_SENDER_ID  the approved sender name (up to 11 letters), e.g. Simpliskool
 * TERMII_CHANNEL    "generic" (default) or "dnd" to reach numbers on Do-Not-Disturb
 * TERMII_BASE_URL   the base URL shown in your Termii dashboard
 */
export type SmsResult = { ok: true; id: string } | { ok: false; skipped: boolean; error: string };
type Admin = ReturnType<typeof createAdminClient>;

export function smsReady() {
  return !!process.env.TERMII_API_KEY;
}

const BASE = () => (process.env.TERMII_BASE_URL ?? "https://v3.api.termii.com").replace(/\/$/, "");

/** +2348031234567 → 2348031234567 (Termii wants digits only). */
function termiiNumber(raw: string | null | undefined) {
  const p = normalizePhone(raw);
  return p ? p.slice(1) : null;
}

/** Keeps a text to 2 SMS pages at most (306 characters), on one line. */
export function smsText(s: string) {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > 306 ? `${t.slice(0, 303)}...` : t;
}

/** How many SMS pages a text uses (one credit each, per number). */
export function smsPages(text: string) {
  const t = smsText(text);
  return t.length <= 160 ? 1 : Math.ceil(t.length / 153);
}

/** The school's own sender name once approved, otherwise Simpliskool's. */
export async function schoolSender(admin: Admin, schoolId: string) {
  const { data } = await admin.from("schools").select("sender_id, sender_status").eq("id", schoolId).maybeSingle<{ sender_id: string | null; sender_status: string }>();
  return data?.sender_status === "live" && data.sender_id ? data.sender_id : undefined;
}

/** Takes SMS credit from the school; false when there isn't enough (nothing is taken). */
export async function takeSmsCredit(admin: Admin, schoolId: string, n: number) {
  const { data, error } = await admin.rpc("use_sms_credit", { p_school: schoolId, p_n: n });
  if (error) return /function/i.test(error.message); // before database file 0018: no credit limits
  return data === true;
}

export async function giveBackSmsCredit(admin: Admin, schoolId: string, n: number) {
  if (n > 0) await admin.rpc("add_sms_credit", { p_school: schoolId, p_n: n });
}

export async function sendSms(to: string, text: string, from?: string): Promise<SmsResult> {
  const key = process.env.TERMII_API_KEY;
  if (!key) return { ok: false, skipped: true, error: "SMS isn't set up yet (TERMII_API_KEY missing)." };
  const num = termiiNumber(to);
  if (!num) return { ok: false, skipped: true, error: "Not a valid phone number" };
  try {
    const res = await fetch(`${BASE()}/api/sms/send`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ api_key: key, to: num, from: from ?? process.env.TERMII_SENDER_ID ?? "Simpliskool", sms: smsText(text), type: "plain", channel: process.env.TERMII_CHANNEL ?? "generic" }),
      signal: AbortSignal.timeout(10000),
    });
    const data = (await res.json().catch(() => ({}))) as { message_id?: string | number; message?: string; code?: string };
    if (!res.ok || !data.message_id) return { ok: false, skipped: false, error: data.message ?? `SMS service error ${res.status}` };
    return { ok: true, id: String(data.message_id) };
  } catch (e) {
    return { ok: false, skipped: false, error: e instanceof Error ? e.message : "SMS service unreachable" };
  }
}

/** One message to many numbers (Termii bulk, up to 10,000 per request). Returns how many were accepted. */
export async function sendSmsBulk(numbers: string[], text: string, from?: string): Promise<{ sent: number; failed: number; skipped: boolean }> {
  const key = process.env.TERMII_API_KEY;
  if (!key) return { sent: 0, failed: 0, skipped: true };
  const list = [...new Set(numbers.map(termiiNumber).filter((n): n is string => !!n))];
  let sent = 0;
  let failed = 0;
  for (let i = 0; i < list.length; i += 10000) {
    const chunk = list.slice(i, i + 10000);
    try {
      const res = await fetch(`${BASE()}/api/sms/send/bulk`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ api_key: key, to: chunk, from: from ?? process.env.TERMII_SENDER_ID ?? "Simpliskool", sms: smsText(text), type: "plain", channel: process.env.TERMII_CHANNEL ?? "generic" }),
        signal: AbortSignal.timeout(20000),
      });
      const data = (await res.json().catch(() => ({}))) as { message_id?: string | number };
      if (res.ok && data.message_id) sent += chunk.length;
      else failed += chunk.length;
    } catch {
      failed += chunk.length;
    }
  }
  return { sent, failed, skipped: false };
}

export type SmsSettings = { sms_enabled: boolean; sms_absence: boolean; sms_fees: boolean; sms_receipts: boolean };

/** The school's SMS switches (all off if the database file 0014 hasn't been run). */
export async function smsSettings(admin: Admin, schoolId: string): Promise<SmsSettings> {
  const { data } = await admin.from("schools").select("sms_enabled, sms_absence, sms_fees, sms_receipts").eq("id", schoolId).maybeSingle<SmsSettings>();
  return data ?? { sms_enabled: false, sms_absence: false, sms_fees: false, sms_receipts: false };
}

/** Phone numbers of each student's parents (normalised, no duplicates). */
export async function parentPhones(admin: Admin, studentIds: string[]) {
  const out = new Map<string, string[]>();
  if (!studentIds.length) return out;
  const { data } = await admin.from("guardians").select("student_id, user_id, profiles(phone)").in("student_id", studentIds).returns<{ student_id: string; user_id: string; profiles: { phone: string | null } | null }[]>();
  const off = await optedOut(admin, (data ?? []).map((g) => g.user_id), "sms");
  for (const g of data ?? []) {
    if (off.has(g.user_id)) continue;
    const p = normalizePhone(g.profiles?.phone);
    if (!p) continue;
    const list = out.get(g.student_id) ?? [];
    if (!list.includes(p)) list.push(p);
    out.set(g.student_id, list);
  }
  return out;
}

/** Sends one logged text (at most once per kind, number, child and day). */
export async function sendLoggedSms(admin: Admin, row: { school_id: string; student_id: string | null; kind: "absence" | "fee_reminder" | "payment_receipt"; recipient: string; about_date: string }, text: string) {
  const id = await claim(admin, { ...row, channel: "sms" });
  if (!id) return null;
  const to = row.recipient.split(" ")[0];
  const pages = smsPages(text);
  if (smsReady() && !(await takeSmsCredit(admin, row.school_id, pages))) {
    const res: SmsResult = { ok: false, skipped: false, error: "No SMS credit left. Buy more from Simpliskool." };
    await finish(admin, id, res);
    return res;
  }
  const res = await sendSms(to, text, await schoolSender(admin, row.school_id));
  if (!res.ok && smsReady()) await giveBackSmsCredit(admin, row.school_id, pages);
  await finish(admin, id, res);
  return res;
}

/** Short school name for texts, e.g. "Greenfield College". */
export function shortName(name: string) {
  return name.length > 40 ? `${name.slice(0, 38)}…` : name;
}

/** Asks Termii (and the networks) to approve a sender name. Approval takes a few days. */
export async function requestSenderId(senderId: string, company: string, usecase: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const key = process.env.TERMII_API_KEY;
  if (!key) return { ok: false, error: "SMS isn't set up yet (TERMII_API_KEY missing)." };
  try {
    const res = await fetch(`${BASE()}/api/sender-id/request`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ api_key: key, sender_id: senderId, usecase: usecase.slice(0, 200), company: company.slice(0, 100) }),
      signal: AbortSignal.timeout(15000),
    });
    const data = (await res.json().catch(() => ({}))) as { code?: string; message?: string };
    return res.ok ? { ok: true } : { ok: false, error: data.message ?? `SMS service error ${res.status}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "SMS service unreachable" };
  }
}
