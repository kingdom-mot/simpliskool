import Link from "next/link";
import { Empty } from "@/components/ui";
import { DAYS, hm, lagosDay, lagosHM, subjectTint, type Period } from "@/lib/timetable";

type DB = Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>;
type Slot = { period_id: string | null; room: string | null; class_subjects: { teacher_id: string | null; subjects: { name: string } | null } | null };

/** One class's lessons for a day, with Monday–Friday buttons. */
export async function DayLessons({ supabase, schoolId, classId, day: wanted, href }: { supabase: DB; schoolId: string; classId: string | null; day?: string; href: (day: number) => string }) {
  const today = lagosDay();
  const day = DAYS.find((d) => String(d.n) === wanted)?.n ?? (today >= 1 && today <= 5 ? today : 1);
  const [{ data: periods }, { data: slots }] = classId
    ? await Promise.all([
        supabase.from("school_periods").select("id, label, kind, starts_at, ends_at").eq("school_id", schoolId).order("starts_at").returns<Period[]>(),
        supabase.from("timetable_periods").select("period_id, room, class_subjects(teacher_id, subjects(name))").eq("class_id", classId).eq("day_of_week", day).returns<Slot[]>(),
      ])
    : [{ data: [] as Period[] }, { data: [] as Slot[] }];
  const now = lagosHM();
  const ids = [...new Set((slots ?? []).map((s) => s.class_subjects?.teacher_id).filter((x): x is string => !!x))];
  const { data: names } = ids.length ? await supabase.rpc("staff_names", { p_ids: ids }) : { data: [] };
  const teacher = new Map(((names ?? []) as { id: string; full_name: string | null }[]).map((t) => [t.id, t.full_name]));
  return (
    <div className="flex flex-col gap-3">
      <nav aria-label="Day" className="grid grid-cols-5 gap-1.5">
        {DAYS.map((d) => (
          <Link key={d.n} href={href(d.n)} aria-current={d.n === day ? "true" : undefined} className={`flex min-h-[48px] flex-col items-center justify-center rounded-xl border-[1.5px] text-sm font-bold ${d.n === day ? "border-c1 bg-c1 text-white" : "border-[#DCE5F0] bg-white text-brand-slate"}`}>
            {d.short}
            {d.n === today && <span className="text-[11px] font-semibold">Today</span>}
          </Link>
        ))}
      </nav>
      {!periods?.length || !slots?.length ? (
        <Empty>No lessons on the timetable for this day yet.</Empty>
      ) : (
        <ol aria-label={`${DAYS[day - 1].name} lessons`} className="flex flex-col gap-2">
          {periods.map((p) => {
            if (p.kind === "break")
              return (
                <li key={p.id} className="rounded-xl bg-[#EEF3F9] px-4 py-2 text-center text-sm font-bold text-[#4A5A70]">
                  {p.label} · {hm(p.starts_at)}–{hm(p.ends_at)}
                </li>
              );
            const s = slots.find((x) => x.period_id === p.id);
            const subj = s?.class_subjects?.subjects?.name;
            const isNow = day === today && p.starts_at.slice(0, 5) <= now && now < p.ends_at.slice(0, 5);
            return (
              <li key={p.id} className={`flex items-center gap-3 rounded-[16px] border-[1.5px] p-3 ${isNow ? "border-c1" : "border-transparent"}`} style={{ background: subj ? subjectTint(subj) : "#FFFFFF" }}>
                <span className="w-14 flex-none text-sm font-bold text-[#34445A]">{hm(p.starts_at)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold text-brand-slate">{subj ?? "Free period"}</span>
                  {s && <span className="block truncate text-xs text-[#34445A]">{[teacher.get(s.class_subjects?.teacher_id ?? "")?.trim(), s.room].filter(Boolean).join(" · ")}</span>}
                </span>
                {isNow && <span className="rounded-full bg-c1 px-2.5 py-1 text-xs font-extrabold text-white">Now</span>}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
