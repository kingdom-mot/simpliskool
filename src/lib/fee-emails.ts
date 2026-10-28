import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailLayout, escapeHtml, sendEmail } from "@/lib/email";
import { naira, TERM_NAME } from "@/lib/format";
import { METHOD_LABEL } from "@/lib/fees";
import { claim, finish, siteUrl } from "@/lib/notify";
import { schoolColours } from "@/lib/theme";
import { optedOut } from "@/lib/optouts";

type Admin = ReturnType<typeof createAdminClient>;
type Tally = { sent: number; failed: number; skipped: number };
type School = { id: string; name: string; email: string | null; phone: string | null; primary_color: string | null; secondary_color: string | null; payment_instructions: string | null };
type Parent = { email: string; first: string | null };

const P = (t: string) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.55">${t}</p>`;
const lagosToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date());
const niceDate = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00+01:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" });

async function loadSchool(admin: Admin, id: string) {
  const { data } = await admin.from("schools").select("id, name, email, phone, primary_color, secondary_color, payment_instructions").eq("id", id).single<School>();
  return data;
}

/** Parents of these students with a real email address. */
async function parentsOf(admin: Admin, studentIds: string[]) {
  const out = new Map<string, Parent[]>();
  if (!studentIds.length) return out;
  const { data } = await admin
    .from("guardians")
    .select("student_id, user_id, profiles(full_name, email)")
    .in("student_id", studentIds)
    .returns<{ student_id: string; user_id: string; profiles: { full_name: string | null; email: string | null } | null }[]>();
  const off = await optedOut(admin, (data ?? []).map((g) => g.user_id), "email");
  for (const g of data ?? []) {
    if (off.has(g.user_id)) continue;
    const email = g.profiles?.email?.trim().toLowerCase();
    if (!email || email.endsWith("@students.simpliskool.com")) continue;
    const list = out.get(g.student_id) ?? [];
    if (!list.some((p) => p.email === email)) list.push({ email, first: g.profiles?.full_name?.trim().split(/\s+/)[0] || null });
    out.set(g.student_id, list);
  }
  return out;
}

function howToPay(school: School) {
  const lines = [];
  if (school.payment_instructions) lines.push(P(`<strong>How to pay:</strong><br>${escapeHtml(school.payment_instructions).replace(/\n/g, "<br>")}`));
  const contact = [school.phone, school.email].filter(Boolean).join(" or ");
  if (contact) lines.push(P(`Questions? Contact the school on ${escapeHtml(contact)}.`));
  return lines.join("");
}

function button(c1: string, href: string, label: string) {
  return `<p style="margin:16px 0 0"><a href="${href}" style="display:inline-block;background:${c1};color:#FFFFFF;text-decoration:none;font-weight:bold;padding:12px 18px;border-radius:10px">${escapeHtml(label)}</a></p>`;
}

function count(t: Tally, res: Awaited<ReturnType<typeof sendEmail>>) {
  if (res.ok) t.sent++;
  else if (res.skipped) t.skipped++;
  else t.failed++;
}

type InvoiceRow = {
  id: string;
  student_id: string;
  total_kobo: number;
  paid_kobo: number;
  balance_kobo: number;
  students: { first_name: string; last_name: string } | null;
  invoice_lines: { name: string; amount_kobo: number; position: number }[];
  terms: { term_no: number; academic_sessions: { name: string } | null } | null;
};

function linesTable(lines: { name: string; amount_kobo: number; position: number }[]) {
  const rows = [...lines]
    .sort((a, b) => a.position - b.position)
    .map((l) => `<tr><td style="padding:6px 0;border-bottom:1px solid #EEF3F9">${escapeHtml(l.name)}</td><td align="right" style="padding:6px 0;border-bottom:1px solid #EEF3F9">${naira(l.amount_kobo)}</td></tr>`)
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;margin:0 0 12px">${rows}</table>`;
}

/** Emails each parent their child's bill for the term (once per parent, child and day). */
export async function sendInvoiceEmails(schoolId: string, termId: string): Promise<Tally> {
  const admin = createAdminClient();
  const school = await loadSchool(admin, schoolId);
  const tally = { sent: 0, failed: 0, skipped: 0 };
  if (!school) return tally;
  const { data: due } = await admin.from("fee_terms").select("due_on").eq("term_id", termId).maybeSingle<{ due_on: string | null }>();
  const { data } = await admin
    .from("invoices")
    .select("id, student_id, total_kobo, paid_kobo, balance_kobo, students(first_name, last_name), invoice_lines(name, amount_kobo, position), terms(term_no, academic_sessions(name))")
    .eq("term_id", termId)
    .eq("school_id", schoolId)
    .gt("balance_kobo", 0)
    .returns<InvoiceRow[]>();
  const parents = await parentsOf(admin, (data ?? []).map((i) => i.student_id));
  const { c1 } = schoolColours(school.primary_color, school.secondary_color);
  const today = lagosToday();

  for (const inv of data ?? []) {
    const st = inv.students;
    if (!st) continue;
    const term = inv.terms ? `${TERM_NAME[inv.terms.term_no]} ${inv.terms.academic_sessions?.name ?? ""}`.trim() : "this term";
    for (const p of parents.get(inv.student_id) ?? []) {
      const id = await claim(admin, { school_id: schoolId, student_id: inv.student_id, kind: "fee_invoice", recipient: p.email, about_date: today });
      if (!id) continue;
      const heading = `${st.first_name}'s fees for ${term}`;
      const body =
        P(`${p.first ? `Dear ${escapeHtml(p.first)},` : "Dear parent,"}`) +
        P(`Here is ${escapeHtml(st.first_name)} ${escapeHtml(st.last_name)}'s bill for ${escapeHtml(term)}.`) +
        linesTable(inv.invoice_lines) +
        P(`<strong>Total: ${naira(inv.total_kobo)}</strong>${inv.paid_kobo ? ` · Paid: ${naira(inv.paid_kobo)} · <strong>Balance: ${naira(inv.balance_kobo)}</strong>` : ""}`) +
        (due?.due_on ? P(`Please pay by ${niceDate(due.due_on)}.`) : "") +
        howToPay(school) +
        button(c1, `${siteUrl()}/parent/fees`, "See the bill in the parent app");
      const html = emailLayout({ schoolName: school.name, colour: c1, heading, bodyHtml: body, footer: `Sent by ${escapeHtml(school.name)} with Simpliskool.` });
      const text = `${heading}\n\nTotal: ${naira(inv.total_kobo)}. Balance: ${naira(inv.balance_kobo)}.${school.payment_instructions ? `\n\nHow to pay:\n${school.payment_instructions}` : ""}\n\n${siteUrl()}/parent/fees`;
      const res = await sendEmail({ to: p.email, subject: `${heading} · ${school.name}`, html, text, fromName: school.name, replyTo: school.email });
      await finish(admin, id, res);
      count(tally, res);
    }
  }
  return tally;
}

/** Emails each parent of these students their full balance (once per parent, child and day). */
export async function sendFeeReminders(schoolId: string, studentIds: string[]): Promise<Tally & { noEmail: number }> {
  const admin = createAdminClient();
  const school = await loadSchool(admin, schoolId);
  const tally = { sent: 0, failed: 0, skipped: 0, noEmail: 0 };
  if (!school || !studentIds.length) return tally;
  const { data } = await admin
    .from("invoices")
    .select("id, student_id, total_kobo, paid_kobo, balance_kobo, students(first_name, last_name), invoice_lines(name, amount_kobo, position), terms(term_no, academic_sessions(name))")
    .eq("school_id", schoolId)
    .in("student_id", studentIds)
    .gt("balance_kobo", 0)
    .returns<InvoiceRow[]>();
  const byStudent = new Map<string, InvoiceRow[]>();
  for (const i of data ?? []) byStudent.set(i.student_id, [...(byStudent.get(i.student_id) ?? []), i]);
  const parents = await parentsOf(admin, [...byStudent.keys()]);
  const { c1 } = schoolColours(school.primary_color, school.secondary_color);
  const today = lagosToday();

  for (const [studentId, invs] of byStudent) {
    const st = invs[0].students;
    if (!st) continue;
    const list = parents.get(studentId) ?? [];
    if (!list.length) tally.noEmail++;
    const total = invs.reduce((a, i) => a + i.balance_kobo, 0);
    const rows = invs
      .map((i) => `<tr><td style="padding:6px 0;border-bottom:1px solid #EEF3F9">${i.terms ? `${TERM_NAME[i.terms.term_no]} ${escapeHtml(i.terms.academic_sessions?.name ?? "")}` : "Fees"}</td><td align="right" style="padding:6px 0;border-bottom:1px solid #EEF3F9">${naira(i.balance_kobo)}</td></tr>`)
      .join("");
    for (const p of list) {
      const id = await claim(admin, { school_id: schoolId, student_id: studentId, kind: "fee_reminder", recipient: p.email, about_date: today });
      if (!id) continue;
      const heading = `${st.first_name}'s school fees: ${naira(total)} to pay`;
      const body =
        P(`${p.first ? `Dear ${escapeHtml(p.first)},` : "Dear parent,"}`) +
        P(`This is a friendly reminder that ${escapeHtml(st.first_name)} ${escapeHtml(st.last_name)} has ${naira(total)} of school fees left to pay.`) +
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;margin:0 0 12px">${rows}</table>` +
        P("If you've already paid, thank you, and please ignore this email; the school will record it.") +
        howToPay(school) +
        button(c1, `${siteUrl()}/parent/fees`, "See the balance in the parent app");
      const html = emailLayout({ schoolName: school.name, colour: c1, heading, bodyHtml: body, footer: `Sent by ${escapeHtml(school.name)} with Simpliskool.` });
      const res = await sendEmail({ to: p.email, subject: `${heading} · ${school.name}`, html, text: `${heading}.\n\n${school.payment_instructions ?? ""}\n\n${siteUrl()}/parent/fees`, fromName: school.name, replyTo: school.email });
      await finish(admin, id, res);
      count(tally, res);
    }
  }
  return tally;
}

/** Emails the receipt for one payment to the student's parents. */
export async function sendReceiptEmail(paymentId: string): Promise<Tally & { noEmail: boolean }> {
  const admin = createAdminClient();
  const tally = { sent: 0, failed: 0, skipped: 0, noEmail: false };
  const { data: pay } = await admin
    .from("payments")
    .select("id, school_id, amount_kobo, method, receipt_no, paid_at, reference, invoices(student_id, total_kobo, paid_kobo, balance_kobo, students(first_name, last_name), terms(term_no, academic_sessions(name)))")
    .eq("id", paymentId)
    .single<{
      id: string;
      school_id: string;
      amount_kobo: number;
      method: string;
      receipt_no: string;
      paid_at: string;
      reference: string | null;
      invoices: { student_id: string; total_kobo: number; paid_kobo: number; balance_kobo: number; students: { first_name: string; last_name: string } | null; terms: { term_no: number; academic_sessions: { name: string } | null } | null } | null;
    }>();
  const inv = pay?.invoices;
  if (!pay || !inv?.students) return tally;
  const school = await loadSchool(admin, pay.school_id);
  if (!school) return tally;
  const parents = (await parentsOf(admin, [inv.student_id])).get(inv.student_id) ?? [];
  if (!parents.length) return { ...tally, noEmail: true };
  const { c1 } = schoolColours(school.primary_color, school.secondary_color);
  const term = inv.terms ? `${TERM_NAME[inv.terms.term_no]} ${inv.terms.academic_sessions?.name ?? ""}`.trim() : "school fees";
  const link = `${siteUrl()}/receipt/${pay.id}`;
  for (const p of parents) {
    const heading = `Receipt ${pay.receipt_no}: ${naira(pay.amount_kobo)} received`;
    const row = (k: string, v: string) => `<tr><td style="padding:6px 0;color:#4A5A70;border-bottom:1px solid #EEF3F9">${k}</td><td align="right" style="padding:6px 0;border-bottom:1px solid #EEF3F9"><strong>${v}</strong></td></tr>`;
    const body =
      P(`${p.first ? `Dear ${escapeHtml(p.first)},` : "Dear parent,"}`) +
      P(`Thank you. ${escapeHtml(school.name)} has received a payment for ${escapeHtml(inv.students.first_name)} ${escapeHtml(inv.students.last_name)}.`) +
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;margin:0 0 12px">` +
      row("Receipt number", escapeHtml(pay.receipt_no)) +
      row("For", escapeHtml(term)) +
      row("Amount", naira(pay.amount_kobo)) +
      row("Paid by", escapeHtml(METHOD_LABEL[pay.method] ?? pay.method)) +
      row("Date", niceDate(pay.paid_at)) +
      row("Balance left", inv.balance_kobo > 0 ? naira(inv.balance_kobo) : "Paid in full") +
      `</table>` +
      button(c1, link, "View or print the receipt");
    const html = emailLayout({ schoolName: school.name, colour: c1, heading, bodyHtml: body, footer: `Sent by ${escapeHtml(school.name)} with Simpliskool.` });
    const res = await sendEmail({ to: p.email, subject: `${heading} · ${school.name}`, html, text: `${heading} for ${inv.students.first_name} (${term}). Balance left: ${naira(Math.max(inv.balance_kobo, 0))}. Receipt: ${link}`, fromName: school.name, replyTo: school.email });
    count(tally, res);
  }
  if (tally.sent) await admin.from("payments").update({ receipt_emailed_at: new Date().toISOString() }).eq("id", pay.id);
  return tally;
}
