import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { naira } from "@/lib/format";
import { parentPhones, sendLoggedSms, shortName, smsReady, smsSettings } from "@/lib/sms";

type Tally = { sent: number; failed: number; skipped: number };
const lagosToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date());
const add = (t: Tally, r: Awaited<ReturnType<typeof sendLoggedSms>>) => {
  if (!r) return;
  if (r.ok) t.sent++;
  else if (r.skipped) t.skipped++;
  else t.failed++;
};

/** "Payment received" text to the parents (if the school has SMS receipts on). */
export async function smsReceipt(paymentId: string): Promise<Tally> {
  const t = { sent: 0, failed: 0, skipped: 0 };
  if (!smsReady()) return t;
  const admin = createAdminClient();
  const { data: pay } = await admin
    .from("payments")
    .select("school_id, amount_kobo, receipt_no, invoices(student_id, balance_kobo, students(first_name)), schools(name)")
    .eq("id", paymentId)
    .single<{ school_id: string; amount_kobo: number; receipt_no: string; invoices: { student_id: string; balance_kobo: number; students: { first_name: string } | null } | null; schools: { name: string } | null }>();
  if (!pay?.invoices?.students) return t;
  const s = await smsSettings(admin, pay.school_id);
  if (!s.sms_enabled || !s.sms_receipts) return t;
  const phones = (await parentPhones(admin, [pay.invoices.student_id])).get(pay.invoices.student_id) ?? [];
  const left = pay.invoices.balance_kobo > 0 ? `Balance left: ${naira(pay.invoices.balance_kobo)}.` : "Fees fully paid.";
  const text = `${shortName(pay.schools?.name ?? "School")}: we received ${naira(pay.amount_kobo)} for ${pay.invoices.students.first_name}. Receipt ${pay.receipt_no}. ${left} Thank you.`;
  for (const p of phones) {
    add(t, await sendLoggedSms(admin, { school_id: pay.school_id, student_id: pay.invoices.student_id, kind: "payment_receipt", recipient: `${p} ${pay.receipt_no}`, about_date: lagosToday() }, text));
  }
  return t;
}

/** Fee reminder texts (once per parent, child and day). Returns students with no parent phone too. */
export async function smsFeeReminders(schoolId: string, studentIds: string[]): Promise<Tally & { noPhone: number; off: boolean }> {
  const t = { sent: 0, failed: 0, skipped: 0, noPhone: 0, off: false };
  const admin = createAdminClient();
  const s = await smsSettings(admin, schoolId);
  if (!smsReady() || !s.sms_enabled || !s.sms_fees) return { ...t, off: true };
  const { data: school } = await admin.from("schools").select("name").eq("id", schoolId).single<{ name: string }>();
  const { data } = await admin.from("invoices").select("student_id, balance_kobo, students(first_name)").eq("school_id", schoolId).in("student_id", studentIds).gt("balance_kobo", 0).returns<{ student_id: string; balance_kobo: number; students: { first_name: string } | null }[]>();
  const owed = new Map<string, { name: string; kobo: number }>();
  for (const i of data ?? []) {
    const cur = owed.get(i.student_id) ?? { name: i.students?.first_name ?? "your child", kobo: 0 };
    cur.kobo += i.balance_kobo;
    owed.set(i.student_id, cur);
  }
  const phones = await parentPhones(admin, [...owed.keys()]);
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.simpliskool.com").replace(/^https?:\/\//, "");
  for (const [sid, o] of owed) {
    const list = phones.get(sid) ?? [];
    if (!list.length) t.noPhone++;
    const text = `${shortName(school?.name ?? "School")}: reminder, ${o.name}'s school fees balance is ${naira(o.kobo)}. Pay or see details at ${site}/parent/fees. Already paid? Thank you, please ignore.`;
    for (const p of list) add(t, await sendLoggedSms(admin, { school_id: schoolId, student_id: sid, kind: "fee_reminder", recipient: p, about_date: lagosToday() }, text));
  }
  return t;
}

/** Absence texts for one day (once per parent, child and day). */
export async function smsAbsences(schoolId: string, date: string, classId: string | null): Promise<Tally> {
  const t = { sent: 0, failed: 0, skipped: 0 };
  if (!smsReady()) return t;
  const admin = createAdminClient();
  const s = await smsSettings(admin, schoolId);
  if (!s.sms_enabled || !s.sms_absence) return t;
  const { data: school } = await admin.from("schools").select("name, phone").eq("id", schoolId).single<{ name: string; phone: string | null }>();
  let q = admin.from("attendance").select("student_id, students(first_name)").eq("school_id", schoolId).eq("date", date).eq("status", "absent");
  if (classId) q = q.eq("class_id", classId);
  const { data: rows } = await q.returns<{ student_id: string; students: { first_name: string } | null }[]>();
  const phones = await parentPhones(admin, (rows ?? []).map((r) => r.student_id));
  const isToday = date === lagosToday();
  const when = isToday ? "today" : `on ${new Date(`${date}T12:00:00+01:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Africa/Lagos" })}`;
  for (const r of rows ?? []) {
    const text = `${shortName(school?.name ?? "School")}: ${r.students?.first_name ?? "Your child"} was marked absent ${when}. If this is a mistake, please call the school${school?.phone ? ` on ${school.phone}` : ""}.`;
    for (const p of phones.get(r.student_id) ?? []) add(t, await sendLoggedSms(admin, { school_id: schoolId, student_id: r.student_id, kind: "absence", recipient: p, about_date: date }, text));
  }
  return t;
}
