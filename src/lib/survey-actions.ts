"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import type { ActionState } from "@/components/forms";
import { requireSchool } from "@/lib/auth";
import { isDemoRequest } from "@/lib/demo";
import { groupOf, readAnswers, type SurveyKey } from "@/lib/surveys";

const ROLES = ["owner", "admin", "principal", "bursar", "teacher", "parent", "student"] as const;
const LATER_COOKIE = "sk_survey_later";

export async function submitSurvey(_prev: ActionState, fd: FormData): Promise<ActionState> {
  if (await isDemoRequest()) return { error: "In the demo, survey answers aren't saved." };
  const { supabase, school, membership } = await requireSchool([...ROLES]);
  const survey = fd.get("survey") === "end" ? "end" : fd.get("survey") === "baseline" ? "baseline" : null;
  const group = groupOf(membership.role);
  if (!survey || !group) return { error: "This survey isn't for your role." };
  const read = readAnswers(survey as SurveyKey, group, fd);
  if ("error" in read) return { error: read.error };
  const { error } = await supabase.rpc("submit_survey", { p_school: school.id, p_survey: survey, p_answers: read.answers });
  if (error) return { error: error.code === "P0001" ? error.message : "We couldn't save your answers. Try again." };
  revalidatePath(String(fd.get("page") ?? "/dashboard"));
  return { ok: true, message: "Thank you! Your answers are saved.", at: Date.now() };
}

/** "Not now": hides the survey for three days on this device. */
export async function surveyLater(fd: FormData) {
  const survey = fd.get("survey") === "end" ? "end" : "baseline";
  (await cookies()).set(LATER_COOKIE, survey, { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 3 * 86400 });
  revalidatePath(String(fd.get("page") ?? "/dashboard"));
}
