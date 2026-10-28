import { releaseDueSoon } from "@/lib/announce";
import { requireSchool } from "@/lib/auth";
import { StudentView, type StudentData } from "./StudentView";

export default async function StudentHome() {
  const { supabase, school, fullName } = await requireSchool(["student"]);
  await releaseDueSoon();
  const { data } = await supabase.rpc("student_dashboard", { p_school: school.id });
  return <StudentView school={school} fullName={fullName} d={(data as StudentData | null) ?? null} />;
}
