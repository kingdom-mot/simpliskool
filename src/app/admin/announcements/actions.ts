"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSchool } from "@/lib/auth";
import type { ActionState } from "@/components/forms";
import { deliverAnnouncement } from "@/lib/announce";
import { setFlash } from "@/lib/flash";
import { RESULTS_ADMIN } from "@/lib/results";

const uuid = z.string().uuid();
const schema = z.object({
  title: z.string().trim().min(3, "Give the announcement a title").max(120, "Keep the title under 120 characters"),
  body: z.string().trim().min(1, "Write the message").max(3000, "Keep the message under 3,000 characters"),
  audience: z.enum(["school", "parents", "staff", "class"]),
  kind: z.enum(["notice", "event"]),
});

export async function sendAnnouncement(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, school, user } = await requireSchool(RESULTS_ADMIN);
  const p = schema.safeParse({ title: fd.get("title"), body: fd.get("body"), audience: fd.get("audience"), kind: fd.get("kind") ?? "notice" });
  if (!p.success) return { error: p.error.issues[0].message };
  const classIds = [...new Set(fd.getAll("class").map(String))].filter((c) => uuid.safeParse(c).success);
  if (p.data.audience === "class" && !classIds.length) return { error: "Choose at least one class." };
  let eventAt: string | null = null;
  if (p.data.kind === "event") {
    const d = String(fd.get("event_date") ?? "");
    const t = String(fd.get("event_time") ?? "") || "09:00";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !/^\d{2}:\d{2}$/.test(t)) return { error: "Choose the event's date and time." };
    eventAt = new Date(`${d}T${t}:00+01:00`).toISOString();
  }
  const sendEmail = fd.get("email") === "1";
  const sendSms = fd.get("sms") === "1";
  const base = { school_id: school.id, title: p.data.title, body: p.data.body, audience: p.data.audience, class_ids: p.data.audience === "class" ? classIds : null, kind: p.data.kind, event_at: eventAt, created_by: user.id, send_email: sendEmail, send_sms: sendSms };

  // Later: kept out of sight until its time comes.
  if (fd.get("when") === "later") {
    const d = String(fd.get("publish_date") ?? "");
    const t = String(fd.get("publish_time") ?? "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !/^\d{2}:\d{2}$/.test(t)) return { error: "Choose the date and time to send it." };
    const at = new Date(`${d}T${t}:00+01:00`);
    if (at.getTime() < Date.now() + 60000) return { error: "Choose a time in the future, or send it now." };
    if (at.getTime() > Date.now() + 120 * 86400000) return { error: "You can schedule up to 4 months ahead." };
    if (eventAt && at.toISOString() > eventAt) return { error: "Send it before the event starts." };
    const { error } = await supabase.from("scheduled_announcements").insert({ ...base, publish_at: at.toISOString() });
    if (error) return { error: /relation|column/i.test(error.message) ? "Run database file 0014_payments_sms_schedule.sql in Supabase first." : "We couldn't schedule the announcement. Please try again." };
    revalidatePath("/admin/announcements");
    const nice = at.toLocaleString("en-GB", { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Africa/Lagos" });
    const how = [sendEmail && "email", sendSms && "SMS"].filter(Boolean).join(" and ");
    return { ok: true, message: `Scheduled for ${nice}. It appears in the app then${how ? `, and goes out by ${how} at the same time` : ""}. You can cancel it under "Waiting to send" below.`, at: Date.now() };
  }

  const { data: reach } = await supabase.rpc("announcement_reach", { p_school: school.id, p_audience: p.data.audience, p_classes: base.class_ids });
  const n = Number(reach) || 0;
  const { data: row, error } = await supabase
    .from("announcements")
    .insert({ ...base, reach: n, dispatched_at: sendEmail || sendSms ? null : new Date().toISOString() })
    .select("id")
    .single<{ id: string }>();
  if (error || !row) return { error: error && /column/i.test(error.message) ? "Run database file 0014_payments_sms_schedule.sql in Supabase first." : "We couldn't send the announcement. Please try again." };

  let extra = "";
  if (sendEmail || sendSms) {
    const d = await deliverAnnouncement(row.id);
    if (d && sendEmail) extra += d.emailSkipped ? " Emails weren't sent: email isn't set up yet." : ` Emailed ${d.emailed} ${d.emailed === 1 ? "person" : "people"}${d.emailFailed ? ` (${d.emailFailed} failed)` : ""}.`;
    if (d && sendSms) extra += d.smsSkipped ? " Texts weren't sent: SMS is off in Settings." : ` Texted ${d.texted} ${d.texted === 1 ? "phone" : "phones"}${d.smsFailed ? ` (${d.smsFailed} failed)` : ""}.`;
  }
  revalidatePath("/admin/announcements");
  return { ok: true, message: `Sent to ${n} ${n === 1 ? "person" : "people"} in the app.${extra} You'll see who has read it below.`, at: Date.now() };
}

export async function cancelScheduled(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, school } = await requireSchool(RESULTS_ADMIN);
  const id = uuid.safeParse(fd.get("id"));
  if (!id.success) return { error: "Something went wrong." };
  const { data, error } = await supabase.from("scheduled_announcements").delete().eq("id", id.data).eq("school_id", school.id).select("title");
  if (error) return { error: "We couldn't cancel it. Please try again." };
  if (!data?.length) return { error: "It has already been sent, so it can't be cancelled. You can delete it from the list instead." };
  revalidatePath("/admin/announcements");
  await setFlash(`Cancelled: "${data[0].title}" won't be sent.`, "/admin/announcements");
  redirect("/admin/announcements");
}

export async function deleteAnnouncement(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, school } = await requireSchool(RESULTS_ADMIN);
  const id = uuid.safeParse(fd.get("id"));
  if (!id.success) return { error: "Something went wrong." };
  const { data, error } = await supabase.from("announcements").delete().eq("id", id.data).eq("school_id", school.id).select("title");
  if (error || !data?.length) return { error: "We couldn't delete it. Please try again." };
  revalidatePath("/admin/announcements");
  // The deleted row disappears, so the confirmation is shown on the page.
  await setFlash("Announcement deleted. People can no longer see it.", "/admin/announcements");
  redirect("/admin/announcements");
}
