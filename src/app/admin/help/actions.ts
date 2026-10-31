"use server";

import { redirect } from "next/navigation";
import type { ActionState } from "@/components/forms";
import { requireSchool } from "@/lib/auth";
import { setFlash } from "@/lib/flash";
import { teamEmail } from "@/lib/platform-mail";
import { isDemoRequest } from "@/lib/demo";

const ROLES = ["owner", "admin", "principal", "bursar"] as const;

/** Opens a request to the Simpliskool team. */
export async function openTicket(_prev: ActionState, fd: FormData): Promise<ActionState> {
  if (await isDemoRequest()) return { error: "In the demo, help requests aren't sent. In your own school, they reach the Simpliskool team straight away." };
  const { supabase, school, fullName } = await requireSchool([...ROLES]);
  const subject = String(fd.get("subject") ?? "").trim();
  const body = String(fd.get("body") ?? "").trim();
  const priority = fd.get("urgent") === "on" ? "urgent" : "normal";
  const { data, error } = await supabase.rpc("open_ticket", { p_school: school.id, p_subject: subject, p_body: body, p_priority: priority });
  if (error) {
    if (/function/i.test(error.message)) return { error: "Help requests aren't switched on yet. Email support@simpliskool.com instead." };
    return { error: error.code === "P0001" ? error.message : "We couldn't send your request. Try again, or email support@simpliskool.com." };
  }
  const inbox = process.env.SUPPORT_EMAIL;
  if (inbox) await teamEmail(inbox, `${priority === "urgent" ? "URGENT: " : ""}${subject} [#${data}]`, `New request from ${school.name}`, [`From ${fullName}:`, body], { label: "Open the support inbox", path: `/super/support?t=${data}` });
  await setFlash(`Request #${data} sent. We usually reply within 4 working hours, by email and here.`, "/admin/help");
  redirect(`/admin/help?t=${data}`);
}

export async function replyToTeam(_prev: ActionState, fd: FormData): Promise<ActionState> {
  if (await isDemoRequest()) return { error: "In the demo, replies aren't sent." };
  const { supabase, school, fullName } = await requireSchool([...ROLES]);
  const id = Number(fd.get("ticket_id"));
  const body = String(fd.get("body") ?? "").trim();
  if (!Number.isInteger(id)) return { error: "Choose a request." };
  const { error } = await supabase.rpc("reply_ticket", { p_ticket: id, p_body: body });
  if (error) return { error: error.code === "P0001" ? error.message : "We couldn't send your reply." };
  const inbox = process.env.SUPPORT_EMAIL;
  if (inbox) await teamEmail(inbox, `Reply on request #${id} from ${school.name}`, `${fullName} replied`, [body], { label: "Open the request", path: `/super/support?t=${id}` });
  await setFlash("Reply sent.", "/admin/help");
  redirect(`/admin/help?t=${id}`);
}
