"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { aiReady, askClaude } from "@/lib/ai";
import { aiLimit, aiUsed, draftMcqs, spendAi, type Mcq } from "@/lib/ai-teach";
import { requireSchool } from "@/lib/auth";
import { featureOn } from "@/lib/platform-settings";
import { loadTerms } from "@/lib/fees";
import { weekOfTerm } from "@/lib/lesson-notes";

export type Task = "note" | "quiz" | "simpler" | "homework";
export type NoteDraft = { topic: string; objectives: string; materials: string; content: string; evaluation: string };
export type Reply = { kind: "text"; text: string } | { kind: "quiz"; topic: string; questions: Mcq[] } | { kind: "note"; note: NoteDraft } | { error: string };
type Turn = { role: "user" | "assistant"; text: string };

const uuid = z.string().uuid();
const BASE = "You are a helpful teaching assistant for a Nigerian school teacher. Follow the Nigerian national curriculum, use clear British English and local examples (naira, Nigerian names and places). Be practical and concise. Never include students' personal details.";

async function myCs(cs: string) {
  const ctx = await requireSchool(["teacher"]);
  if (!uuid.safeParse(cs).success) return { ctx, cs: null };
  const { data } = await ctx.supabase.from("class_subjects").select("id, subject_id, classes(name, arm), subjects(name)").eq("id", cs).eq("teacher_id", ctx.user.id).maybeSingle<{ id: string; subject_id: string; classes: { name: string; arm: string } | null; subjects: { name: string } | null }>();
  return { ctx, cs: data ? { id: data.id, subject_id: data.subject_id, level: data.classes?.name ?? "", subject: data.subjects?.name ?? "" } : null };
}

export async function ask(task: Task, csId: string, request: string, history: Turn[], minutes: number): Promise<Reply> {
  if (!aiReady()) return { error: "AI isn't switched on for this school yet." };
  const { ctx, cs } = await myCs(csId);
  if (!cs) return { error: "Choose one of your classes." };
  const req = request.trim().slice(0, 1500);
  if (req.length < 3) return { error: "Type what you need first." };
  if (!(await featureOn(ctx.school.id, "ai"))) return { error: "The AI assistant is switched off for your school." };
  if (!(await spendAi(ctx.supabase, ctx.school.id, ctx.user.id, task))) return { error: `You've used this month's ${aiLimit()} AI requests. They reset on the 1st.` };
  const where = `Class: ${cs.level}\nSubject: ${cs.subject}`;

  if (task === "quiz") {
    const n = Math.min(10, Math.max(1, Number(req.match(/\b(\d{1,2})\b/)?.[1]) || 5));
    const diff = /hard/i.test(req) ? "hard" : /easy/i.test(req) ? "easy" : "medium";
    const topic = req.replace(/^(give me|write|make|create)\s+/i, "").slice(0, 80);
    const qs = await draftMcqs({ subject: cs.subject, level: cs.level, topic: req, difficulty: diff, count: n });
    return qs ? { kind: "quiz", topic, questions: qs } : { error: "The AI service didn't give usable questions. Try again." };
  }
  if (task === "note") {
    const system = `${BASE} Write lesson notes. Reply with JSON only: {"topic": string, "objectives": string, "materials": string, "content": string, "evaluation": string}. objectives: 2-3 'Students can ...' lines. materials: cheap, locally available items. content: numbered steps (starter, teaching, worked examples, practice, plenary) with minutes for each, adding up to the lesson length. evaluation: 3 short class questions.`;
    const text = await askClaude(system, `${where}\nLesson length: ${minutes} minutes\nRequest: ${req}`, 1100);
    if (!text) return { error: "The AI service didn't answer. Try again." };
    try {
      const j = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)) as Record<string, unknown>;
      const s = (k: string, max: number) => String(j[k] ?? "").slice(0, max);
      return { kind: "note", note: { topic: s("topic", 160) || req.slice(0, 160), objectives: s("objectives", 2000), materials: s("materials", 1000), content: s("content", 8000), evaluation: s("evaluation", 2000) } };
    } catch {
      return { error: "The AI reply couldn't be read. Try again." };
    }
  }
  const what = task === "simpler" ? "Re-explain the topic simply for students who find it hard: an everyday comparison, then 2-3 tiny worked steps, then 3 quick practice questions with answers." : "Suggest homework the teacher can set: 2-3 options, each with clear instructions for students, the marks, and what a good answer includes.";
  const convo = history.slice(-6).map((t) => `${t.role === "user" ? "Teacher" : "Assistant"}: ${t.text.slice(0, 1500)}`).join("\n\n");
  const text = await askClaude(`${BASE} ${what} Use short paragraphs or numbered lines, no markdown headings.`, `${where}\n${convo ? `Earlier in this conversation:\n${convo}\n\n` : ""}Teacher: ${req}`, 900);
  return text ? { kind: "text", text } : { error: "The AI service didn't answer. Try again." };
}

export async function saveNoteDraft(csId: string, note: NoteDraft, minutes: number): Promise<{ ok: string } | { error: string }> {
  const { ctx, cs } = await myCs(csId);
  if (!cs) return { error: "Choose one of your classes." };
  const { term } = await loadTerms(ctx.supabase, ctx.school.id);
  if (!term) return { error: "The school hasn't set up this term yet." };
  const { data: t } = await ctx.supabase.from("terms").select("starts_on").eq("id", term.id).single<{ starts_on: string | null }>();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date());
  // The first week from this week on without a note.
  const { data: used } = await ctx.supabase.from("lesson_notes").select("week").eq("class_subject_id", cs.id).eq("term_id", term.id).returns<{ week: number }[]>();
  const taken = new Set((used ?? []).map((u) => u.week));
  let week = weekOfTerm(t?.starts_on ?? null, today);
  while (taken.has(week) && week < 16) week++;
  if (taken.has(week)) return { error: "Every week already has a note. Copy the draft into one instead." };
  const { error } = await ctx.supabase.rpc("save_lesson_note", {
    p_note: { class_subject_id: cs.id, term_id: term.id, week, topic: note.topic.slice(0, 160) || "Lesson", lesson_date: "", duration_min: Math.min(240, Math.max(10, minutes)), objectives: note.objectives, materials: note.materials, content: note.content, evaluation: note.evaluation },
    p_submit: false,
  });
  if (error) return { error: "We couldn't save the note." };
  revalidatePath("/teacher/notes");
  return { ok: `Saved as a draft for week ${week}. Open it in Lesson notes to check and submit.|/teacher/notes?cs=${cs.id}&week=${week}` };
}

export async function addQuizToBank(csId: string, topic: string, questions: Mcq[]): Promise<{ ok: string } | { error: string }> {
  const { ctx, cs } = await myCs(csId);
  if (!cs) return { error: "Choose one of your classes." };
  const rows = (Array.isArray(questions) ? questions : [])
    .slice(0, 10)
    .filter((q) => q && typeof q.body === "string" && Array.isArray(q.options) && q.options.length >= 2 && Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length)
    .map((q) => ({
      school_id: ctx.school.id,
      subject_id: cs.subject_id,
      level: cs.level,
      topic: topic.trim().slice(0, 80) || "General",
      difficulty: ["easy", "medium", "hard"].includes(q.difficulty) ? q.difficulty : "medium",
      body: q.body.slice(0, 1000),
      options: q.options.slice(0, 5).map((o) => String(o).slice(0, 300)),
      answer: q.answer,
      explanation: String(q.explanation ?? "").slice(0, 600) || null,
      source: "ai",
      checked: false,
      created_by: ctx.user.id,
    }));
  if (!rows.length) return { error: "Nothing to add." };
  const { error } = await ctx.supabase.from("questions").insert(rows);
  if (error) return { error: "We couldn't add them to the bank." };
  revalidatePath("/teacher/questions");
  return { ok: `${rows.length} question${rows.length === 1 ? "" : "s"} added to the ${cs.level} ${cs.subject} bank as drafts. Check them before using them in a test.|/teacher/questions?bank=${encodeURIComponent(`${cs.subject_id}|${cs.level}`)}` };
}

export async function usage() {
  const { supabase, user } = await requireSchool(["teacher"]);
  return { used: await aiUsed(supabase, user.id), limit: aiLimit() };
}
