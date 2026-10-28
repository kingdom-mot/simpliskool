import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailLayout, escapeHtml, sendEmail } from "@/lib/email";
import { schoolColours } from "@/lib/theme";

type Admin = ReturnType<typeof createAdminClient>;
type Kind = "absence" | "register_reminder" | "fee_reminder" | "fee_invoice";

export function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? `https://${process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "simpliskool.com"}`;
}

function niceDate(iso: string) {
  return new Date(`${iso}T12:00:00+01:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Lagos" });
}

/**
 * Claims the right to send one message. Returns the log row id, or null if this
 * message was already sent (or is being sent right now by another request).
 * A message that failed before is tried again.
 */
export async function claim(admin: Admin, row: { school_id: string; student_id: string | null; kind: Kind; recipient: string; about_date: string }) {
  const { data } = await admin
    .from("notifications")
    .upsert({ ...row, channel: "email", status: "failed", error: "sending" }, { onConflict: "kind,channel,recipient,about_date,student_id", ignoreDuplicates: true })
    .select("id");
  if (data?.length) return data[0].id as string;
  const { data: retry } = await admin
    .from("notifications")
    .update({ status: "failed", error: "sending", created_at: new Date().toISOString() })
    .match({ kind: row.kind, channel: "email", recipient: row.recipient, about_date: row.about_date })
    .filter("student_id", row.student_id ? "eq" : "is", row.student_id ?? "null")
    .eq("status", "failed")
    // Try again after a failure, or if an earlier attempt stopped half-way 10+ minutes ago.
    .or(`error.neq.sending,created_at.lt.${new Date(Date.now() - 10 * 60 * 1000).toISOString()}`)
    .select("id");
  return retry?.length ? (retry[0].id as string) : null;
}

export async function finish(admin: Admin, id: string, res: Awaited<ReturnType<typeof sendEmail>>) {
  await admin
    .from("notifications")
    .update(res.ok ? { status: "sent", error: null, provider_id: res.id } : { status: res.skipped ? "skipped" : "failed", error: res.error })
    .eq("id", id);
}

type School = { id: string; name: string; email: string | null; phone: string | null; primary_color: string | null; secondary_color: string | null; notify_absence_email: boolean };

async function loadSchool(admin: Admin, schoolId: string) {
  const { data } = await admin.from("schools").select("id, name, email, phone, primary_color, secondary_color, notify_absence_email").eq("id", schoolId).single<School>();
  return data;
}

/**
 * Emails the parents of every student marked absent on `date` (one class, or the
 * whole school when classId is null). Safe to call more than once: each parent
 * gets at most one email per child per day.
 */
export async function notifyAbsences(schoolId: string, date: string, classId: string | null) {
  const admin = createAdminClient();
  const school = await loadSchool(admin, schoolId);
  if (!school?.notify_absence_email) return { sent: 0, failed: 0, skipped: 0 };

  let q = admin
    .from("attendance")
    .select("student_id, students(first_name, last_name, classes(name, arm), guardians(user_id, profiles(full_name, email)))")
    .eq("school_id", schoolId)
    .eq("date", date)
    .eq("status", "absent");
  if (classId) q = q.eq("class_id", classId);
  const { data: rows } = await q.returns<
    {
      student_id: string;
      students: { first_name: string; last_name: string; classes: { name: string; arm: string } | null; guardians: { user_id: string; profiles: { full_name: string | null; email: string | null } | null }[] } | null;
    }[]
  >();

  const { c1 } = schoolColours(school.primary_color, school.secondary_color);
  const tally = { sent: 0, failed: 0, skipped: 0 };
  const contact = [school.phone, school.email].filter(Boolean).join(" or ");

  for (const r of rows ?? []) {
    const st = r.students;
    if (!st) continue;
    const child = st.first_name;
    for (const g of st.guardians) {
      const to = g.profiles?.email?.trim().toLowerCase();
      if (!to || to.endsWith("@students.simpliskool.com")) continue;
      const id = await claim(admin, { school_id: schoolId, student_id: r.student_id, kind: "absence", recipient: to, about_date: date });
      if (!id) continue;
      const parent = g.profiles?.full_name?.trim().split(/\s+/)[0];
      const when = niceDate(date);
      const isToday = date === new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date());
      const subject = isToday ? `${child} was marked absent today` : `${child} was marked absent on ${when}`;
      const lines = [
        `${parent ? `Dear ${parent},` : "Dear parent,"}`,
        `${child} ${st.last_name} was marked absent from school on ${when}.`,
        `If ${child} is unwell or you already told the school, there's nothing more to do. If you think this is a mistake, please contact the school${contact ? ` on ${contact}` : ""}.`,
      ];
      const html = emailLayout({
        schoolName: school.name,
        colour: c1,
        heading: subject,
        bodyHtml: lines.map((l) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.55">${escapeHtml(l)}</p>`).join("") +
          `<p style="margin:16px 0 0"><a href="${siteUrl()}/login" style="display:inline-block;background:${c1};color:#FFFFFF;text-decoration:none;font-weight:bold;padding:12px 18px;border-radius:10px">See attendance in the parent app</a></p>`,
        footer: `${escapeHtml(school.name)} sends this when a child is marked absent. Sent with Simpliskool.`,
      });
      const res = await sendEmail({ to, subject: `${subject} · ${school.name}`, html, text: `${lines.join("\n\n")}\n\n${siteUrl()}/login`, fromName: school.name, replyTo: school.email });
      await finish(admin, id, res);
      if (res.ok) tally.sent++;
      else if (res.skipped) tally.skipped++;
      else tally.failed++;
    }
  }
  return tally;
}

/** Emails class teachers who haven't taken today's register. */
export async function remindTeachers(schoolId: string, date: string, teachers: { email: string; name: string | null; className: string; classId: string }[]) {
  const admin = createAdminClient();
  const school = await loadSchool(admin, schoolId);
  if (!school) return { sent: 0, failed: 0, skipped: 0 };
  const { c1 } = schoolColours(school.primary_color, school.secondary_color);
  const tally = { sent: 0, failed: 0, skipped: 0 };
  for (const t of teachers) {
    const id = await claim(admin, { school_id: schoolId, student_id: null, kind: "register_reminder", recipient: t.email.toLowerCase(), about_date: date });
    if (!id) continue;
    const link = `${siteUrl()}/teacher/register?class=${t.classId}`;
    const first = t.name?.trim() || "there";
    const html = emailLayout({
      schoolName: school.name,
      colour: c1,
      heading: `Please take today's register for ${t.className}`,
      bodyHtml: `<p style="margin:0 0 12px;font-size:15px;line-height:1.55">Hello ${escapeHtml(first)}, the ${escapeHtml(t.className)} register for ${escapeHtml(niceDate(date))} hasn't been taken yet.</p>` +
        `<p style="margin:16px 0 0"><a href="${link}" style="display:inline-block;background:${c1};color:#FFFFFF;text-decoration:none;font-weight:bold;padding:12px 18px;border-radius:10px">Take the register</a></p>`,
      footer: `Sent by ${escapeHtml(school.name)} with Simpliskool.`,
    });
    const res = await sendEmail({ to: t.email, subject: `Register reminder: ${t.className}`, html, text: `Hello ${first}, please take the ${t.className} register: ${link}`, fromName: school.name, replyTo: school.email });
    await finish(admin, id, res);
    if (res.ok) tally.sent++;
    else if (res.skipped) tally.skipped++;
    else tally.failed++;
  }
  return tally;
}
