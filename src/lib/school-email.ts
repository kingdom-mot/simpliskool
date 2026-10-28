import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailLayout, escapeHtml, sendEmail, type EmailResult } from "@/lib/email";
import { siteUrl } from "@/lib/notify";
import { schoolColours } from "@/lib/theme";

/** A simple email from the school: a heading, paragraphs and an optional button. */
export async function emailFromSchool(schoolId: string, msg: { to: string; heading: string; paragraphs: string[]; button?: { label: string; href: string } }): Promise<EmailResult> {
  const admin = createAdminClient();
  const { data: s } = await admin.from("schools").select("name, email, phone, primary_color, secondary_color").eq("id", schoolId).single<{ name: string; email: string | null; phone: string | null; primary_color: string | null; secondary_color: string | null }>();
  if (!s) return { ok: false, skipped: false, error: "School not found" };
  const { c1 } = schoolColours(s.primary_color, s.secondary_color);
  const contact = [s.phone, s.email].filter(Boolean).join(" or ");
  const body =
    msg.paragraphs.map((p) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.55">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`).join("") +
    (msg.button ? `<p style="margin:16px 0 0"><a href="${msg.button.href.startsWith("http") ? msg.button.href : siteUrl() + msg.button.href}" style="display:inline-block;background:${c1};color:#FFFFFF;text-decoration:none;font-weight:bold;padding:12px 18px;border-radius:10px">${escapeHtml(msg.button.label)}</a></p>` : "") +
    (contact ? `<p style="margin:16px 0 0;font-size:13px;color:#4A5A70">Questions? Contact ${escapeHtml(s.name)} on ${escapeHtml(contact)}.</p>` : "");
  const html = emailLayout({ schoolName: s.name, colour: c1, heading: msg.heading, bodyHtml: body, footer: `Sent by ${escapeHtml(s.name)} with Simpliskool.` });
  return sendEmail({ to: msg.to, subject: `${msg.heading} · ${s.name}`, html, text: `${msg.heading}\n\n${msg.paragraphs.join("\n\n")}${msg.button ? `\n\n${msg.button.label}: ${msg.button.href.startsWith("http") ? msg.button.href : siteUrl() + msg.button.href}` : ""}`, fromName: s.name, replyTo: s.email });
}
