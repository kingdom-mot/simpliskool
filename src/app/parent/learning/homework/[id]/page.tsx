import Link from "next/link";
import { notFound } from "next/navigation";
import { Flash } from "@/components/Flash";
import { MobileShell } from "@/components/MobileShell";
import { HomeworkDetail } from "@/components/learning/HomeworkDetail";
import { requireSchool } from "@/lib/auth";
import { oneHomework } from "@/lib/homework-load";
import { PARENT_TABS } from "@/lib/nav";

export const metadata = { title: "Homework" };

export default async function ParentHomeworkItem(props: { params: Promise<{ id: string }>; searchParams: Promise<{ child?: string }> }) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const { supabase, school, user } = await requireSchool(["parent"]);
  const { data: link } = sp.child && /^[0-9a-f-]{36}$/.test(sp.child)
    ? await supabase.from("guardians").select("students(id, first_name)").eq("user_id", user.id).eq("student_id", sp.child).maybeSingle<{ students: { id: string; first_name: string } | null }>()
    : { data: null };
  const kid = link?.students;
  const hw = kid && /^[0-9a-f-]{36}$/.test(id) ? await oneHomework(supabase, id, kid.id) : null;
  if (!hw || !kid) notFound();
  return (
    <MobileShell school={school} title="Learning" tabs={PARENT_TABS} active="learning">
      <Link href={`/parent/learning?child=${kid.id}`} className="text-sm font-bold text-c1 underline">
        ← {kid.first_name}&apos;s homework
      </Link>
      <Flash />
      <HomeworkDetail hw={hw} studentId={kid.id} back={`/parent/learning/homework/${hw.id}?child=${kid.id}`} who={kid.first_name} />
    </MobileShell>
  );
}
