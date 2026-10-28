import Link from "next/link";
import { MobileShell } from "@/components/MobileShell";
import { classLabel } from "@/components/admin";
import { Empty } from "@/components/ui";
import { requireSchool } from "@/lib/auth";
import { STUDENT_TABS } from "@/lib/nav";
import { DAYS, hm, lagosDay, lagosHM, subjectTint, type Period } from "@/lib/timetable";

export const metadata = { title: "Timetable" };

type Slot = { day_of_week: number; period_id: string | null; room: string | null; class_subjects: { subjects: { name: string } | null; profiles: { full_name: string | null } | null } | null };

export default async function StudentTimetable(props: { searchParams: Promise<{ day?: string }> }) {
  const sp = await props.searchParams;
  const { supabase, school, user } = await requireSchool(["student"]);
  const { data: me } = await supabase.from("students").select("class_id, classes(name, arm)").eq("school_id", school.id).eq("user_id", user.id).maybeSingle<{ class_id: string | null; classes: { name: string; arm: string } | null }>();
  const today = lagosDay();
  const day = DAYS.find((d) => String(d.n) === sp.day)?.n ?? (today >= 1 && today <= 5 ? today : 1);
  const [{ data: periods }, { data: slots }] = me?.class_id
    ? await Promise.all([
        supabase.from("school_periods").select("id, label, kind, starts_at, ends_at").eq("school_id", school.id).order("starts_at").returns<Period[]>(),
        supabase.from("timetable_periods").select("day_of_week, period_id, room, class_subjects(subjects(name), profiles(full_name))").eq("class_id", me.class_id).eq("day_of_week", day).returns<Slot[]>(),
      ])
    : [{ data: [] as Period[] }, { data: [] as Slot[] }];
  const now = lagosHM();
  const cls = me?.classes ? classLabel(me.classes.name, me.classes.arm) : "";

  return (
    <MobileShell school={school} title="Timetable" subtitle={cls} tabs={STUDENT_TABS} active="timetable">
      <nav aria-label="Day" className="grid grid-cols-5 gap-1.5">
        {DAYS.map((d) => (
          <Link
            key={d.n}
            href={`/student/timetable?day=${d.n}`}
            aria-current={d.n === day ? "true" : undefined}
            className={`flex min-h-[48px] flex-col items-center justify-center rounded-xl border-[1.5px] text-sm font-bold ${d.n === day ? "border-c1 bg-c1 text-white" : "border-[#DCE5F0] bg-white text-brand-slate"}`}
          >
            {d.short}
            {d.n === today && <span className="text-[11px] font-semibold">Today</span>}
          </Link>
        ))}
      </nav>
      {!periods?.length || !slots?.length ? (
        <Empty>{me?.class_id ? "No lessons on the timetable for this day yet." : "You're not in a class yet. Please tell the school."}</Empty>
      ) : (
        <ol aria-label={`${DAYS[day - 1].name} lessons`} className="flex flex-col gap-2">
          {periods.map((p) => {
            const s = slots.find((x) => x.period_id === p.id);
            const isNow = day === today && p.starts_at.slice(0, 5) <= now && now < p.ends_at.slice(0, 5);
            if (p.kind === "break")
              return (
                <li key={p.id} className="rounded-xl bg-[#EEF3F9] px-4 py-2 text-center text-sm font-bold text-[#4A5A70]">
                  {p.label} · {hm(p.starts_at)}–{hm(p.ends_at)}
                </li>
              );
            const subj = s?.class_subjects?.subjects?.name;
            return (
              <li key={p.id} className={`flex items-center gap-3 rounded-[16px] border-[1.5px] p-3 ${isNow ? "border-c1" : "border-transparent"}`} style={{ background: subj ? subjectTint(subj) : "#FFFFFF" }}>
                <span className="w-14 flex-none text-sm font-bold text-[#34445A]">{hm(p.starts_at)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold text-brand-slate">{subj ?? "Free period"}</span>
                  {s && <span className="block truncate text-xs text-[#34445A]">{[s.class_subjects?.profiles?.full_name?.trim(), s.room].filter(Boolean).join(" · ")}</span>}
                </span>
                {isNow && <span className="rounded-full bg-c1 px-2.5 py-1 text-xs font-extrabold text-white">Now</span>}
              </li>
            );
          })}
        </ol>
      )}
    </MobileShell>
  );
}
