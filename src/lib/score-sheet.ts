import "server-only";
import type { SheetStudent } from "@/components/ScoreSheet";
import { DEFAULT_SCALE, asParts, type ScaleRow } from "@/lib/results";

type DB = Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>;

/** Students, saved scores, grading scale and submitted state for one class subject and term. */
export async function loadSheet(supabase: DB, schoolId: string, csId: string, classId: string, termId: string) {
  const [{ data: studs }, { data: scores }, { data: scale }, { data: sheet }, { data: cards }, { data: parts }] = await Promise.all([
    supabase.from("students").select("id, first_name, last_name").eq("class_id", classId).eq("status", "active").order("last_name").order("first_name").returns<{ id: string; first_name: string; last_name: string }[]>(),
    supabase.from("scores").select("student_id, ca1, ca2, ca3, exam").eq("class_subject_id", csId).eq("term_id", termId).returns<{ student_id: string; ca1: number | null; ca2: number | null; ca3: number | null; exam: number | null }[]>(),
    supabase.from("grading_scales").select("grade, min_score, max_score, remark").eq("school_id", schoolId).returns<{ grade: string; min_score: number; max_score: number; remark: string | null }[]>(),
    supabase.from("score_sheets").select("submitted_at").eq("class_subject_id", csId).eq("term_id", termId).maybeSingle<{ submitted_at: string | null }>(),
    supabase.from("report_cards").select("student_id").eq("term_id", termId).not("released_at", "is", null).returns<{ student_id: string }[]>(),
    supabase.rpc("assessment_parts", { p_school: schoolId }),
  ]);
  const by = new Map((scores ?? []).map((s) => [s.student_id, s]));
  const locked = new Set((cards ?? []).map((c) => c.student_id));
  const students: SheetStudent[] = (studs ?? []).map((s) => {
    const x = by.get(s.id);
    return { id: s.id, name: `${s.first_name} ${s.last_name}`, ca1: x?.ca1 ?? null, ca2: x?.ca2 ?? null, ca3: x?.ca3 ?? null, exam: x?.exam ?? null, locked: locked.has(s.id) };
  });
  const sc: ScaleRow[] = scale?.length ? scale.map((g) => ({ grade: g.grade, min: Number(g.min_score), max: Number(g.max_score), remark: g.remark })) : DEFAULT_SCALE;
  return { students, scale: sc, parts: asParts(parts), submittedAt: sheet?.submitted_at ?? null };
}
