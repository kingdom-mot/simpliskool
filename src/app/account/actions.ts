"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/components/forms";
import { requireUser } from "@/lib/auth";

export async function saveName(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, user } = await requireUser();
  const name = String(fd.get("full_name") ?? "").replace(/\s+/g, " ").trim();
  if (name.length < 2 || name.length > 120) return { error: "Enter your full name." };
  const { error } = await supabase.from("profiles").update({ full_name: name }).eq("id", user.id);
  if (error) return { error: "We couldn't save your name." };
  revalidatePath("/", "layout");
  return { ok: true, message: "Name saved. The school sees this name.", at: Date.now() };
}

export async function saveMessages(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, user } = await requireUser();
  const want = { email: fd.get("email") === "1", sms: fd.get("sms") === "1" };
  for (const ch of ["email", "sms"] as const) {
    const { error } = want[ch]
      ? await supabase.from("message_optouts").delete().eq("user_id", user.id).eq("channel", ch)
      : await supabase.from("message_optouts").upsert({ user_id: user.id, channel: ch }, { onConflict: "user_id,channel", ignoreDuplicates: true });
    if (error) return { error: /relation/i.test(error.message) ? "This isn't switched on yet." : "We couldn't save your choices." };
  }
  revalidatePath("/account");
  const on = [want.email && "emails", want.sms && "texts"].filter(Boolean).join(" and ");
  return { ok: true, message: on ? `Saved. You'll get school ${on}.` : "Saved. You won't get school emails or texts; check the app for news. Sign-in codes still come.", at: Date.now() };
}

/** Signs this account out on every phone and computer. */
export async function signOutEverywhere(): Promise<ActionState> {
  const { supabase } = await requireUser();
  await supabase.auth.signOut({ scope: "global" });
  redirect("/login?signed_out=1");
}
