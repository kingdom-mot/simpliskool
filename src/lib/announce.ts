import "server-only";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailLayout, escapeHtml, sendEmailBatch } from "@/lib/email";
import { siteUrl } from "@/lib/notify";
import { normalizePhone } from "@/lib/people";
import { sendSmsBulk, shortName, smsReady, smsSettings } from "@/lib/sms";
import { schoolColours } from "@/lib/theme";
import { optedOut } from "@/lib/optouts";

type Row = { id: string; school_id: string; title: string; body: string; audience: string; class_ids: string[] | null; kind: string; event_at: string | null; send_email: boolean; send_sms: boolean };
export type Delivery = { emailed: number; emailFailed: number; emailSkipped: boolean; texted: number; smsFailed: number; smsSkipped: boolean };

/**
 * Sends one announcement's email and SMS. Claims it first (dispatched_at), so it
 * is never sent twice even if two servers try at once.
 */
export async function deliverAnnouncement(id: string): Promise<Delivery | null> {
  const admin = createAdminClient();
  const { data: claimed } = await admin
    .from("announcements")
    .update({ dispatched_at: new Date().toISOString() })
    .eq("id", id)
    .is("dispatched_at", null)
    .select("id, school_id, title, body, audience, class_ids, kind, event_at, send_email, send_sms")
    .returns<Row[]>();
  const a = claimed?.[0];
  if (!a) return null;
  const out: Delivery = { emailed: 0, emailFailed: 0, emailSkipped: false, texted: 0, smsFailed: 0, smsSkipped: false };

  const { data: ids } = await admin.rpc("announcement_users", { p_school: a.school_id, p_audience: a.audience, p_classes: a.class_ids });
  const userIds = ((ids ?? []) as { user_id: string }[]).map((x) => x.user_id);
  const people: { id: string; email: string | null; phone: string | null }[] = [];
  for (let i = 0; i < userIds.length; i += 300) {
    const { data } = await admin.from("profiles").select("id, email, phone").in("id", userIds.slice(i, i + 300));
    people.push(...((data ?? []) as { id: string; email: string | null; phone: string | null }[]));
  }
  const [noEmail, noSms] = await Promise.all([optedOut(admin, userIds, "email"), optedOut(admin, userIds, "sms")]);
  const { data: s } = await admin.from("schools").select("name, email, phone, primary_color, secondary_color").eq("id", a.school_id).single<{ name: string; email: string | null; phone: string | null; primary_color: string | null; secondary_color: string | null }>();
  const name = s?.name ?? "Your school";
  const when = a.event_at ? new Date(a.event_at).toLocaleString("en-GB", { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Africa/Lagos" }) : null;

  if (a.send_email) {
    const { c1 } = schoolColours(s?.primary_color, s?.secondary_color);
    const to = [...new Set(people.filter((x) => !noEmail.has(x.id)).map((x) => x.email?.trim().toLowerCase()).filter((e): e is string => !!e && !e.endsWith("@students.simpliskool.com")))];
    const html = emailLayout({
      schoolName: name,
      colour: c1,
      heading: a.title,
      bodyHtml:
        (when ? `<p style="margin:0 0 12px;font-size:15px"><strong>When:</strong> ${escapeHtml(when)}</p>` : "") +
        `<p style="margin:0 0 12px;font-size:15px;line-height:1.55">${escapeHtml(a.body).replace(/\n/g, "<br>")}</p>` +
        `<p style="margin:16px 0 0"><a href="${siteUrl()}/login" style="display:inline-block;background:${c1};color:#FFFFFF;text-decoration:none;font-weight:bold;padding:12px 18px;border-radius:10px">Open Simpliskool</a></p>`,
      footer: `Sent by ${escapeHtml(name)} with Simpliskool.`,
    });
    const r = await sendEmailBatch(to.map((email) => ({ to: email, subject: `${a.title} · ${name}`, html, text: `${a.title}\n\n${when ? `When: ${when}\n\n` : ""}${a.body}`, fromName: name, replyTo: s?.email })));
    out.emailed = r.sent;
    out.emailFailed = r.failed;
    out.emailSkipped = r.skipped;
  }

  if (a.send_sms) {
    const settings = await smsSettings(admin, a.school_id);
    if (!smsReady() || !settings.sms_enabled) out.smsSkipped = true;
    else {
      const phones = [...new Set(people.filter((x) => !noSms.has(x.id)).map((x) => normalizePhone(x.phone)).filter((p): p is string => !!p))];
      const text = `${shortName(name)}: ${a.title}.${when ? ` ${when}.` : ""} ${a.body}`;
      const r = await sendSmsBulk(phones, text.length > 300 ? `${text.slice(0, 250)}... More in the Simpliskool app.` : text);
      out.texted = r.sent;
      out.smsFailed = r.failed;
      out.smsSkipped = r.skipped;
    }
  }
  await admin.from("announcements").update({ emailed: out.emailed, sms_sent: out.texted }).eq("id", a.id);
  return out;
}

/** Releases announcements whose time has come and sends any emails and texts still owed. */
export async function dispatchDue() {
  const admin = createAdminClient();
  const { data: released } = await admin.rpc("release_due_announcements");
  const { data: owed } = await admin
    .from("announcements")
    .select("id")
    .is("dispatched_at", null)
    .gte("created_at", new Date(Date.now() - 3 * 86400000).toISOString())
    .order("created_at")
    .limit(25)
    .returns<{ id: string }[]>();
  let delivered = 0;
  for (const o of owed ?? []) if (await deliverAnnouncement(o.id)) delivered++;
  return { released: Number(released) || 0, delivered };
}

let lastRelease = 0;

/**
 * Called as pages load, so scheduled announcements appear on time even without a
 * cron job: releases due ones now (at most every 30 seconds per server) and sends
 * their emails and texts after the page has been sent.
 */
export async function releaseDueSoon() {
  if (Date.now() - lastRelease < 30000) return;
  lastRelease = Date.now();
  try {
    const admin = createAdminClient();
    const { data } = await admin.rpc("release_due_announcements");
    const { count } = await admin.from("announcements").select("id", { count: "exact", head: true }).is("dispatched_at", null);
    if (Number(data) > 0 || (count ?? 0) > 0) {
      after(async () => {
        try {
          await dispatchDue();
        } catch (e) {
          console.error("Announcement dispatch failed", e);
        }
      });
    }
  } catch {
    // Before database file 0014 is run there is nothing to release.
  }
}
