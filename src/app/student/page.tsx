import { releaseDueSoon } from "@/lib/announce";
import { requireSchool } from "@/lib/auth";
import { homeworkFor } from "@/lib/homework-load";
import { StudentView, type StudentData } from "./StudentView";

const nowMs = () => Date.now();
const at = (iso: string) => Date.parse(iso);

export default async function StudentHome() {
  const { supabase, school, fullName, user } = await requireSchool(["student"]);
  await releaseDueSoon();
  const [{ data }, { data: me }, { data: tests }] = await Promise.all([
    supabase.rpc("student_dashboard", { p_school: school.id }),
    supabase.from("students").select("id, class_id").eq("school_id", school.id).eq("user_id", user.id).maybeSingle<{ id: string; class_id: string | null }>(),
    supabase.rpc("cbt_student_tests"),
  ]);
  const hw = me ? await homeworkFor(supabase, me) : [];
  const now = nowMs();
  const todo = {
    homework: hw.filter((h) => h.state === "todo" && h.submit_modes.join() !== "paper" && (at(h.due_at) >= now || h.allow_late)).length,
    tests: ((tests as { opens_at: string; closes_at: string; submitted_at: string | null }[] | null) ?? []).filter((t) => !t.submitted_at && at(t.opens_at) <= now && now <= at(t.closes_at)).length,
  };
  return <StudentView school={school} fullName={fullName} d={(data as StudentData | null) ?? null} todo={todo} />;
}
