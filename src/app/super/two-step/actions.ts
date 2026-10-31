"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ActionState } from "@/components/forms";
import { PASS_COOKIE, PASS_HOURS, teamMember } from "@/lib/platform";
import { checkTotp, signPass, unseal } from "@/lib/totp";

/** Checks the code from the authenticator app (and turns two-step on the first time). */
export async function confirmTwoStep(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const m = await teamMember();
  if (!m) redirect("/dashboard");
  const since = new Date(Date.now() - 15 * 60_000).toISOString();
  const { count } = await m.admin.from("platform_audit").select("id", { count: "exact", head: true }).eq("actor_id", m.user.id).eq("action", "Wrong two-step code").gte("created_at", since);
  if ((count ?? 0) >= 5) return { error: "Too many wrong codes. Wait 15 minutes, then try again." };
  const secret = unseal(m.team.totp_secret);
  const code = String(fd.get("code") ?? "");
  if (!secret || !checkTotp(secret, code)) {
    await m.admin.from("platform_audit").insert({ actor_id: m.user.id, actor_name: m.fullName, action: "Wrong two-step code", kind: "access", detail: null });
    return { error: "That code isn't right. Check the time on your phone is set automatically, then use the newest code." };
  }
  if (!m.team.totp_on_at) {
    await m.admin.from("platform_team").update({ totp_on_at: new Date().toISOString() }).eq("user_id", m.user.id);
    await m.admin.from("platform_audit").insert({ actor_id: m.user.id, actor_name: m.fullName, action: "Turned on two-step sign-in", kind: "access", detail: null });
  }
  (await cookies()).set(PASS_COOKIE, signPass(m.user.id, Date.now() + PASS_HOURS * 3600_000), { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: PASS_HOURS * 3600 });
  redirect("/super");
}
