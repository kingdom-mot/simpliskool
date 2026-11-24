"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/components/forms";
import { requireSchool } from "@/lib/auth";

const HEADS = ["owner", "principal"] as const;

export async function clockStaff(
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const { supabase, school } = await requireSchool([...HEADS]);
  const user = z.string().uuid().safeParse(fd.get("user"));
  const date = String(fd.get("date") ?? "");
  const action = String(fd.get("action") ?? "");
  if (
    !user.success ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !["absent", "leave", "duty", "clear"].includes(action)
  )
    return { error: "Choose what to mark." };
  const note = String(fd.get("note") ?? "")
    .trim()
    .slice(0, 200);
  const { error } = await supabase.rpc("clock_staff", {
    p_school: school.id,
    p_user: user.data,
    p_date: date,
    p_action: action,
    p_note: note || null,
  });
  if (error)
    return {
      error: /reason/.test(error.message)
        ? "Give a reason for clearing the record."
        : /Future/.test(error.message)
          ? "You can't mark a future date."
          : /Already clocked in/.test(error.message)
            ? "They clocked in at school today, so they can't be marked absent or on leave."
            : "We couldn't save. Please try again.",
    };
  revalidatePath("/admin/staff-attendance");
  const what = {
    absent: "Marked absent",
    leave: "Marked on leave",
    duty: "Marked on official duty",
    clear: "Record cleared",
  }[action];
  return { ok: true, message: `${what}.`, at: Date.now() };
}
