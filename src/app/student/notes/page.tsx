import { MobileShell } from "@/components/MobileShell";
import { SharedNotes } from "@/components/learning/SharedNotes";
import { requireSchool } from "@/lib/auth";
import { STUDENT_TABS } from "@/lib/nav";

export const metadata = { title: "Lesson notes" };

export default async function StudentNotes(props: { searchParams: Promise<{ note?: string }> }) {
  const sp = await props.searchParams;
  const { supabase, school, user } = await requireSchool(["student"]);
  const { data: me } = await supabase.from("students").select("class_id").eq("school_id", school.id).eq("user_id", user.id).maybeSingle<{ class_id: string | null }>();
  return (
    <MobileShell school={school} title="Lesson notes" tabs={STUDENT_TABS} active="notes">
      <SharedNotes supabase={supabase} classId={me?.class_id ?? null} open={sp.note} href={(id) => (id ? `/student/notes?note=${id}` : "/student/notes")} />
    </MobileShell>
  );
}
