import "server-only";
import { classLabel } from "@/components/admin";
import { levelOrder } from "@/lib/nigeria";
import { DEFAULT_SCALE, type ScaleRow } from "@/lib/results";

type DB = Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>;

export async function loadClasses(supabase: DB, schoolId: string) {
  const { data } = await supabase.from("classes").select("id, name, arm").eq("school_id", schoolId).returns<{ id: string; name: string; arm: string }[]>();
  return (data ?? []).sort((a, b) => levelOrder(a.name) - levelOrder(b.name) || classLabel(a.name, a.arm).localeCompare(classLabel(b.name, b.arm)));
}

export async function loadScale(supabase: DB, schoolId: string): Promise<ScaleRow[]> {
  const { data } = await supabase.from("grading_scales").select("grade, min_score, max_score, remark").eq("school_id", schoolId).returns<{ grade: string; min_score: number; max_score: number; remark: string | null }[]>();
  return data?.length ? data.map((g) => ({ grade: g.grade, min: Number(g.min_score), max: Number(g.max_score), remark: g.remark })) : DEFAULT_SCALE;
}
