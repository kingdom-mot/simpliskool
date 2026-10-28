"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/components/forms";
import { aiReady } from "@/lib/ai";
import { draftMcqs, spendAi } from "@/lib/ai-teach";
import { requireSchool } from "@/lib/auth";

const uuid = z.string().uuid();
const DIFF = ["easy", "medium", "hard"] as const;

type Ctx = Awaited<ReturnType<typeof requireSchool>>;

/** "subjectId|JSS 2" → the bank, if this teacher teaches that subject at that level. */
async function bankFor(ctx: Ctx, raw: unknown) {
  const [subject, level] = String(raw ?? "").split("|");
  if (!uuid.safeParse(subject).success || !level) return null;
  const { data } = await ctx.supabase
    .from("class_subjects")
    .select("id, classes!inner(name), subjects(name)")
    .eq("school_id", ctx.school.id)
    .eq("subject_id", subject)
    .eq("teacher_id", ctx.user.id)
    .eq("classes.name", level)
    .limit(1)
    .returns<{ id: string; subjects: { name: string } | null }[]>();
  if (!data?.length) return null;
  return { subject, level, subjectName: data[0].subjects?.name ?? "" };
}

const qSchema = z.object({
  body: z.string().trim().min(3, "Write the question").max(1000, "The question is too long"),
  topic: z.string().trim().min(1, "Give a topic").max(80, "The topic is too long"),
  difficulty: z.enum(DIFF),
  explanation: z.string().trim().max(600, "The explanation is too long"),
});

function readOptions(fd: FormData) {
  const raw = ["A", "B", "C", "D", "E"].map((k) => String(fd.get(`opt${k}`) ?? "").trim());
  const answerKey = String(fd.get("answer") ?? "");
  const kept: string[] = [];
  let answer = -1;
  raw.forEach((t, i) => {
    if (!t) return;
    if ("ABCDE"[i] === answerKey) answer = kept.length;
    kept.push(t.slice(0, 300));
  });
  return { options: kept, answer };
}

function refresh() {
  revalidatePath("/teacher/questions");
  revalidatePath("/teacher/cbt");
}

export async function saveQuestion(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireSchool(["teacher"]);
  const bank = await bankFor(ctx, fd.get("bank"));
  if (!bank) return { error: "Choose one of your subjects first." };
  const p = qSchema.safeParse({ body: fd.get("body"), topic: fd.get("topic"), difficulty: fd.get("difficulty"), explanation: fd.get("explanation") ?? "" });
  if (!p.success) return { error: p.error.issues[0].message };
  const { options, answer } = readOptions(fd);
  if (options.length < 2) return { error: "Give at least two options." };
  if (answer < 0) return { error: "Choose the correct answer." };
  if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) return { error: "Two options are the same." };
  const row = { body: p.data.body, topic: p.data.topic, difficulty: p.data.difficulty, explanation: p.data.explanation || null, options, answer, checked: true, updated_at: new Date().toISOString() };
  const id = uuid.safeParse(fd.get("id"));
  const { data: saved, error } = id.success
    ? await ctx.supabase.from("questions").update(row).eq("id", id.data).eq("school_id", ctx.school.id).select("id")
    : await ctx.supabase.from("questions").insert({ ...row, school_id: ctx.school.id, subject_id: bank.subject, level: bank.level, source: "manual", created_by: ctx.user.id }).select("id");
  if (!error && !saved?.length) return { error: "Only the teacher who added this question (or an admin) can change it." };
  if (error) return { error: /relation/i.test(error.message) ? "Run database file 0015_teaching.sql in Supabase first." : "We couldn't save the question." };
  refresh();
  return { ok: true, message: id.success ? "Question saved." : `Added to the ${bank.level} ${bank.subjectName} bank.`, at: Date.now() };
}

export async function deleteQuestion(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireSchool(["teacher"]);
  const id = uuid.safeParse(fd.get("id"));
  if (!id.success) return { error: "Something went wrong." };
  const { data, error } = await supabase.from("questions").delete().eq("id", id.data).select("id");
  if (error || !data?.length) return { error: "You can only delete questions you added." };
  refresh();
  return { ok: true, message: "Question deleted.", at: Date.now() };
}

export async function markChecked(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireSchool(["teacher"]);
  const ids = fd.getAll("id").map(String).filter((x) => uuid.safeParse(x).success);
  if (!ids.length) return { error: "Something went wrong." };
  const { error } = await supabase.from("questions").update({ checked: true }).in("id", ids);
  if (error) return { error: "We couldn't save." };
  refresh();
  return { ok: true, message: ids.length === 1 ? "Checked. It can now be used in tests." : `${ids.length} questions checked.`, at: Date.now() };
}

export async function importQuestions(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireSchool(["teacher"]);
  const bank = await bankFor(ctx, fd.get("bank"));
  if (!bank) return { error: "Choose one of your subjects first." };
  let rows: unknown;
  try {
    rows = JSON.parse(String(fd.get("rows") ?? "[]"));
  } catch {
    return { error: "Something went wrong. Choose the file again." };
  }
  if (!Array.isArray(rows) || !rows.length) return { error: "Choose a filled-in template first." };
  if (rows.length > 300) return { error: "Import up to 300 questions at a time." };
  const good = [];
  const bad: number[] = [];
  for (const r of rows as Record<string, unknown>[]) {
    const options = (Array.isArray(r.options) ? r.options : []).map((o) => String(o).trim().slice(0, 300)).filter(Boolean).slice(0, 5);
    const answer = Number(r.answer);
    const body = String(r.body ?? "").trim();
    const diff = String(r.difficulty ?? "medium").toLowerCase();
    if (body.length < 3 || body.length > 1000 || options.length < 2 || !Number.isInteger(answer) || answer < 0 || answer >= options.length) {
      bad.push(Number(r.row) || 0);
      continue;
    }
    good.push({
      school_id: ctx.school.id,
      subject_id: bank.subject,
      level: bank.level,
      topic: String(r.topic ?? "").trim().slice(0, 80) || "General",
      difficulty: (DIFF as readonly string[]).includes(diff) ? diff : "medium",
      body,
      options,
      answer,
      explanation: String(r.explanation ?? "").trim().slice(0, 600) || null,
      source: "import",
      checked: true,
      created_by: ctx.user.id,
    });
  }
  if (good.length) {
    const { error } = await ctx.supabase.from("questions").insert(good);
    if (error) return { error: "We couldn't import the questions. Check the file and try again." };
  }
  refresh();
  if (!good.length) return { error: `None of the rows could be used. Check rows ${bad.slice(0, 8).join(", ")}: each needs a question, at least two options and the right answer letter.` };
  return { ok: true, message: `${good.length} question${good.length === 1 ? "" : "s"} added.${bad.length ? ` ${bad.length} row${bad.length === 1 ? "" : "s"} skipped (row ${bad.slice(0, 8).join(", ")}): missing a question, options or a valid answer letter.` : ""}`, at: Date.now() };
}

export async function generateQuestions(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireSchool(["teacher"]);
  if (!aiReady()) return { error: "AI isn't switched on for this school yet." };
  const bank = await bankFor(ctx, fd.get("bank"));
  if (!bank) return { error: "Choose one of your subjects first." };
  const topic = String(fd.get("topic") ?? "").trim().slice(0, 80);
  if (topic.length < 2) return { error: "Enter the topic for the questions." };
  const difficulty = (DIFF as readonly string[]).includes(String(fd.get("difficulty"))) ? String(fd.get("difficulty")) : "medium";
  const count = Math.min(10, Math.max(1, Number(fd.get("count")) || 5));
  if (!(await spendAi(ctx.supabase, ctx.school.id, ctx.user.id, "quiz"))) return { error: "You've used this month's AI requests. They reset on the 1st." };
  const qs = await draftMcqs({ subject: bank.subjectName, level: bank.level, topic, difficulty, count });
  if (!qs) return { error: "The AI service didn't give usable questions. Try again." };
  const { error } = await ctx.supabase.from("questions").insert(
    qs.map((q) => ({ school_id: ctx.school.id, subject_id: bank.subject, level: bank.level, topic, difficulty: q.difficulty, body: q.body, options: q.options, answer: q.answer, explanation: q.explanation || null, source: "ai", checked: false, created_by: ctx.user.id })),
  );
  if (error) return { error: "We couldn't save the questions." };
  refresh();
  return { ok: true, message: `${qs.length} AI draft${qs.length === 1 ? "" : "s"} added on "${topic}". Check each one before using it in a test.`, at: Date.now() };
}
