import { z } from "zod";
import { requireSchool } from "@/lib/auth";
import { aiReady, askClaude } from "@/lib/ai";

const body = z.object({ topic: z.string().trim().min(2).max(160), subject: z.string().max(80), level: z.string().max(40), minutes: z.number().int().min(10).max(240) });

/** Drafts a lesson note for a teacher to edit. Only the topic, subject and class level are sent. */
export async function POST(req: Request) {
  await requireSchool(["teacher"]);
  if (!aiReady()) return Response.json({ error: "AI drafting isn't switched on." }, { status: 503 });
  const p = body.safeParse(await req.json().catch(() => null));
  if (!p.success) return Response.json({ error: "Enter the topic first." }, { status: 400 });
  const system =
    "You help Nigerian school teachers write lesson notes that follow the national curriculum. Use clear British English. " +
    'Reply with JSON only: {"objectives": string, "materials": string, "content": string, "evaluation": string}. ' +
    "objectives: 2-3 'Students can ...' lines. materials: a short comma-separated list of cheap, locally available materials. " +
    "content: numbered steps (starter, teaching, worked examples, practice, plenary) sized to the lesson length. evaluation: 3 short class questions.";
  const text = await askClaude(system, `Subject: ${p.data.subject}\nClass: ${p.data.level}\nTopic: ${p.data.topic}\nLesson length: ${p.data.minutes} minutes`, 900);
  if (!text) return Response.json({ error: "The AI service didn't answer. Try again." }, { status: 502 });
  try {
    const j = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)) as Record<string, unknown>;
    const s = (k: string, max: number) => String(j[k] ?? "").slice(0, max);
    return Response.json({ objectives: s("objectives", 2000), materials: s("materials", 1000), content: s("content", 8000), evaluation: s("evaluation", 2000) });
  } catch {
    return Response.json({ error: "The AI reply couldn't be read. Try again." }, { status: 502 });
  }
}
