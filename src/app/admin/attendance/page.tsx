import Link from "next/link";
import { AdminPage, Panel, requireAdminPage } from "@/components/admin";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Empty, ICONS, Pill, StatCard } from "@/components/ui";
import { emailReady } from "@/lib/email";
import { pct } from "@/lib/format";
import { remindMissingRegisters, sendAbsenceEmails, sendAbsenceTexts, setAbsenceEmails } from "./actions";
import { smsReady } from "@/lib/sms";
import { Flash } from "@/components/Flash";

type Overview = {
  date: string;
  students: number;
  present: number;
  absent: number;
  late: number;
  notify_absence_email: boolean;
  classes: { id: string; name: string; teacher: string | null; teacher_email: string | null; students: number; marked: number; present: number; absent: number; late: number; taken_at: string | null; reminded: boolean }[];
  missing: { id: string; name: string; class: string; status: "absent" | "late"; absences_this_term: number; parents_with_email: number; emailed: number }[];
};

function lagosToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date());
}
function time(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Africa/Lagos" }).replace(" ", "").toLowerCase();
}

export default async function AttendancePage(props: { searchParams: Promise<{ date?: string }> }) {
  const sp = await props.searchParams;
  const ctx = await requireAdminPage();
  const { supabase, school, membership } = ctx;
  const today = lagosToday();
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) && sp.date <= today ? sp.date : today;
  const { data } = await supabase.rpc("attendance_overview", { p_school: school.id, p_date: date });
  const o = data as Overview | null;
  const ready = emailReady();

  const classes = o?.classes ?? [];
  const taken = classes.filter((c) => c.marked > 0).length;
  const notTaken = classes.filter((c) => c.marked === 0);
  const marked = (o?.present ?? 0) + (o?.absent ?? 0) + (o?.late ?? 0);
  const absent = (o?.missing ?? []).filter((m) => m.status === "absent");
  const notEmailed = absent.filter((m) => m.parents_with_email > m.emailed).length;
  // Texts: only when the school has SMS absence alerts on.
  let notTexted = 0;
  if (smsReady() && absent.length) {
    const [{ data: sms }, { data: sent }] = await Promise.all([
      supabase.from("schools").select("sms_enabled, sms_absence").eq("id", school.id).maybeSingle<{ sms_enabled: boolean; sms_absence: boolean }>(),
      supabase.from("notifications").select("student_id").eq("school_id", school.id).eq("kind", "absence").eq("channel", "sms").eq("about_date", date).eq("status", "sent").returns<{ student_id: string }[]>(),
    ]);
    const texted = new Set((sent ?? []).map((r) => r.student_id));
    if (sms?.sms_enabled && sms.sms_absence) notTexted = absent.filter((m) => !texted.has(m.id)).length;
  }
  const longDate = new Date(`${date}T12:00:00+01:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Lagos" });

  return (
    <AdminPage
      ctx={ctx}
      active="attendance"
      crumb={[{ label: "Academics" }]}
      title="Attendance"
      actions={
        <form method="get" className="flex flex-wrap items-end gap-2">
          <div>
            <label className="label" htmlFor="a-date">Date</label>
            <input className="sk-input py-2" id="a-date" name="date" type="date" defaultValue={date} max={today} />
          </div>
          <button className="s-btn2">Show</button>
        </form>
      }
    >
      <p className="-mt-2 text-sm text-[#4A5A70]">{longDate}{date === today ? " · today" : ""}</p>
      <Flash />

      {!ready && (
        <p role="status" className="rounded-xl bg-[#FFF6E3] px-4 py-3 text-sm text-[#5C4310]">
          <strong>Emails to parents aren&apos;t switched on yet.</strong> Attendance is saved as normal; absence emails and register reminders start once email is set up.
        </p>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard tone="teal" icon={ICONS.check} label="Present" value={String(o?.present ?? 0)} percent={pct(o?.present ?? 0, marked)} sub={marked ? `${pct(o?.present ?? 0, marked)}% of marked students present` : "No registers yet"} />
        <StatCard tone="pink" icon={ICONS.users} label="Absent" value={String(o?.absent ?? 0)} sub={absent.length ? `${absent.length - notEmailed} of ${absent.length} with parents emailed` : "Nobody absent"} />
        <StatCard tone="amber" icon={ICONS.clock} label="Late" value={String(o?.late ?? 0)} sub="Arrived after the register" />
        <StatCard tone="blue" icon={ICONS.book} label="Registers taken" value={`${taken} / ${classes.length}`} percent={pct(taken, classes.length)} sub={notTaken.length ? `${notTaken.length} class${notTaken.length === 1 ? "" : "es"} waiting` : "Every class done"} />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Panel
          id="by-h"
          title="By class"
          actions={
            notTaken.length > 0 && date === today ? (
              <ActionForm action={remindMissingRegisters} className="flex flex-col items-end gap-2">
                <input type="hidden" name="date" value={date} />
                <SubmitButton pending="Sending…">Remind teachers who haven&apos;t marked</SubmitButton>
              </ActionForm>
            ) : null
          }
        >
          {classes.length ? (
            <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Table: scroll sideways to see more">
              <table className="tbl min-w-[640px]">
                <caption className="sr-only">Register for each class on {longDate}</caption>
                <thead>
                  <tr>
                    <th scope="col">Class</th>
                    <th scope="col">Class teacher</th>
                    <th scope="col">Register</th>
                    <th scope="col">Present</th>
                    <th scope="col">Absent</th>
                    <th scope="col">Late</th>
                  </tr>
                </thead>
                <tbody>
                  {classes.map((c) => (
                    <tr key={c.id}>
                      <th scope="row">{c.name}</th>
                      <td>{c.teacher ?? <span className="text-[#4A5A70]">None set</span>}</td>
                      <td>
                        {c.marked ? (
                          <Pill kind="good">Taken {c.taken_at ? time(c.taken_at) : ""}</Pill>
                        ) : c.reminded ? (
                          <Pill kind="warn">Reminded</Pill>
                        ) : (
                          <Pill kind="bad">Not taken</Pill>
                        )}
                      </td>
                      <td>{c.marked ? c.present : "—"}</td>
                      <td>{c.marked ? c.absent : "—"}</td>
                      <td>{c.marked ? c.late : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>
              No classes with students yet.{" "}
              <Link className="s-link" href="/admin/students">
                Add students
              </Link>
            </Empty>
          )}
        </Panel>

        <Panel
          id="ab-h"
          title={`Absent and late (${o?.missing.length ?? 0})`}
          actions={
            (ready && o?.notify_absence_email && notEmailed > 0) || notTexted > 0 ? (
              <div className="flex flex-wrap justify-end gap-2">
                {ready && o?.notify_absence_email && notEmailed > 0 && (
                  <ActionForm action={sendAbsenceEmails} className="flex flex-col items-end gap-2">
                    <input type="hidden" name="date" value={date} />
                    <SubmitButton className="s-btn2" pending="Sending…">
                      Email {notEmailed} parent{notEmailed === 1 ? "" : "s"} now
                    </SubmitButton>
                  </ActionForm>
                )}
                {notTexted > 0 && (
                  <ActionForm action={sendAbsenceTexts} className="flex flex-col items-end gap-2">
                    <input type="hidden" name="date" value={date} />
                    <SubmitButton className="s-btn2" pending="Texting…">
                      Text parents of {notTexted} child{notTexted === 1 ? "" : "ren"}
                    </SubmitButton>
                  </ActionForm>
                )}
              </div>
            ) : null
          }
        >
          {o?.missing.length ? (
            <ul className="flex flex-col">
              {o.missing.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EEF3F9] py-2.5">
                  <span>
                    <Link href={`/admin/students/${m.id}`} className="font-bold text-c1 hover:underline">
                      {m.name}
                    </Link>
                    <span className="block text-[13px] text-[#4A5A70]">
                      {m.class}
                      {m.status === "absent" && m.absences_this_term > 1 ? ` · ${m.absences_this_term} absences this term` : ""}
                    </span>
                  </span>
                  <span className="flex flex-wrap gap-1.5">
                    {m.status === "late" ? (
                      <Pill kind="warn">Late</Pill>
                    ) : (
                      <>
                        <Pill kind="bad">Absent</Pill>
                        {m.emailed > 0 ? (
                          <Pill kind="good">Parent emailed</Pill>
                        ) : m.parents_with_email === 0 ? (
                          <Pill kind="info">No parent email</Pill>
                        ) : (
                          <Pill kind="warn">Not emailed yet</Pill>
                        )}
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>{marked ? "Everyone marked is present." : "Nothing yet. Absent and late students show here as registers come in."}</Empty>
          )}
          <p className="text-[13px] text-[#4A5A70]">Parents get one email per child per day when their child is marked absent. Late arrivals don&apos;t send an email.</p>
        </Panel>
      </div>

      <Panel id="set-h" title="Absence emails to parents">
        <ActionForm action={setAbsenceEmails} className="flex flex-col gap-3">
          <input type="hidden" name="on" value={o?.notify_absence_email ? "0" : "1"} />
          <p className="text-[15px]">
            {o?.notify_absence_email ? "On: parents get an email when their child is marked absent." : "Off: parents are not emailed about absences."}
          </p>
          {membership.role === "principal" ? (
            <p className="text-sm text-[#4A5A70]">Only the owner or an admin can change this.</p>
          ) : (
            <div>
              <SubmitButton className={o?.notify_absence_email ? "s-btn2" : "s-btn"}>{o?.notify_absence_email ? "Turn off absence emails" : "Turn on absence emails"}</SubmitButton>
            </div>
          )}
        </ActionForm>
      </Panel>
    </AdminPage>
  );
}
