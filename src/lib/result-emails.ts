import "server-only";
import { optedOut } from "@/lib/optouts";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailLayout, escapeHtml, sendEmail } from "@/lib/email";
import { TERM_NAME } from "@/lib/format";
import { claim, finish, siteUrl } from "@/lib/notify";
import { schoolColours } from "@/lib/theme";

type Tally = { sent: number; failed: number; skipped: number; noEmail: number };
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date());
const P = (t: string) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.55">${t}</p>`;
const button = (c1: string, href: string, label: string) =>
  `<p style="margin:16px 0 0"><a href="${href}" style="display:inline-block;background:${c1};color:#FFFFFF;text-decoration:none;font-weight:bold;padding:12px 18px;border-radius:10px">${escapeHtml(label)}</a></p>`;

async function school(admin: ReturnType<typeof createAdminClient>, id: string) {
  const { data } = await admin.from("schools").select("name, email, primary_color, secondary_color").eq("id", id).single<{ name: string; email: string | null; primary_color: string | null; secondary_color: string | null }>();
  return data;
}

function count(t: Tally, res: Awaited<ReturnType<typeof sendEmail>>) {
  if (res.ok) t.sent++;
  else if (res.skipped) t.skipped++;
  else t.failed++;
}

/** Tells parents in a class that report cards are out (once per parent, child and day). */
export async function sendReportCardEmails(schoolId: string, classId: string, termId: string): Promise<Tally> {
  const admin = createAdminClient();
  const tally = { sent: 0, failed: 0, skipped: 0, noEmail: 0 };
  const s = await school(admin, schoolId);
  const { data: term } = await admin.from("terms").select("term_no, academic_sessions(name)").eq("id", termId).single<{ term_no: number; academic_sessions: { name: string } | null }>();
  if (!s || !term) return tally;
  const termName = `${TERM_NAME[term.term_no]} ${term.academic_sessions?.name ?? ""}`.trim();
  const { data: cards } = await admin
    .from("report_cards")
    .select("student_id, students(first_name, last_name, guardians(user_id, profiles(full_name, email)))")
    .eq("class_id", classId)
    .eq("term_id", termId)
    .not("released_at", "is", null)
    .returns<{ student_id: string; students: { first_name: string; last_name: string; guardians: { user_id: string; profiles: { full_name: string | null; email: string | null } | null }[] } | null }[]>();
  const off = await optedOut(admin, (cards ?? []).flatMap((c) => c.students?.guardians.map((g) => g.user_id) ?? []), "email");
  const { c1 } = schoolColours(s.primary_color, s.secondary_color);
  for (const c of cards ?? []) {
    const st = c.students;
    if (!st) continue;
    const parents = st.guardians
      .filter((g) => !off.has(g.user_id))
      .map((g) => ({ email: g.profiles?.email?.trim().toLowerCase() ?? "", first: g.profiles?.full_name?.trim().split(/\s+/)[0] || null }))
      .filter((p) => p.email && !p.email.endsWith("@students.simpliskool.com"));
    if (!parents.length) tally.noEmail++;
    for (const p of parents) {
      const id = await claim(admin, { school_id: schoolId, student_id: c.student_id, kind: "report_card", recipient: p.email, about_date: today() });
      if (!id) continue;
      const heading = `${st.first_name}'s ${termName} report card is ready`;
      const html = emailLayout({
        schoolName: s.name,
        colour: c1,
        heading,
        bodyHtml:
          P(p.first ? `Dear ${escapeHtml(p.first)},` : "Dear parent,") +
          P(`${escapeHtml(st.first_name)} ${escapeHtml(st.last_name)}'s report card for ${escapeHtml(termName)} is now available. You can see every subject, the class teacher's and principal's comments, and download or print the report card.`) +
          button(c1, `${siteUrl()}/parent/results?child=${c.student_id}`, "See the results"),
        footer: `Sent by ${escapeHtml(s.name)} with Simpliskool.`,
      });
      const res = await sendEmail({ to: p.email, subject: `${heading} · ${s.name}`, html, text: `${heading}. ${siteUrl()}/parent/results?child=${c.student_id}`, fromName: s.name, replyTo: s.email });
      await finish(admin, id, res);
      count(tally, res);
    }
  }
  return tally;
}

/** One email per teacher listing the subjects whose scores aren't finished (once a day). */
export async function sendScoreReminders(schoolId: string, items: { email: string; name: string | null; subject: string; className: string; classSubjectId: string }[]): Promise<Tally> {
  const admin = createAdminClient();
  const tally = { sent: 0, failed: 0, skipped: 0, noEmail: 0 };
  const s = await school(admin, schoolId);
  if (!s) return tally;
  const { c1 } = schoolColours(s.primary_color, s.secondary_color);
  const byTeacher = new Map<string, typeof items>();
  for (const i of items) byTeacher.set(i.email.toLowerCase(), [...(byTeacher.get(i.email.toLowerCase()) ?? []), i]);
  for (const [email, list] of byTeacher) {
    const id = await claim(admin, { school_id: schoolId, student_id: null, kind: "score_reminder", recipient: email, about_date: today() });
    if (!id) continue;
    const first = list[0].name?.trim() || "there";
    const lines = list.map((l) => `<li style="margin:0 0 6px"><a href="${siteUrl()}/teacher/scores?cs=${l.classSubjectId}">${escapeHtml(l.className)} · ${escapeHtml(l.subject)}</a></li>`).join("");
    const html = emailLayout({
      schoolName: s.name,
      colour: c1,
      heading: "Please finish entering scores",
      bodyHtml: P(`Hello ${escapeHtml(first)}, these scores aren't finished yet:`) + `<ul style="font-size:15px;line-height:1.5;padding-left:20px">${lines}</ul>` + button(c1, `${siteUrl()}/teacher/scores`, "Enter scores"),
      footer: `Sent by ${escapeHtml(s.name)} with Simpliskool.`,
    });
    const res = await sendEmail({ to: email, subject: `Scores reminder · ${s.name}`, html, text: `Please finish entering scores: ${list.map((l) => `${l.className} ${l.subject}`).join(", ")}. ${siteUrl()}/teacher/scores`, fromName: s.name, replyTo: s.email });
    await finish(admin, id, res);
    count(tally, res);
  }
  return tally;
}
