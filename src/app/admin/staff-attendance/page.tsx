import Link from "next/link";
import { AdminPage, Panel, requireAdminPage } from "@/components/admin";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Empty, ICONS, Pill, StatCard } from "@/components/ui";
import { clockStaff, setLateTime } from "./actions";

export const metadata = { title: "Staff attendance" };

type Row = { id: string; name: string; role: string; clock_in: string | null; clock_out: string | null; status: "present" | "absent" | "leave" | "duty" | null; note: string | null };
type Month = { id: string; name: string; present: number; late: number; absent: number; leave: number; duty: number; avg_in: string | null };
const TZ = "Africa/Lagos";
const lagosToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
const tm = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: TZ }).replace(" ", "").toLowerCase();
const hhmm = (iso: string) => new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: TZ }).format(new Date(iso));
const ampm = (h: string | null) => {
  if (!h) return "—";
  const [H, M] = h.split(":").map(Number);
  return `${H % 12 || 12}:${String(M).padStart(2, "0")}${H >= 12 ? "pm" : "am"}`;
};

export default async function StaffAttendancePage(props: { searchParams: Promise<{ date?: string; tab?: string; month?: string }> }) {
  const sp = await props.searchParams;
  const ctx = await requireAdminPage(["owner", "admin", "principal"]);
  const { supabase, school, membership } = ctx;
  const today = lagosToday();
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) && sp.date <= today ? sp.date : today;
  const tab = sp.tab === "month" ? "month" : "today";
  const month = sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : date.slice(0, 7);
  const canMark = membership.role === "owner" || membership.role === "principal";
  const [{ data: dayData }, { data: monthData }] = await Promise.all([
    supabase.rpc("staff_attendance_day", { p_school: school.id, p_date: date }),
    tab === "month" ? supabase.rpc("staff_attendance_month", { p_school: school.id, p_month: `${month}-01` }) : Promise.resolve({ data: null }),
  ]);
  const d = dayData as { late_after: string; staff: Row[] } | null;
  const rows = d?.staff ?? [];
  const lateAfter = d?.late_after ?? "07:45";
  const isLate = (r: Row) => !!r.clock_in && hhmm(r.clock_in) > lateAfter;
  const counts = {
    in: rows.filter((r) => r.clock_in).length,
    late: rows.filter(isLate).length,
    absent: rows.filter((r) => r.status === "absent").length,
    leave: rows.filter((r) => r.status === "leave" || r.status === "duty").length,
  };
  const longDate = new Date(`${date}T12:00:00+01:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: TZ });
  const monthName = new Date(`${month}-15T12:00:00+01:00`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: TZ });
  const status = (r: Row): [string, "good" | "warn" | "bad" | "info"] =>
    r.status === "absent" ? ["Absent", "bad"] : r.status === "leave" ? ["On leave", "info"] : r.status === "duty" ? ["Official duty", "info"] : !r.clock_in ? ["Not in yet", "info"] : r.clock_out ? [`Left at ${tm(r.clock_out)}`, "info"] : isLate(r) ? ["Late", "warn"] : ["On time", "good"];

  return (
    <AdminPage
      ctx={ctx}
      active="staffatt"
      crumb={[{ label: "People" }]}
      title="Staff attendance"
      actions={
        <form method="get" className="flex flex-wrap items-end gap-2">
          <div>
            <label className="label" htmlFor="sa-date">
              Date
            </label>
            <input className="sk-input py-2" id="sa-date" name="date" type="date" defaultValue={date} max={today} />
          </div>
          <button className="s-btn2">Show</button>
          <a className="s-btn2" href={`/admin/staff-attendance/export?month=${month}`} download>
            Download monthly report
          </a>
        </form>
      }
    >
      <p className="rounded-xl bg-[#EEF3F9] px-4 py-3 text-sm text-[#173B70]">
        Only the principal or head teacher (or the school owner) can clock staff in and out. Staff can see their own record but can&apos;t change it. Every change is kept in the school&apos;s activity log.
      </p>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard tone="teal" icon={ICONS.check} label="Clocked in" value={`${counts.in} / ${rows.length}`} sub={longDate} />
        <StatCard tone="amber" icon={ICONS.clock} label={`Late (after ${ampm(lateAfter)})`} value={String(counts.late)} sub="Clocked in after the late time" />
        <StatCard tone="pink" icon={ICONS.users} label="Absent" value={String(counts.absent)} sub="Marked absent" />
        <StatCard tone="blue" icon={ICONS.book} label="On leave or duty" value={String(counts.leave)} sub="Away with permission" />
      </div>

      <nav aria-label="View" className="flex flex-wrap gap-2">
        {[
          ["today", date === today ? "Today" : longDate],
          ["month", "This month"],
        ].map(([k, l]) => (
          <Link key={k} href={`/admin/staff-attendance?${new URLSearchParams({ date, tab: k })}`} aria-current={tab === k ? "page" : undefined} className={`flex min-h-[44px] items-center rounded-xl border-[1.5px] px-4 text-sm font-bold ${tab === k ? "border-c1 bg-c1 text-white" : "border-[#DCE5F0] bg-white text-brand-slate"}`}>
            {l}
          </Link>
        ))}
      </nav>

      {tab === "today" ? (
        <Panel id="day-h" title={`Staff clock-in and clock-out for ${longDate}`}>
          {rows.length ? (
            <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Staff attendance: scroll sideways to see more">
              <table className="tbl min-w-[900px]">
                <caption className="sr-only">Staff clock-in and clock-out for {longDate}</caption>
                <thead>
                  <tr>
                    <th scope="col">Staff</th>
                    <th scope="col">Role</th>
                    <th scope="col">Clock in</th>
                    <th scope="col">Clock out</th>
                    <th scope="col">Status</th>
                    <th scope="col">Other</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const [st, kind] = status(r);
                    return (
                      <tr key={r.id}>
                        <th scope="row">{r.name}</th>
                        <td>{r.role}</td>
                        <td>
                          {r.clock_in ? (
                            <span className={isLate(r) ? "font-bold text-[#7A5300]" : "font-bold"}>{tm(r.clock_in)}</span>
                          ) : canMark && date === today && r.status !== "leave" && r.status !== "absent" ? (
                            <ActionForm action={clockStaff}>
                              <input type="hidden" name="user" value={r.id} />
                              <input type="hidden" name="date" value={date} />
                              <input type="hidden" name="action" value="in" />
                              <SubmitButton className="s-btn2" pending="…">
                                Clock in<span className="sr-only"> {r.name}</span>
                              </SubmitButton>
                            </ActionForm>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>
                          {r.clock_out ? (
                            <span className="font-bold">{tm(r.clock_out)}</span>
                          ) : canMark && date === today && r.clock_in ? (
                            <ActionForm action={clockStaff}>
                              <input type="hidden" name="user" value={r.id} />
                              <input type="hidden" name="date" value={date} />
                              <input type="hidden" name="action" value="out" />
                              <SubmitButton className="s-btn2" pending="…">
                                Clock out<span className="sr-only"> {r.name}</span>
                              </SubmitButton>
                            </ActionForm>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>
                          <Pill kind={kind}>{st}</Pill>
                          {r.note && <span className="block text-xs text-[#4A5A70]">{r.note}</span>}
                        </td>
                        <td>
                          {canMark ? (
                            <ActionForm action={clockStaff} className="flex flex-wrap items-center gap-1.5">
                              <input type="hidden" name="user" value={r.id} />
                              <input type="hidden" name="date" value={date} />
                              <label className="sr-only" htmlFor={`o-${r.id}`}>
                                Mark {r.name} as
                              </label>
                              <select id={`o-${r.id}`} name="action" className="sk-input sk-select py-2" defaultValue="">
                                <option value="" disabled>
                                  —
                                </option>
                                <option value="absent">Absent</option>
                                <option value="leave">On leave</option>
                                <option value="duty">Official duty</option>
                              </select>
                              <SubmitButton className="s-btn2" pending="…">
                                Mark<span className="sr-only"> {r.name}</span>
                              </SubmitButton>
                            </ActionForm>
                          ) : (
                            <span className="text-xs text-[#4A5A70]">Principal marks</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>No staff yet. Invite staff on the Staff page.</Empty>
          )}
          {membership.role === "owner" && (
            <ActionForm action={setLateTime} className="flex flex-wrap items-end gap-2 border-t border-[#EEF3F9] pt-3">
              <div>
                <label className="label" htmlFor="late">
                  Staff are late after
                </label>
                <input id="late" name="late_after" type="time" className="sk-input py-2" defaultValue={lateAfter} />
              </div>
              <SubmitButton className="s-btn2">Save time</SubmitButton>
            </ActionForm>
          )}
        </Panel>
      ) : (
        <Panel id="mon-h" title={`Staff attendance summary for ${monthName}`}>
          <form method="get" className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="tab" value="month" />
            <div>
              <label className="label" htmlFor="sa-month">
                Month
              </label>
              <input id="sa-month" name="month" type="month" className="sk-input py-2" defaultValue={month} max={today.slice(0, 7)} />
            </div>
            <button className="s-btn2">Show</button>
          </form>
          {(monthData as Month[] | null)?.length ? (
            <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Monthly summary: scroll sideways to see more">
              <table className="tbl min-w-[700px]">
                <caption className="sr-only">Staff attendance summary for {monthName}</caption>
                <thead>
                  <tr>
                    <th scope="col">Staff</th>
                    <th scope="col">Days present</th>
                    <th scope="col">Late</th>
                    <th scope="col">Absent</th>
                    <th scope="col">Leave or duty</th>
                    <th scope="col">Average clock in</th>
                  </tr>
                </thead>
                <tbody>
                  {(monthData as Month[]).map((m) => (
                    <tr key={m.id}>
                      <th scope="row">{m.name}</th>
                      <td>{m.present}</td>
                      <td className={m.late ? "font-bold text-[#7A5300]" : ""}>{m.late}</td>
                      <td className={m.absent ? "font-bold text-[#912018]" : ""}>{m.absent}</td>
                      <td>{m.leave + m.duty}</td>
                      <td>{ampm(m.avg_in)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>No staff yet.</Empty>
          )}
        </Panel>
      )}
    </AdminPage>
  );
}
