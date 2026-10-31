import "server-only";
import { emailLayout, escapeHtml, sendEmail, sendEmailBatch } from "@/lib/email";
import { siteUrl } from "@/lib/notify";
import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

/** Emails of the school's owners (and other admin roles, if asked). */
export async function schoolEmails(admin: Admin, schoolId: string, roles: string[] = ["owner"]) {
  const { data } = await admin.from("memberships").select("profiles(email)").eq("school_id", schoolId).in("role", roles).returns<{ profiles: { email: string | null } | null }[]>();
  return [...new Set((data ?? []).map((m) => m.profiles?.email).filter((e): e is string => !!e && !e.endsWith("@students.simpliskool.com")))];
}

function build(heading: string, paragraphs: string[], button?: { label: string; path: string }) {
  const body =
    paragraphs.map((p) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.55">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`).join("") +
    (button ? `<p style="margin:16px 0 0"><a href="${siteUrl()}${button.path}" style="display:inline-block;background:#0B7D6E;color:#FFFFFF;text-decoration:none;font-weight:bold;padding:12px 18px;border-radius:10px">${escapeHtml(button.label)}</a></p>` : "");
  return {
    html: emailLayout({ schoolName: "Simpliskool", colour: "#0A1F3D", heading, bodyHtml: body, footer: "From the Simpliskool team at Dream Savvy Solutions. Reply to this email if you need help." }),
    text: `${heading}\n\n${paragraphs.join("\n\n")}${button ? `\n\n${siteUrl()}${button.path}` : ""}`,
  };
}

/** One email from the Simpliskool team (best effort: never stops the action). */
export async function teamEmail(to: string | string[], subject: string, heading: string, paragraphs: string[], button?: { label: string; path: string }) {
  const list = (Array.isArray(to) ? to : [to]).filter(Boolean);
  if (!list.length) return { sent: 0 };
  const { html, text } = build(heading, paragraphs, button);
  const replyTo = process.env.SUPPORT_EMAIL ?? null;
  if (list.length === 1) {
    const r = await sendEmail({ to: list[0], subject, html, text, replyTo });
    return { sent: r.ok ? 1 : 0 };
  }
  const r = await sendEmailBatch(list.map((e) => ({ to: e, subject, html, text, replyTo })));
  return { sent: r.sent };
}
