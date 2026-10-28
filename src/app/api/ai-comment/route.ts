import { z } from "zod";
import { requireSchool } from "@/lib/auth";
import { aiReady, askClaude } from "@/lib/ai";
import { RATINGS, type StudentResult } from "@/lib/results";

const body = z.object({ student: z.string().uuid(), term: z.string().uuid(), who: z.enum(["teacher", "principal"]) });

/** Suggests a report card comment from the student's own results. Only the first name and results are sent. */
export async function POST(req: Request) {
  const { supabase } = await requireSchool(["owner", "admin", "principal", "teacher"]);
  if (!aiReady()) return Response.json({ error: "AI suggestions aren't switched on." }, { status: 503 });
  const p = body.safeParse(await req.json().catch(() => null));
  if (!p.success) return Response.json({ error: "Bad request" }, { status: 400 });
  // The database checks this person may see the student's results.
  const { data } = await supabase.rpc("student_result", { p_student: p.data.student, p_term: p.data.term });
  const r = data as StudentResult | null;
  if (!r) return Response.json({ error: "Not found" }, { status: 404 });
  if (!r.subjects.length) return Response.json({ error: "There are no scores yet to base a comment on." }, { status: 422 });

  const facts = [
    `First name: ${r.student.first_name}`,
    `Average: ${r.average ?? "none"}; position ${r.position ?? "-"} of ${r.class_size}`,
    `Attendance: ${r.days ? `${r.present} of ${r.days} days` : "not recorded"}`,
    `Subjects (total out of 100, grade): ${r.subjects.map((s) => `${s.name} ${s.total} ${s.grade ?? ""}`).join("; ")}`,
    r.ratings && Object.keys(r.ratings).length ? `Behaviour ratings (1-5): ${RATINGS.filter((k) => r.ratings?.[k]).map((k) => `${k} ${r.ratings![k]}`).join(", ")}` : "",
    p.data.who === "principal" && r.comment ? `Class teacher's comment: ${r.comment}` : "",
  ].filter(Boolean);
  const role = p.data.who === "principal" ? "the principal" : "the class teacher";
  const system =
    "You write short report card comments for a Nigerian school. Write in clear, warm, professional British English. " +
    `Write as ${role}. Use only the facts given; never invent events. Mention a strength and, where fair, one thing to work on. ` +
    (p.data.who === "principal" ? "One or two sentences, under 30 words." : "Two or three sentences, under 55 words.") +
    " Reply with the comment only, no quotes or labels.";
  const text = await askClaude(system, facts.join("\n"));
  if (!text) return Response.json({ error: "The AI service didn't answer. Try again, or use the starting comment." }, { status: 502 });
  return Response.json({ comment: text.replace(/^["']|["']$/g, "").slice(0, 600) });
}
