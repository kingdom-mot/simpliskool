import Link from "next/link";
import { notFound } from "next/navigation";
import { Flash } from "@/components/Flash";
import { MobileShell } from "@/components/MobileShell";
import { HomeworkDetail } from "@/components/learning/HomeworkDetail";
import { requireSchool } from "@/lib/auth";
import { oneHomework } from "@/lib/homework-load";
import { STUDENT_TABS } from "@/lib/nav";

export const metadata = { title: "Homework" };

export default async function StudentHomeworkItem(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const { supabase, school, user } = await requireSchool(["student"]);
  const { data: me } = await supabase.from("students").select("id").eq("school_id", school.id).eq("user_id", user.id).maybeSingle<{ id: string }>();
  const hw = me && /^[0-9a-f-]{36}$/.test(id) ? await oneHomework(supabase, id, me.id) : null;
  if (!hw || !me) notFound();
  return (
    <MobileShell school={school} title="Homework" tabs={STUDENT_TABS} active="homework">
      <Link href="/student/homework" className="text-sm font-bold text-c1 underline">
        ← All homework
      </Link>
      <Flash />
      <HomeworkDetail hw={hw} studentId={me.id} back={`/student/homework/${hw.id}`} who="you" />
    </MobileShell>
  );
}
