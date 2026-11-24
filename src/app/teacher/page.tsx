import { releaseDueSoon } from "@/lib/announce";
import { requireSchool } from "@/lib/auth";
import { SurveyCard } from "@/components/SurveyCard";
import { surveyDue } from "@/lib/survey-due";
import { StaffClock, type MyClock } from "@/components/StaffClock";
import { TeacherView, type TeacherData } from "./TeacherView";

export default async function TeacherHome() {
  const { supabase, school, fullName, viewing } = await requireSchool([
    "teacher",
  ]);
  await releaseDueSoon();
  const [{ data }, due, { data: clock }] = await Promise.all([
    supabase.rpc("teacher_dashboard", { p_school: school.id }),
    surveyDue(supabase, school.id, "teacher"),
    // Before database update 0023 this simply returns an error, and the card stays hidden.
    viewing
      ? Promise.resolve({ data: null })
      : supabase.rpc("my_staff_clock", { p_school: school.id }),
  ]);
  const extra = (
    <>
      {clock && <StaffClock c={clock as MyClock} />}
      {due && (
        <SurveyCard survey={due.survey} group={due.group} page="/teacher" />
      )}
    </>
  );
  return (
    <TeacherView
      school={school}
      fullName={fullName}
      d={(data as TeacherData | null) ?? null}
      extra={clock || due ? extra : undefined}
    />
  );
}
