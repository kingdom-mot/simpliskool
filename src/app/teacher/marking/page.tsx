import Link from "next/link";
import { PageHero } from "@/components/admin";
import { PortalShell } from "@/components/PortalShell";
import { Empty, Pill } from "@/components/ui";
import { requireSchool } from "@/lib/auth";
import { TEACHER_NAV } from "@/lib/nav";
import { dayLabel, myClassSubjects } from "@/lib/teaching";

export const metadata = { title: "Marking" };

type Hw = { id: string; class_subject_id: string; title: string; kind: string; due_at: string; homework_submissions: { status: string; late: boolean }[] };

export default async function MarkingQueue() {
  const { supabase, school, user, fullName } = await requireSchool(["teacher"]);
  const mine = await myClassSubjects(supabase, school.id, user.id);
  const ids = mine.map((m) => m.id);
  const { data } = ids.length
    ? await supabase.from("homework").select("id, class_subject_id, title, kind, due_at, homework_submissions(status, late)").in("class_subject_id", ids).order("due_at").returns<Hw[]>()
    : { data: [] as Hw[] };
  const cs = new Map(mine.map((m) => [m.id, m]));
  const queue = (data ?? [])
    .map((h) => ({ ...h, waiting: h.homework_submissions.filter((s) => s.status === "submitted").length, late: h.homework_submissions.filter((s) => s.status === "submitted" && s.late).length }))
    .filter((h) => h.waiting > 0);
  const total = queue.reduce((a, h) => a + h.waiting, 0);

  return (
    <PortalShell school={school} roleLabel="Teacher" fullName={fullName} groups={TEACHER_NAV} active="marking">
      <div className="flex flex-col gap-5">
        <PageHero title="Marking" sub={total ? `${total} piece${total === 1 ? "" : "s"} of work to mark` : "All caught up"} />
        {queue.length ? (
          <ul className="flex flex-col gap-2">
            {queue.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center gap-3 rounded-[18px] border border-[#E3EAF3] bg-white p-4">
                <div className="min-w-[200px] flex-1">
                  <span className="font-bold text-brand-slate">{h.title}</span>
                  <span className="block text-xs text-[#4A5A70]">
                    {cs.get(h.class_subject_id)?.label} · due {dayLabel(h.due_at)}
                  </span>
                </div>
                <span className="flex flex-wrap gap-2">
                  <Pill kind="warn">{h.waiting} to mark</Pill>
                  {h.late > 0 && <Pill kind="bad">{h.late} late</Pill>}
                </span>
                <Link className="s-btn" href={`/teacher/homework/${h.id}`}>
                  Start marking<span className="sr-only"> {h.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>
            Nothing to mark right now. New work shows here as students hand it in.{" "}
            <Link className="s-link" href="/teacher/homework">
              See all homework
            </Link>
          </Empty>
        )}
      </div>
    </PortalShell>
  );
}
