"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { setFlash } from "@/lib/flash";
import { z } from "zod";
import type { ActionState } from "@/components/forms";
import { requireSchool } from "@/lib/auth";
import { removeLearningFiles, uploadLearningFiles } from "@/lib/learning-files";
import type { HwFile } from "@/lib/teaching";

const uuid = z.string().uuid();

/** The page to come back to (only our own homework pages). */
function backTo(fd: FormData) {
  const b = String(fd.get("back") ?? "");
  return /^\/(student\/homework|parent\/learning\/homework)\/[0-9a-f-]{36}(\?child=[0-9a-f-]{36})?$/.test(b) ? b : "/student/homework";
}

function paths() {
  revalidatePath("/student/homework", "layout");
  revalidatePath("/parent/learning", "layout");
}

/** Hand in work (a student, or a parent for a younger child). */
export async function handIn(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, school } = await requireSchool(["student", "parent"]);
  const hw = uuid.safeParse(fd.get("hw"));
  const st = uuid.safeParse(fd.get("student"));
  if (!hw.success || !st.success) return { error: "Something went wrong. Refresh the page and try again." };
  const [{ data: allowed }, { data: h }] = await Promise.all([
    supabase.rpc("acts_for_student", { p_student: st.data }),
    supabase.from("homework").select("id, submit_modes").eq("id", hw.data).maybeSingle<{ id: string; submit_modes: string[] }>(),
  ]);
  if (allowed !== true || !h) return { error: "You can't hand in work for this student." };
  const answer = String(fd.get("answer") ?? "").slice(0, 8000);
  if (answer.trim() && !h.submit_modes.includes("text")) return { error: "This homework takes a photo or file, not a typed answer." };
  const { data: old } = await supabase.from("homework_submissions").select("files").eq("homework_id", h.id).eq("student_id", st.data).maybeSingle<{ files: HwFile[] }>();
  const keepPaths = new Set(fd.getAll("keep").map(String));
  const kept = (old?.files ?? []).filter((f) => keepPaths.has(f.path));
  const dropped = (old?.files ?? []).filter((f) => !keepPaths.has(f.path));
  const up = await uploadLearningFiles(fd.getAll("work"), `${school.id}/hw/${h.id}/${st.data}`, 5 - kept.length);
  if ("error" in up) return { error: up.error };
  const files = [...kept, ...up.files];
  const { data, error } = await supabase.rpc("submit_homework", { p_homework: h.id, p_student: st.data, p_answer: answer, p_files: files, p_note: String(fd.get("note") ?? "").slice(0, 500) });
  if (error) {
    await removeLearningFiles(up.files.map((f) => f.path));
    if (/Add your work/.test(error.message)) return { error: "Add a photo, a file or your typed answer first." };
    if (/Too late/.test(error.message)) return { error: "The due date has passed and your teacher isn't taking late work." };
    if (/marked/.test(error.message)) return { error: "Your teacher has already marked this." };
    return { error: "We couldn't hand it in. Please try again." };
  }
  await removeLearningFiles(dropped.map((f) => f.path));
  paths();
  const late = (data as { late?: boolean } | null)?.late;
  // The form turns into "Handed in", so the confirmation is shown on the page.
  const back = backTo(fd);
  await setFlash(late ? "Handed in (late). Your teacher will mark it." : "Handed in. Your teacher will mark it, and you'll see the score here.", back.split("?")[0]);
  redirect(back);
}

export async function takeBack(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireSchool(["student", "parent"]);
  const hw = uuid.safeParse(fd.get("hw"));
  const st = uuid.safeParse(fd.get("student"));
  if (!hw.success || !st.success) return { error: "Something went wrong." };
  const { error } = await supabase.rpc("unsubmit_homework", { p_homework: hw.data, p_student: st.data });
  if (error) return { error: /marked/i.test(error.message) ? "Your teacher has already marked this." : "We couldn't take it back. Please try again." };
  paths();
  const back = backTo(fd);
  await setFlash("Taken back. Change your work, then hand it in again before the due date.", back.split("?")[0]);
  redirect(back);
}
