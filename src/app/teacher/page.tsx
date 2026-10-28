import { releaseDueSoon } from "@/lib/announce";
import { requireSchool } from "@/lib/auth";
import { TeacherView, type TeacherData } from "./TeacherView";

export default async function TeacherHome() {
  const { supabase, school, fullName } = await requireSchool(["teacher"]);
  await releaseDueSoon();
  const { data } = await supabase.rpc("teacher_dashboard", { p_school: school.id });
  return <TeacherView school={school} fullName={fullName} d={(data as TeacherData | null) ?? null} />;
}
