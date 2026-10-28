"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import type { ActionState } from "@/components/forms";

export async function rsvp(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireUser();
  const id = z.string().uuid().safeParse(fd.get("id"));
  if (!id.success) return { error: "Something went wrong." };
  const going = fd.get("going") === "1";
  const { error } = await supabase.rpc("set_rsvp", { p_id: id.data, p_going: going });
  if (error) return { error: "We couldn't save your answer. Please try again." };
  revalidatePath("/parent/notices");
  return { ok: true, message: going ? "Thanks! The school knows you'll attend." : "Thanks for letting the school know.", at: Date.now() };
}
