"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/components/forms";
import { requirePlatform } from "@/lib/platform";

/** Marks feedback as seen or done, with an optional team note. */
export async function markFeedback(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requirePlatform("feedback");
  const id = Number(fd.get("id"));
  const status = String(fd.get("status") ?? "");
  if (!Number.isInteger(id) || !["new", "seen", "done"].includes(status)) return { error: "Choose some feedback." };
  const note = String(fd.get("note") ?? "").trim().slice(0, 2000);
  const { error } = await ctx.admin.from("feedback").update({ status, ...(fd.has("note") ? { team_note: note || null } : {}) }).eq("id", id);
  if (error) return { error: "We couldn't save that." };
  revalidatePath("/super/feedback");
  return { ok: true, message: "Saved.", at: Date.now() };
}
