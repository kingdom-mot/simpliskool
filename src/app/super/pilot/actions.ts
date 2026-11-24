"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/components/forms";
import { logPlatform, requirePlatform } from "@/lib/platform";
import { getSettings } from "@/lib/platform-settings";

/** Opens or closes the end-of-pilot survey, and sets how long the baseline survey shows. */
export async function saveSurveySettings(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requirePlatform("pilot");
  if (!ctx.can("platform") && !ctx.can("support")) return { error: "Only a super admin or support can change this." };
  const old = await getSettings();
  const days = Math.floor(Number(fd.get("baseline_days")));
  if (!Number.isFinite(days) || days < 0 || days > 120) return { error: "Days must be between 0 and 120." };
  const endOpen = fd.get("end_survey_open") === "1";
  const next = { ...old, end_survey_open: endOpen, baseline_days: days };
  await ctx.admin.from("platform_settings").upsert({ id: true, data: next, updated_by: ctx.user.id, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (endOpen !== old.end_survey_open) await logPlatform(ctx, endOpen ? "Opened the end-of-pilot survey" : "Closed the end-of-pilot survey", "other", null);
  revalidatePath("/super/pilot");
  return { ok: true, message: endOpen ? "Saved. Everyone now sees the end-of-pilot survey on their home page." : "Saved.", at: Date.now() };
}
