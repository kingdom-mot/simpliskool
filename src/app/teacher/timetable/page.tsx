import { PortalShell } from "@/components/PortalShell";
import { PrintButton } from "@/components/PrintButton";
import { PageHero, classLabel } from "@/components/admin";
import { Empty } from "@/components/ui";
import { requireSchool } from "@/lib/auth";
import { TEACHER_NAV } from "@/lib/nav";
import { DAYS, hm, lagosDay, subjectTint, type Period } from "@/lib/timetable";

export const metadata = { title: "My timetable" };

type Slot = { day_of_week: number; period_id: string | null; room: string | null; classes: { name: string; arm: string } | null; class_subjects: { teacher_id: string | null; subjects: { name: string } | null } | null };

export default async function TeacherTimetable() {
  const { supabase, school, user, fullName } = await requireSchool(["teacher"]);
  const [{ data: periods }, { data: slots }] = await Promise.all([
    supabase.from("school_periods").select("id, label, kind, starts_at, ends_at").eq("school_id", school.id).order("starts_at").returns<Period[]>(),
    supabase.from("timetable_periods").select("day_of_week, period_id, room, classes(name, arm), class_subjects!inner(teacher_id, subjects(name))").eq("school_id", school.id).eq("class_subjects.teacher_id", user.id).returns<Slot[]>(),
  ]);
  const mine = slots ?? [];
  const today = lagosDay();
  const at = (d: number, pid: string) => mine.filter((s) => s.day_of_week === d && s.period_id === pid);

  return (
    <PortalShell school={school} schoolId={school.id} role="teacher" roleLabel="Teacher" fullName={fullName} groups={TEACHER_NAV} active="timetable">
      <div className="flex flex-col gap-5">
        <div className="no-print">
          <PageHero sub={`${mine.length} period${mine.length === 1 ? "" : "s"} a week · set by the school admin`} title="My timetable" actions={mine.length > 0 ? <PrintButton>Print or save as PDF</PrintButton> : undefined} />
        </div>
        {!periods?.length || !mine.length ? (
          <Empty>Your timetable will show here once the school admin builds it.</Empty>
        ) : (
          <section aria-labelledby="tt-h" className="print-area flex flex-col gap-3 rounded-[18px] border border-[#E3EAF3] bg-white p-[22px]">
            <h2 id="tt-h" className="text-lg !text-c1">
              {fullName}&apos;s weekly timetable
            </h2>
            <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Timetable: scroll sideways to see more">
              <table className="tbl min-w-[760px] table-fixed">
                <caption className="sr-only">{fullName}&apos;s weekly timetable</caption>
                <thead>
                  <tr>
                    <th scope="col" className="w-[90px]">
                      Time
                    </th>
                    {DAYS.map((d) => (
                      <th key={d.n} scope="col" className={d.n === today ? "!text-c1" : ""}>
                        {d.name}
                        {d.n === today && <span className="sr-only"> (today)</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {periods.map((p) =>
                    p.kind === "break" ? (
                      <tr key={p.id}>
                        <th scope="row">{hm(p.starts_at)}</th>
                        <td colSpan={5} className="bg-[#F5F8FC] text-center text-sm font-bold tracking-[0.08em] text-[#4A5A70]">
                          {p.label.toUpperCase()}
                        </td>
                      </tr>
                    ) : (
                      <tr key={p.id}>
                        <th scope="row" className="whitespace-nowrap">
                          {hm(p.starts_at)}
                          <span className="block text-xs font-normal text-[#4A5A70]">{p.label}</span>
                        </th>
                        {DAYS.map((d) => {
                          const list = at(d.n, p.id);
                          if (!list.length) return <td key={d.n} className="text-sm text-[#4A5A70]">Free</td>;
                          return (
                            <td key={d.n} className="!p-1.5">
                              {list.map((s, i) => (
                                <div key={i} className="rounded-xl px-2.5 py-2 text-sm" style={{ background: subjectTint(s.class_subjects?.subjects?.name ?? "") }}>
                                  <div className="font-bold text-brand-slate">
                                    {s.class_subjects?.subjects?.name} · {s.classes ? classLabel(s.classes.name, s.classes.arm) : ""}
                                  </div>
                                  {s.room && <div className="text-xs text-[#34445A]">{s.room}</div>}
                                </div>
                              ))}
                            </td>
                          );
                        })}
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </PortalShell>
  );
}
