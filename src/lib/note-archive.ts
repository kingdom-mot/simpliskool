import "server-only";
import { classLabel } from "@/components/admin";
import type { Note } from "@/lib/lesson-notes";

type DB = Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>;
export type ArchiveRow = Note & { class_subjects: { subject_id: string; class_id: string; classes: { name: string; arm: string } | null; subjects: { name: string } | null } | null; profiles: { full_name: string | null } | null };
export type ArchiveFilter = { term?: string; teacher?: string; subject?: string; cls?: string };

/** Approved (and shared) notes for a term, filtered. Works with the signed-in client or the server key. */
export async function loadArchive(db: DB, schoolId: string, termIds: string[], f: ArchiveFilter) {
  if (!termIds.length) return [];
  const { data } = await db
    .from("lesson_notes")
    .select("id, class_subject_id, term_id, week, teacher_id, topic, lesson_date, duration_min, objectives, materials, content, evaluation, status, score, review_comment, reviewed_at, submitted_at, shared_at, updated_at, class_subjects(subject_id, class_id, classes(name, arm), subjects(name)), profiles:teacher_id(full_name)")
    .eq("school_id", schoolId)
    .in("term_id", termIds)
    .in("status", ["approved", "shared"])
    .order("week", { ascending: false })
    .returns<ArchiveRow[]>();
  return (data ?? []).filter(
    (n) => (!f.teacher || n.teacher_id === f.teacher) && (!f.subject || n.class_subjects?.subject_id === f.subject) && (!f.cls || n.class_subjects?.class_id === f.cls),
  );
}
export const noteLabel = (n: ArchiveRow) => `${n.class_subjects?.subjects?.name ?? ""} · ${classLabel(n.class_subjects?.classes?.name ?? "", n.class_subjects?.classes?.arm ?? "")}`;
