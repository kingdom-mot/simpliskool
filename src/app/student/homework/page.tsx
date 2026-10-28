import Link from "next/link";
import { MobileShell } from "@/components/MobileShell";
import { Empty } from "@/components/ui";
import { HomeworkRow } from "@/components/learning/HomeworkDetail";
import { requireSchool } from "@/lib/auth";
import { homeworkFor, splitHomework } from "@/lib/homework-load";
import { STUDENT_TABS } from "@/lib/nav";

export const metadata = { title: "Homework" };

export default async function StudentHomework(props: { searchParams: Promise<{ tab?: string }> }) {
  const sp = await props.searchParams;
  const { supabase, school, user } = await requireSchool(["student"]);
  const { data: me } = await supabase.from("students").select("id, class_id").eq("school_id", school.id).eq("user_id", user.id).maybeSingle<{ id: string; class_id: string | null }>();
  const all = me ? await homeworkFor(supabase, me) : [];
  const g = splitHomework(all);
  const tab = sp.tab === "done" || sp.tab === "marked" ? sp.tab : "todo";
  const list = g[tab];
  const tabs = [
    ["todo", `To do (${g.todo.length})`],
    ["done", "Handed in"],
    ["marked", "Marked"],
  ];
  return (
    <MobileShell school={school} title="Homework" tabs={STUDENT_TABS} active="homework">
      <nav aria-label="Homework lists" className="grid grid-cols-3 gap-1.5">
        {tabs.map(([k, l]) => (
          <Link key={k} href={`/student/homework?tab=${k}`} aria-current={tab === k ? "page" : undefined} className={`flex min-h-[44px] items-center justify-center rounded-xl border-[1.5px] px-2 text-center text-sm font-bold ${tab === k ? "border-c1 bg-c1 text-white" : "border-[#DCE5F0] bg-white text-brand-slate"}`}>
            {l}
          </Link>
        ))}
      </nav>
      {list.length ? (
        <ul className="flex flex-col gap-2">
          {list.map((h) => (
            <HomeworkRow key={h.id} hw={h} href={`/student/homework/${h.id}`} />
          ))}
        </ul>
      ) : (
        <Empty>{tab === "todo" ? "No homework to do. Well done!" : tab === "done" ? "Nothing waiting to be marked." : "No marked work yet."}</Empty>
      )}
      <Link className="s-btn2 self-start" href="/student/cbt">
        CBT tests and practice quizzes
      </Link>
    </MobileShell>
  );
}
