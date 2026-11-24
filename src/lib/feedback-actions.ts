"use server";

import type { ActionState } from "@/components/forms";
import { requireSchool } from "@/lib/auth";
import { isDemoRequest } from "@/lib/demo";
import { teamEmail } from "@/lib/platform-mail";

const KINDS = ["problem", "idea", "hard", "like"] as const;
const LABEL = { problem: "Something isn't working", idea: "An idea", hard: "Hard to use", like: "Something they like" } as const;

/** The Feedback button in every portal. Problems are also emailed to the Dream Savvy team. */
export async function sendFeedback(_prev: ActionState, fd: FormData): Promise<ActionState> {
  if (await isDemoRequest()) return { error: "In the demo, feedback isn't sent. In your own school, it reaches the Simpliskool team straight away." };
  const { supabase, school, fullName } = await requireSchool(["owner", "admin", "principal", "bursar", "teacher", "parent", "student"]);
  const kind = KINDS.find((k) => k === fd.get("kind"));
  const rating = Number(fd.get("rating"));
  const message = String(fd.get("message") ?? "").trim();
  const page = String(fd.get("page") ?? "").slice(0, 300);
  if (!kind) return { error: "Choose what your feedback is about." };
  if (message.length < 3) return { error: "Tell us a little more." };
  if (message.length > 2000) return { error: "Please keep it under 2,000 characters." };
  const { data, error } = await supabase.rpc("give_feedback", { p_school: school.id, p_kind: kind, p_rating: rating >= 1 && rating <= 5 ? rating : null, p_message: message, p_page: page });
  if (error) return { error: error.code === "P0001" ? error.message : "We couldn't send your feedback. Try again." };
  const inbox = process.env.SUPPORT_EMAIL;
  if (inbox && kind === "problem") await teamEmail(inbox, `Feedback from ${school.name}: ${LABEL[kind]}`, `${LABEL[kind]} (${school.name})`, [`From ${fullName}, on ${page || "an unknown page"}:`, message], { label: "Open feedback", path: `/super/feedback?id=${data}` });
  return { ok: true, message: "Thank you! Your feedback has reached the Simpliskool team.", at: Date.now() };
}
