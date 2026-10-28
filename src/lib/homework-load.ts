import "server-only";
import type { HwFile } from "@/lib/teaching";

type DB = Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>;

export type KidHw = {
  id: string;
  title: string;
  kind: string;
  instructions: string | null;
  max_marks: number;
  due_at: string;
  submit_modes: string[];
  allow_late: boolean;
  attachments: HwFile[];
  subject: string;
  teacher: string | null;
  sub: { status: string; answer: string | null; files: HwFile[]; note: string | null; submitted_at: string | null; late: boolean; score: number | null; feedback: string | null } | null;
  state: "todo" | "done" | "marked";
};

type Row = Omit<KidHw, "subject" | "teacher" | "sub" | "state"> & {
  class_subjects: { subjects: { name: string } | null; profiles: { full_name: string | null } | null } | null;
  homework_submissions: (NonNullable<KidHw["sub"]> & { student_id: string })[];
};

const SELECT = "id, title, kind, instructions, max_marks, due_at, submit_modes, allow_late, attachments, class_subjects(subjects(name), profiles(full_name)), homework_submissions(student_id, status, answer, files, note, submitted_at, late, score, feedback)";

function shape(r: Row, studentId: string): KidHw {
  const sub = r.homework_submissions.find((s) => s.student_id === studentId) ?? null;
  const state = sub?.status === "marked" ? "marked" : sub?.status === "submitted" ? "done" : "todo";
  return { ...r, subject: r.class_subjects?.subjects?.name ?? "", teacher: r.class_subjects?.profiles?.full_name ?? null, sub, state };
}

/** Homework for one student's class (the last 4 months), newest due first. */
export async function homeworkFor(supabase: DB, student: { id: string; class_id: string | null }) {
  if (!student.class_id) return [];
  const { data: cs } = await supabase.from("class_subjects").select("id").eq("class_id", student.class_id).returns<{ id: string }[]>();
  const ids = (cs ?? []).map((c) => c.id);
  if (!ids.length) return [];
  const since = new Date(Date.now() - 120 * 86400000).toISOString();
  const { data } = await supabase.from("homework").select(SELECT).in("class_subject_id", ids).gte("due_at", since).order("due_at", { ascending: false }).returns<Row[]>();
  return (data ?? []).map((r) => shape(r, student.id));
}

export async function oneHomework(supabase: DB, id: string, studentId: string) {
  const { data } = await supabase.from("homework").select(SELECT).eq("id", id).maybeSingle<Row>();
  return data ? shape(data, studentId) : null;
}

/** To do first (soonest due), then handed in, then marked. */
export function splitHomework(list: KidHw[]) {
  return {
    todo: list.filter((h) => h.state === "todo").sort((a, b) => a.due_at.localeCompare(b.due_at)),
    done: list.filter((h) => h.state === "done"),
    marked: list.filter((h) => h.state === "marked"),
  };
}
