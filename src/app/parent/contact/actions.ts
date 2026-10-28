"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { setFlash } from "@/lib/flash";
import { z } from "zod";
import type { ActionState } from "@/components/forms";
import { requireSchool } from "@/lib/auth";
import { emailLayout, escapeHtml, sendEmail } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/admin";
import { schoolColours } from "@/lib/theme";

const uuid = z.string().uuid();
const REASON: Record<string, string> = { unwell: "unwell", family: "a family event", travel: "travel", other: "another reason" };
const nice = (iso: string) => new Date(`${iso}T12:00:00+01:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Africa/Lagos" });

export async function reportAbsence(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, school, fullName } = await requireSchool(["parent"]);
  const st = uuid.safeParse(fd.get("child"));
  if (!st.success) return { error: "Choose the child." };
  const from = String(fd.get("from") ?? "");
  const to = String(fd.get("to") ?? "") || from;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return { error: "Choose the dates." };
  if (to < from) return { error: "The last day must be on or after the first day." };
  const reason = String(fd.get("reason") ?? "");
  if (!REASON[reason]) return { error: "Choose a reason." };
  const note = String(fd.get("note") ?? "").trim().slice(0, 500);
  const { data, error } = await supabase.rpc("report_absence", { p_student: st.data, p_from: from, p_to: to, p_reason: reason, p_note: note });
  if (error) {
    if (/Too far back/.test(error.message)) return { error: "You can report up to a week back. For older days, contact the school." };
    if (/Too long/.test(error.message)) return { error: "Report up to 30 days at a time." };
    if (/relation|function/i.test(error.message)) return { error: "This isn't switched on yet. Please call the school." };
    return { error: "We couldn't send the report. Please try again." };
  }
  const r = data as { teacher: string | null; teacher_email: string | null };
  const { data: kid } = await supabase.from("students").select("first_name, last_name, classes(name, arm)").eq("id", st.data).single<{ first_name: string; last_name: string; classes: { name: string; arm: string } | null }>();
  const days = from === to ? `on ${nice(from)}` : `from ${nice(from)} to ${nice(to)}`;
  // Let the class teacher know straight away.
  if (r.teacher_email && kid) {
    const { data: s } = await createAdminClient().from("schools").select("name, primary_color, secondary_color").eq("id", school.id).single<{ name: string; primary_color: string | null; secondary_color: string | null }>();
    const { c1 } = schoolColours(s?.primary_color, s?.secondary_color);
    const lines = [`${fullName} has told the school that ${kid.first_name} ${kid.last_name} will be absent ${days} (${REASON[reason]}).`, note ? `Note: "${note}"` : "", `${kid.first_name} will show as "excused" on the register for those days.`].filter(Boolean);
    await sendEmail({
      to: r.teacher_email,
      subject: `Absence reported: ${kid.first_name} ${kid.last_name}, ${days}`,
      html: emailLayout({ schoolName: s?.name ?? school.name, colour: c1, heading: `${kid.first_name} will be absent ${days}`, bodyHtml: lines.map((l) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.55">${escapeHtml(l)}</p>`).join(""), footer: `Sent by Simpliskool for ${escapeHtml(s?.name ?? school.name)}.` }),
      text: lines.join("\n\n"),
      fromName: s?.name ?? school.name,
    }).catch(() => null);
  }
  revalidatePath("/parent/contact");
  revalidatePath("/parent/attendance");
  return { ok: true, message: `Sent${r.teacher ? ` to ${r.teacher}` : " to the school"}. ${kid?.first_name ?? "Your child"} will be marked "excused" ${days} instead of absent.`, at: Date.now() };
}

export async function cancelReport(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireSchool(["parent"]);
  const id = uuid.safeParse(fd.get("id"));
  if (!id.success) return { error: "Something went wrong." };
  const { error } = await supabase.rpc("cancel_absence_report", { p_id: id.data });
  if (error) return { error: "We couldn't cancel it." };
  revalidatePath("/parent/contact");
  revalidatePath("/parent/attendance");
  // The report disappears from the list, so the confirmation is shown on the page.
  await setFlash("Report cancelled.", "/parent/contact");
  redirect("/parent/contact");
}
