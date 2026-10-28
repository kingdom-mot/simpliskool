"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/components/forms";
import { requireSchool } from "@/lib/auth";

const schema = z.object({
  class_subject_id: z.string().uuid(),
  term_id: z.string().uuid(),
  week: z.coerce.number().int().min(1).max(16),
  topic: z.string().trim().min(2, "Enter the topic").max(160, "Keep the topic short"),
  lesson_date: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/),
  duration_min: z.coerce.number().int().min(10).max(240),
  objectives: z.string().max(2000, "Objectives are too long"),
  materials: z.string().max(1000, "Materials are too long"),
  content: z.string().max(8000, "The lesson steps are too long"),
  evaluation: z.string().max(2000, "Evaluation is too long"),
});

export async function saveNote(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireSchool(["teacher"]);
  const p = schema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  const submit = fd.get("go") === "submit";
  if (submit && (!p.data.objectives.trim() || !p.data.content.trim() || !p.data.evaluation.trim())) return { error: "Add the objectives, lesson steps and evaluation before submitting." };
  const { error } = await supabase.rpc("save_lesson_note", { p_note: p.data, p_submit: submit });
  if (error) return { error: /approved/i.test(error.message) ? "This note is approved and can't be changed." : /not allowed/.test(error.message) ? "You don't teach this subject." : "We couldn't save. Please try again." };
  revalidatePath("/teacher/notes");
  revalidatePath("/admin/lesson-notes");
  return { ok: true, message: submit ? "Sent to the principal for approval." : "Draft saved.", at: Date.now() };
}

export async function shareNote(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireSchool(["teacher"]);
  const id = z.string().uuid().safeParse(fd.get("id"));
  if (!id.success) return { error: "Something went wrong." };
  const { error } = await supabase.rpc("share_lesson_note", { p_id: id.data });
  if (error) return { error: "We couldn't share the note." };
  revalidatePath("/teacher/notes");
  return { ok: true, message: "Shared with the class. Students and parents can read it.", at: Date.now() };
}
