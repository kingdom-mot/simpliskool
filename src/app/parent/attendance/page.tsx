import Link from "next/link";
import { MobileShell } from "@/components/MobileShell";
import { classLabel } from "@/components/admin";
import { Empty } from "@/components/ui";
import { requireSchool } from "@/lib/auth";
import { PARENT_TABS } from "@/lib/nav";

export const metadata = { title: "Attendance" };

type Kid = { id: string; first_name: string; classes: { name: string; arm: string } | null };
type Day = { date: string; status: "present" | "absent" | "late"; excused?: boolean };
type Report = { id: string; from: string; to: string; reason: string; note: string | null };
const REASON: Record<string, string> = { unwell: "Unwell", family: "Family event", travel: "Travel", other: "Other" };
const lagosMonth = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit" }).format(new Date());
const nice = (iso: string, o: Intl.DateTimeFormatOptions) => new Date(`${iso}T12:00:00+01:00`).toLocaleDateString("en-GB", { timeZone: "Africa/Lagos", ...o });

export default async function ParentAttendance(props: { searchParams: Promise<{ child?: string; month?: string }> }) {
  const sp = await props.searchParams;
  const { supabase, school, user } = await requireSchool(["parent"]);
  const { data: rows } = await supabase.from("guardians").select("students(id, first_name, classes(name, arm))").eq("school_id", school.id).eq("user_id", user.id).returns<{ students: Kid | null }[]>();
  const kids = (rows ?? []).map((r) => r.students).filter((k): k is Kid => !!k).sort((a, b) => a.first_name.localeCompare(b.first_name));
  const kid = kids.find((k) => k.id === sp.child) ?? kids[0];
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : lagosMonth();
  const [y, m] = month.split("-").map(Number);
  const shift = (n: number) => {
    const d = new Date(Date.UTC(y, m - 1 + n, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  };
  const { data } = kid ? await supabase.rpc("attendance_month", { p_student: kid.id, p_month: `${month}-01` }) : { data: null };
  const att = (data as { days: Day[]; reports: Report[] } | null) ?? { days: [], reports: [] };
  const byDate = new Map(att.days.map((d) => [d.date, d]));
  const count = (s: string) => att.days.filter((d) => d.status === s).length;
  const monthName = new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

  // School days (Mon–Fri) laid out in weeks.
  const days: (string | null)[] = [];
  const first = new Date(Date.UTC(y, m - 1, 1));
  const lead = (first.getUTCDay() + 6) % 7; // Monday = 0
  for (let i = 0; i < Math.min(lead, 5); i++) days.push(null);
  for (let d = 1; d <= new Date(Date.UTC(y, m, 0)).getUTCDate(); d++) {
    const dt = new Date(Date.UTC(y, m - 1, d));
    const wd = dt.getUTCDay();
    if (wd === 0 || wd === 6) continue;
    days.push(`${month}-${String(d).padStart(2, "0")}`);
  }
  const look = (d: Day | undefined) =>
    !d ? { code: "", bg: "#FFFFFF", fg: "#4A5A70", sr: "no register" }
    : d.status === "present" ? { code: "P", bg: "#E7F6F2", fg: "#0B6B5A", sr: "present" }
    : d.status === "late" ? { code: "L", bg: "#FFF6E3", fg: "#7A5300", sr: "late" }
    : d.excused ? { code: "E", bg: "#EEF3F9", fg: "#173B70", sr: "absent, reported by you" }
    : { code: "A", bg: "#FEF3F2", fg: "#912018", sr: "absent" };
  const events = att.days.filter((d) => d.status !== "present").reverse();
  const q = (o: Record<string, string>) => `/parent/attendance?${new URLSearchParams({ child: kid?.id ?? "", month, ...o })}`;

  return (
    <MobileShell school={school} title="Attendance" tabs={PARENT_TABS} active="home">
      {!kid ? (
        <Empty>No children are linked to your account yet. Please contact the school.</Empty>
      ) : (
        <>
          {kids.length > 1 && (
            <div role="group" aria-label="Choose a child" className="flex gap-2 overflow-x-auto pb-0.5">
              {kids.map((k) => (
                <Link key={k.id} href={`/parent/attendance?child=${k.id}&month=${month}`} aria-current={k.id === kid.id ? "true" : undefined} className={`flex min-h-[44px] flex-none items-center rounded-full border-[1.5px] px-4 text-sm ${k.id === kid.id ? "border-c1 bg-c1 font-extrabold text-white" : "border-[#DCE5F0] bg-white font-semibold text-brand-slate"}`}>
                  {k.first_name}
                  {k.classes ? ` · ${classLabel(k.classes.name, k.classes.arm)}` : ""}
                </Link>
              ))}
            </div>
          )}
          <div className="grid grid-cols-3 gap-2">
            {[
              ["Present", count("present"), "#E7F6F2", "#0B6B5A"],
              ["Late", count("late"), "#FFF6E3", "#7A5300"],
              ["Absent", count("absent"), "#FEF3F2", "#912018"],
            ].map(([l, n, bg, fg]) => (
              <div key={l as string} className="flex flex-col items-center rounded-[16px] p-3" style={{ background: bg as string, color: fg as string }}>
                <span className="font-heading text-2xl font-black">{n}</span>
                <span className="text-[13px] font-bold">
                  {l} {n === 1 ? "day" : "days"}
                </span>
              </div>
            ))}
          </div>
          <section aria-labelledby="cal-h" className="flex flex-col gap-3 rounded-[18px] border border-[#E3EAF3] bg-white p-[18px]">
            <div className="flex items-center justify-between gap-2">
              <Link href={q({ month: shift(-1) })} className="flex h-11 w-11 items-center justify-center rounded-xl border-[1.5px] border-[#DCE5F0] text-lg font-bold text-c1" aria-label="Previous month">
                ‹
              </Link>
              <h2 id="cal-h" className="text-base !text-c1">
                {monthName}
              </h2>
              <Link href={q({ month: shift(1) })} className="flex h-11 w-11 items-center justify-center rounded-xl border-[1.5px] border-[#DCE5F0] text-lg font-bold text-c1" aria-label="Next month">
                ›
              </Link>
            </div>
            <table className="w-full table-fixed border-separate border-spacing-1 text-center">
              <caption className="sr-only">
                {monthName} attendance for {kid.first_name}, school days only
              </caption>
              <thead>
                <tr>
                  {["Mon", "Tue", "Wed", "Thu", "Fri"].map((d) => (
                    <th key={d} scope="col" className="text-xs font-bold text-[#4A5A70]">
                      {d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: Math.ceil(days.length / 5) }, (_, w) => (
                  <tr key={w}>
                    {Array.from({ length: 5 }, (_, i) => {
                      const iso = days[w * 5 + i];
                      if (!iso) return <td key={i} />;
                      const l = look(byDate.get(iso));
                      return (
                        <td key={i} className="h-12 rounded-lg align-middle" style={{ background: l.bg, color: l.fg, border: "1px solid #EEF3F9" }}>
                          <span className="block text-[11px] font-semibold">{Number(iso.slice(8))}</span>
                          <span className="block text-sm font-black" aria-hidden="true">
                            {l.code}
                          </span>
                          <span className="sr-only">{l.sr}</span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[13px] text-[#4A5A70]">P present · L late · A absent · E absent, reported by you · blank: no register that day</p>
          </section>
          <section aria-labelledby="ev-h" className="flex flex-col gap-2 rounded-[18px] border border-[#E3EAF3] bg-white p-[18px]">
            <h2 id="ev-h" className="text-base !text-c1">
              Absences and lateness
            </h2>
            {events.length ? (
              <ul className="flex flex-col">
                {events.map((e) => (
                  <li key={e.date} className="flex min-h-[44px] items-center justify-between gap-2 border-b border-[#EEF3F9] text-sm last:border-0">
                    <span>{nice(e.date, { weekday: "long", day: "numeric", month: "short" })}</span>
                    <span className="font-bold" style={{ color: look(e).fg }}>
                      {e.status === "late" ? "Late" : e.excused ? "Absent (reported)" : "Absent"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[#4A5A70]">None in {monthName}.</p>
            )}
            {att.reports.length > 0 && (
              <p className="text-[13px] text-[#4A5A70]">
                Reported by you: {att.reports.map((r) => `${nice(r.from, { day: "numeric", month: "short" })}${r.to !== r.from ? `–${nice(r.to, { day: "numeric", month: "short" })}` : ""} (${REASON[r.reason]})`).join(", ")}
              </p>
            )}
            <Link className="s-btn2 self-start" href={`/parent/contact?child=${kid.id}#report-h`}>
              Report an absence in advance
            </Link>
          </section>
        </>
      )}
    </MobileShell>
  );
}
