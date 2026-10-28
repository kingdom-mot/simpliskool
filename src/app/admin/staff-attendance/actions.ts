"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/components/forms";
import { requireSchool } from "@/lib/auth";

const HEADS = ["owner", "principal"] as const;

export async function clockStaff(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, school } = await requireSchool([...HEADS]);
  const user = z.string().uuid().safeParse(fd.get("user"));
  const date = String(fd.get("date") ?? "");
  const action = String(fd.get("action") ?? "");
  if (!user.success || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !["in", "out", "absent", "leave", "duty", "clear"].includes(action)) return { error: "Choose what to mark." };
  const note = String(fd.get("note") ?? "").trim().slice(0, 200);
  const { error } = await supabase.rpc("clock_staff", { p_school: school.id, p_user: user.data, p_date: date, p_action: action, p_note: note || null });
  if (error) return { error: /reason/.test(error.message) ? "Give a reason for clearing the record." : /Future/.test(error.message) ? "You can't mark a future date." : "We couldn't save. Please try again." };
  revalidatePath("/admin/staff-attendance");
  const what = { in: "Clocked in", out: "Clocked out", absent: "Marked absent", leave: "Marked on leave", duty: "Marked on official duty", clear: "Record cleared" }[action];
  return { ok: true, message: `${what}.`, at: Date.now() };
}

export async function setLateTime(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, school } = await requireSchool(["owner"]);
  const t = String(fd.get("late_after") ?? "");
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(t)) return { error: "Enter a time like 07:45." };
  const { error } = await supabase.from("schools").update({ staff_late_after: t }).eq("id", school.id);
  if (error) return { error: "We couldn't save." };
  revalidatePath("/admin/staff-attendance");
  return { ok: true, message: `Staff who clock in after ${t} are marked late.`, at: Date.now() };
}
