import Link from "next/link";
import { MobileShell } from "@/components/MobileShell";
import { classLabel } from "@/components/admin";
import { Empty } from "@/components/ui";
import { DayLessons } from "@/components/learning/DayLessons";
import { HomeworkRow } from "@/components/learning/HomeworkDetail";
import { SharedNotes } from "@/components/learning/SharedNotes";
import { requireSchool } from "@/lib/auth";
import { homeworkFor, splitHomework } from "@/lib/homework-load";
import { PARENT_TABS } from "@/lib/nav";

export const metadata = { title: "Learning" };

type Kid = { id: string; first_name: string; class_id: string | null; classes: { name: string; arm: string } | null };

export default async function ParentLearning(props: { searchParams: Promise<{ child?: string; tab?: string; note?: string; day?: string }> }) {
  const sp = await props.searchParams;
  const { supabase, school, user } = await requireSchool(["parent"]);
  const { data: rows } = await supabase.from("guardians").select("students(id, first_name, class_id, classes(name, arm))").eq("school_id", school.id).eq("user_id", user.id).returns<{ students: Kid | null }[]>();
  const kids = (rows ?? []).map((r) => r.students).filter((k): k is Kid => !!k).sort((a, b) => a.first_name.localeCompare(b.first_name));
  const kid = kids.find((k) => k.id === sp.child) ?? kids[0];
  const tab = sp.tab === "notes" || sp.tab === "timetable" ? sp.tab : "homework";
  const q = (o: Record<string, string>) => `/parent/learning?${new URLSearchParams({ child: kid?.id ?? "", tab, ...o })}`;

  let body: React.ReactNode = null;
  if (kid && tab === "homework") {
    const g = splitHomework(await homeworkFor(supabase, kid));
    const list = [...g.todo, ...g.done, ...g.marked];
    body = list.length ? (
      <ul className="flex flex-col gap-2">
        {list.map((h) => (
          <HomeworkRow key={h.id} hw={h} href={`/parent/learning/homework/${h.id}?child=${kid.id}`} />
        ))}
      </ul>
    ) : (
      <Empty>No homework for {kid.first_name} yet.</Empty>
    );
  } else if (kid && tab === "notes") {
    body = <SharedNotes supabase={supabase} classId={kid.class_id} open={sp.note} href={(id) => q(id ? { note: id } : {})} />;
  } else if (kid) {
    body = <DayLessons supabase={supabase} schoolId={school.id} classId={kid.class_id} day={sp.day} href={(d) => q({ day: String(d) })} />;
  }

  return (
    <MobileShell school={school} title="Learning" tabs={PARENT_TABS} active="learning">
      {!kid ? (
        <Empty>No children are linked to your account yet. Please contact the school.</Empty>
      ) : (
        <>
          {kids.length > 1 && (
            <div role="group" aria-label="Choose a child" className="flex gap-2 overflow-x-auto pb-0.5">
              {kids.map((k) => (
                <Link key={k.id} href={`/parent/learning?child=${k.id}&tab=${tab}`} aria-current={k.id === kid.id ? "true" : undefined} className={`flex min-h-[44px] flex-none items-center rounded-full border-[1.5px] px-4 text-sm ${k.id === kid.id ? "border-c1 bg-c1 font-extrabold text-white" : "border-[#DCE5F0] bg-white font-semibold text-brand-slate"}`}>
                  {k.first_name}
                  {k.classes ? ` · ${classLabel(k.classes.name, k.classes.arm)}` : ""}
                </Link>
              ))}
            </div>
          )}
          <nav aria-label="Learning sections" className="grid grid-cols-3 gap-1.5">
            {[
              ["homework", "Homework"],
              ["notes", "Lesson notes"],
              ["timetable", "Timetable"],
            ].map(([k, l]) => (
              <Link key={k} href={`/parent/learning?child=${kid.id}&tab=${k}`} aria-current={tab === k ? "page" : undefined} className={`flex min-h-[44px] items-center justify-center rounded-xl border-[1.5px] px-2 text-center text-sm font-bold ${tab === k ? "border-c1 bg-c1 text-white" : "border-[#DCE5F0] bg-white text-brand-slate"}`}>
                {l}
              </Link>
            ))}
          </nav>
          {body}
        </>
      )}
    </MobileShell>
  );
}
