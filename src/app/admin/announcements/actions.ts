"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSchool } from "@/lib/auth";
import type { ActionState } from "@/components/forms";
import { emailLayout, escapeHtml, sendEmailBatch } from "@/lib/email";
import { siteUrl } from "@/lib/notify";
import { RESULTS_ADMIN } from "@/lib/results";
import { createAdminClient } from "@/lib/supabase/admin";
import { schoolColours } from "@/lib/theme";

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
  const { data: reach } = await supabase.rpc("announcement_reach", { p_school: school.id, p_audience: p.data.audience, p_classes: p.data.audience === "class" ? classIds : null });
  const { data: row, error } = await supabase
    .from("announcements")
    .insert({ school_id: school.id, title: p.data.title, body: p.data.body, audience: p.data.audience, class_ids: p.data.audience === "class" ? classIds : null, kind: p.data.kind, event_at: eventAt, created_by: user.id, reach: Number(reach) || 0 })
    .select("id")
    .single<{ id: string }>();
  if (error || !row) return { error: "We couldn't send the announcement. Please try again." };

  let mail = "";
  if (fd.get("email") === "1") {
    const admin = createAdminClient();
    const { data: ids } = await admin.rpc("announcement_users", { p_school: school.id, p_audience: p.data.audience, p_classes: p.data.audience === "class" ? classIds : null });
    const userIds = ((ids ?? []) as { user_id: string }[]).map((x) => x.user_id);
    const { data: people } = userIds.length ? await admin.from("profiles").select("email, full_name").in("id", userIds) : { data: [] as { email: string | null; full_name: string | null }[] };
    const { data: s } = await admin.from("schools").select("name, email, primary_color, secondary_color").eq("id", school.id).single<{ name: string; email: string | null; primary_color: string | null; secondary_color: string | null }>();
    const { c1 } = schoolColours(s?.primary_color, s?.secondary_color);
    const when = eventAt ? new Date(eventAt).toLocaleString("en-GB", { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Africa/Lagos" }) : null;
    const to = [...new Set((people ?? []).map((x) => x.email?.trim().toLowerCase()).filter((e): e is string => !!e && !e.endsWith("@students.simpliskool.com")))];
    const body = escapeHtml(p.data.body).replace(/\n/g, "<br>");
    const html = emailLayout({
      schoolName: s?.name ?? school.name,
      colour: c1,
      heading: p.data.title,
      bodyHtml:
        (when ? `<p style="margin:0 0 12px;font-size:15px"><strong>When:</strong> ${escapeHtml(when)}</p>` : "") +
        `<p style="margin:0 0 12px;font-size:15px;line-height:1.55">${body}</p>` +
        `<p style="margin:16px 0 0"><a href="${siteUrl()}/login" style="display:inline-block;background:${c1};color:#FFFFFF;text-decoration:none;font-weight:bold;padding:12px 18px;border-radius:10px">Open Simpliskool</a></p>`,
      footer: `Sent by ${escapeHtml(s?.name ?? school.name)} with Simpliskool.`,
    });
    const r = await sendEmailBatch(to.map((email) => ({ to: email, subject: `${p.data.title} · ${s?.name ?? school.name}`, html, text: `${p.data.title}\n\n${when ? `When: ${when}\n\n` : ""}${p.data.body}`, fromName: s?.name ?? school.name, replyTo: s?.email })));
    await admin.from("announcements").update({ emailed: r.sent }).eq("id", row.id);
    mail = r.skipped ? " Emails weren't sent: email isn't set up yet." : ` Emailed ${r.sent} ${r.sent === 1 ? "person" : "people"}${r.failed ? ` (${r.failed} failed)` : ""}.`;
  }
  revalidatePath("/admin/announcements");
  return { ok: true, message: `Sent to ${Number(reach) || 0} ${Number(reach) === 1 ? "person" : "people"} in the app.${mail} You'll see who has read it below.`, at: Date.now() };
}

export async function deleteAnnouncement(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, school } = await requireSchool(RESULTS_ADMIN);
  const id = uuid.safeParse(fd.get("id"));
  if (!id.success) return { error: "Something went wrong." };
  const { data, error } = await supabase.from("announcements").delete().eq("id", id.data).eq("school_id", school.id).select("title");
  if (error || !data?.length) return { error: "We couldn't delete it. Please try again." };
  revalidatePath("/admin/announcements");
  // The deleted row disappears, so the confirmation is shown on the page.
  redirect("/admin/announcements?deleted=1");
}
