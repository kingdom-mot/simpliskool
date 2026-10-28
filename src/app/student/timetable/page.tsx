import { MobileShell } from "@/components/MobileShell";
import { classLabel } from "@/components/admin";
import { Empty } from "@/components/ui";
import { DayLessons } from "@/components/learning/DayLessons";
import { requireSchool } from "@/lib/auth";
import { STUDENT_TABS } from "@/lib/nav";

export const metadata = { title: "Timetable" };

export default async function StudentTimetable(props: { searchParams: Promise<{ day?: string }> }) {
  const sp = await props.searchParams;
  const { supabase, school, user } = await requireSchool(["student"]);
  const { data: me } = await supabase.from("students").select("class_id, classes(name, arm)").eq("school_id", school.id).eq("user_id", user.id).maybeSingle<{ class_id: string | null; classes: { name: string; arm: string } | null }>();
  const cls = me?.classes ? classLabel(me.classes.name, me.classes.arm) : "";
  return (
    <MobileShell school={school} title="Timetable" subtitle={cls} tabs={STUDENT_TABS} active="timetable">
      {me?.class_id ? <DayLessons supabase={supabase} schoolId={school.id} classId={me.class_id} day={sp.day} href={(d) => `/student/timetable?day=${d}`} /> : <Empty>You&apos;re not in a class yet. Please tell the school.</Empty>}
    </MobileShell>
  );
}
