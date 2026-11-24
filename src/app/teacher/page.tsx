import { releaseDueSoon } from "@/lib/announce";
import { requireSchool } from "@/lib/auth";
import { SurveyCard } from "@/components/SurveyCard";
import { surveyDue } from "@/lib/survey-due";
import { TeacherView, type TeacherData } from "./TeacherView";

export default async function TeacherHome() {
  const { supabase, school, fullName } = await requireSchool(["teacher"]);
  await releaseDueSoon();
  const { data } = await supabase.rpc("teacher_dashboard", { p_school: school.id });
  const due = await surveyDue(supabase, school.id, "teacher");
  return <TeacherView school={school} fullName={fullName} d={(data as TeacherData | null) ?? null} extra={due ? <SurveyCard survey={due.survey} group={due.group} page="/teacher" /> : undefined} />;
}
