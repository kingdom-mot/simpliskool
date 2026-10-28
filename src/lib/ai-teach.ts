import "server-only";
import { askClaude } from "@/lib/ai";

type DB = Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>;

/** Each teacher's monthly AI allowance (AI_TEACHER_MONTHLY_LIMIT, default 200). */
export function aiLimit() {
  return Number(process.env.AI_TEACHER_MONTHLY_LIMIT ?? 200) || 200;
}

function monthStart() {
  const d = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit" }).format(new Date());
  return new Date(`${d}-01T00:00:00+01:00`).toISOString();
}

export async function aiUsed(supabase: DB, userId: string) {
  const { count } = await supabase.from("ai_requests").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", monthStart());
  return count ?? 0;
}

/** Records one request; returns false when the teacher has used this month's allowance. */
export async function spendAi(supabase: DB, schoolId: string, userId: string, kind: string) {
  if ((await aiUsed(supabase, userId)) >= aiLimit()) return false;
  await supabase.from("ai_requests").insert({ school_id: schoolId, user_id: userId, kind: kind.slice(0, 30) });
  return true;
}

export type Mcq = { body: string; options: string[]; answer: number; explanation: string; difficulty: "easy" | "medium" | "hard" };

/** Multiple-choice questions as drafts. Returns null if the AI didn't answer usefully. */
export async function draftMcqs(input: { subject: string; level: string; topic: string; difficulty: string; count: number }): Promise<Mcq[] | null> {
  const system =
    "You write multiple-choice questions for Nigerian school students, following the national curriculum. Use clear British English and Nigerian names and contexts where natural. " +
    'Reply with JSON only: {"questions": [{"question": string, "options": [string, string, string, string], "answer": 0-3, "explanation": string, "difficulty": "easy"|"medium"|"hard"}]}. ' +
    "Exactly one option is correct. Wrong options must be plausible. Keep each question under 300 characters and each option under 120. The explanation is one short sentence.";
  const text = await askClaude(system, `Subject: ${input.subject}\nClass: ${input.level}\nTopic: ${input.topic}\nDifficulty: ${input.difficulty}\nNumber of questions: ${input.count}`, 1800);
  if (!text) return null;
  try {
    const j = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)) as { questions?: unknown[] };
    const out: Mcq[] = [];
    for (const q of j.questions ?? []) {
      const o = q as Record<string, unknown>;
      const options = Array.isArray(o.options) ? o.options.map((x) => String(x).trim().slice(0, 300)).filter(Boolean).slice(0, 5) : [];
      const answer = Number(o.answer);
      const body = String(o.question ?? "").trim().slice(0, 1000);
      if (body.length < 3 || options.length < 2 || !Number.isInteger(answer) || answer < 0 || answer >= options.length) continue;
      const d = String(o.difficulty ?? input.difficulty);
      out.push({ body, options, answer, explanation: String(o.explanation ?? "").slice(0, 600), difficulty: d === "easy" || d === "hard" ? d : "medium" });
    }
    return out.length ? out.slice(0, input.count) : null;
  } catch {
    return null;
  }
}
