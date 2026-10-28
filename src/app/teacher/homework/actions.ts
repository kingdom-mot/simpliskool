"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/components/forms";
import { requireSchool } from "@/lib/auth";
import { setFlash } from "@/lib/flash";
import { loadTerms } from "@/lib/fees";
import { removeLearningFiles, uploadLearningFiles } from "@/lib/learning-files";
import { asParts } from "@/lib/results";
import { CA_LABEL, fromLagos, num, type HwFile } from "@/lib/teaching";

const uuid = z.string().uuid();
const schema = z.object({
  kind: z.enum(["homework", "assignment"]),
  title: z.string().trim().min(3, "Give it a title").max(160, "Keep the title shorter"),
  instructions: z.string().trim().max(4000, "The instructions are too long"),
  max_marks: z.coerce.number({ message: "Enter the marks" }).positive("Marks must be more than 0").max(100, "Marks can be up to 100"),
});

export async function createHomework(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, school, user } = await requireSchool(["teacher"]);
  const p = schema.safeParse({ kind: fd.get("kind"), title: fd.get("title"), instructions: fd.get("instructions") ?? "", max_marks: fd.get("max_marks") });
  if (!p.success) return { error: p.error.issues[0].message };
  const css = [...new Set(fd.getAll("cs").map(String))].filter((c) => uuid.safeParse(c).success);
  if (!css.length) return { error: "Choose at least one class." };
  const due = fromLagos(fd.get("due_date"), fd.get("due_time"));
  if (!due) return { error: "Choose the due date." };
  if (new Date(due).getTime() < Date.now() - 60000) return { error: "The due date has already passed." };
  const modes = ["photo", "file", "text", "paper"].filter((m) => fd.getAll("mode").includes(m));
  if (!modes.length) return { error: "Choose how students can hand it in." };
  if (modes.includes("paper") && modes.length > 1) return { error: "\"On paper in class\" can't be combined with handing in online." };
  let caPart: string | null = null;
  if (p.data.kind === "assignment" && fd.get("ca_part")) {
    caPart = String(fd.get("ca_part"));
    const { data: parts } = await supabase.rpc("assessment_parts", { p_school: school.id });
    if (!asParts(parts).some((x) => x.key === caPart)) return { error: "Choose which CA it counts toward." };
  }
  const { term } = await loadTerms(supabase, school.id);
  if (!term) return { error: "The school hasn't set up this term yet." };

  // Only classes this teacher teaches (the database checks again).
  const { data: mine } = await supabase.from("class_subjects").select("id").in("id", css).eq("teacher_id", user.id).returns<{ id: string }[]>();
  if ((mine ?? []).length !== css.length) return { error: "You can only set homework for your own classes." };

  const worksheet = fd.getAll("attach");
  let made = 0;
  for (const cs of css) {
    const { data: hw, error } = await supabase
      .from("homework")
      .insert({ school_id: school.id, class_subject_id: cs, term_id: term.id, teacher_id: user.id, kind: p.data.kind, title: p.data.title, instructions: p.data.instructions || null, max_marks: p.data.max_marks, due_at: due, submit_modes: modes, allow_late: fd.get("allow_late") === "1", ca_part: caPart })
      .select("id")
      .single<{ id: string }>();
    if (error || !hw) return { error: error && /relation|column/i.test(error.message) ? "Run database file 0015_teaching.sql in Supabase first." : "We couldn't save the homework. Please try again." };
    if (worksheet.some((f) => f instanceof File && f.size > 0)) {
      const up = await uploadLearningFiles(worksheet, `${school.id}/hw/${hw.id}/attach`, 3);
      if ("error" in up) {
        await supabase.from("homework").delete().eq("id", hw.id);
        return { error: up.error };
      }
      await supabase.from("homework").update({ attachments: up.files }).eq("id", hw.id);
    }
    made++;
  }
  revalidatePath("/teacher/homework");
  const what = p.data.kind === "assignment" ? "Assignment" : "Homework";
  return { ok: true, message: `${what} set for ${made} class${made === 1 ? "" : "es"}${caPart ? `; marks can go to ${CA_LABEL[caPart]}` : ""}. Students and parents see it in the app now.`, at: Date.now() };
}

export async function deleteHomework(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireSchool(["teacher"]);
  const id = uuid.safeParse(fd.get("id"));
  if (!id.success) return { error: "Something went wrong." };
  const { data: subs } = await supabase.from("homework_submissions").select("files").eq("homework_id", id.data).returns<{ files: HwFile[] }[]>();
  const { data, error } = await supabase.from("homework").delete().eq("id", id.data).select("title, attachments").returns<{ title: string; attachments: HwFile[] }[]>();
  if (error || !data?.length) return { error: "We couldn't delete it." };
  await removeLearningFiles([...data[0].attachments, ...(subs ?? []).flatMap((s) => s.files)].map((f) => f.path));
  revalidatePath("/teacher/homework");
  await setFlash(`Deleted "${data[0].title}".`, "/teacher/homework");
  redirect("/teacher/homework");
}

export async function markWork(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireSchool(["teacher"]);
  const hw = uuid.safeParse(fd.get("hw"));
  const st = uuid.safeParse(fd.get("student"));
  if (!hw.success || !st.success) return { error: "Something went wrong." };
  const raw = String(fd.get("score") ?? "").trim();
  const score = Number(raw);
  if (!raw || !Number.isFinite(score)) return { error: "Enter a score." };
  const { error } = await supabase.rpc("mark_homework", { p_homework: hw.data, p_student: st.data, p_score: score, p_feedback: String(fd.get("feedback") ?? "") });
  if (error) return { error: /range/.test(error.message) ? "The score must be between 0 and the full marks." : "We couldn't save the mark. Please try again." };
  revalidatePath(`/teacher/homework/${hw.data}`);
  revalidatePath("/teacher/marking");
  const next = String(fd.get("next") ?? "");
  await setFlash(`Marked: ${num(score)}. ${next ? "Here's the next one." : "That was the last one to mark."}`, `/teacher/homework/${hw.data}`);
  redirect(`/teacher/homework/${hw.data}${uuid.safeParse(next).success ? `?s=${next}` : ""}`);
}

export async function sendHomeworkToCa(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, school } = await requireSchool(["teacher"]);
  const id = uuid.safeParse(fd.get("id"));
  if (!id.success) return { error: "Something went wrong." };
  const { data: hw } = await supabase.from("homework").select("id, class_subject_id, term_id, max_marks, ca_part").eq("id", id.data).maybeSingle<{ id: string; class_subject_id: string; term_id: string; max_marks: number; ca_part: string | null }>();
  if (!hw?.ca_part) return { error: "This homework doesn't count toward CA." };
  const { data: subs } = await supabase.from("homework_submissions").select("student_id, score").eq("homework_id", hw.id).eq("status", "marked").returns<{ student_id: string; score: number }[]>();
  if (!subs?.length) return { error: "Mark some work first." };
  const { data: partsRaw } = await supabase.rpc("assessment_parts", { p_school: school.id });
  const max = asParts(partsRaw).find((x) => x.key === hw.ca_part)?.max;
  if (!max) return { error: "Your school doesn't use that part any more." };
  const rows = subs.map((s) => ({ student_id: s.student_id, score: Math.round((Number(s.score) / Number(hw.max_marks)) * max * 10) / 10 }));
  const { data, error } = await supabase.rpc("set_ca_part", { p_class_subject: hw.class_subject_id, p_term: hw.term_id, p_part: hw.ca_part, p_rows: rows });
  if (error) return { error: "We couldn't send the marks. Please try again." };
  await supabase.from("homework").update({ ca_sent_at: new Date().toISOString() }).eq("id", hw.id);
  const r = data as { saved: number; locked: number };
  revalidatePath(`/teacher/homework/${hw.id}`);
  return { ok: true, message: `${r.saved} mark${r.saved === 1 ? "" : "s"} sent to ${CA_LABEL[hw.ca_part]} (out of ${num(max)}).${r.locked ? ` ${r.locked} skipped: results already released.` : ""}`, at: Date.now() };
}
