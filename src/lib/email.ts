import "server-only";

/**
 * Sends one email through Resend (https://resend.com).
 * Without RESEND_API_KEY nothing is sent and the result says "skipped", so the
 * rest of the app keeps working before email is set up.
 */
export type EmailResult = { ok: true; id: string } | { ok: false; skipped: boolean; error: string };

export function emailReady() {
  return !!process.env.RESEND_API_KEY;
}

export async function sendEmail(msg: { to: string; subject: string; html: string; text: string; fromName?: string; replyTo?: string | null }): Promise<EmailResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, skipped: true, error: "Email isn't set up yet (RESEND_API_KEY missing)." };
  const fromAddress = process.env.EMAIL_FROM_ADDRESS ?? "notifications@simpliskool.com";
  // Display name like "Bright Stars College via Simpliskool"; quotes and angle brackets removed.
  const name = (msg.fromName ? `${msg.fromName} via Simpliskool` : "Simpliskool").replace(/["<>]/g, "");
  try {
    const res = await fetch(`${process.env.RESEND_API_URL ?? "https://api.resend.com"}/emails`, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: `${name} <${fromAddress}>`,
        to: [msg.to],
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
        ...(msg.replyTo ? { reply_to: msg.replyTo } : {}),
      }),
      signal: AbortSignal.timeout(10000),
    });
    const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok || !data.id) return { ok: false, skipped: false, error: data.message ?? `Email service error ${res.status}` };
    return { ok: true, id: data.id };
  } catch (e) {
    return { ok: false, skipped: false, error: e instanceof Error ? e.message : "Email service unreachable" };
  }
}

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** A simple email layout in the school's main colour. Content is already-escaped HTML. */
export function emailLayout({ schoolName, colour, heading, bodyHtml, footer }: { schoolName: string; colour: string; heading: string; bodyHtml: string; footer: string }) {
  const s = escapeHtml(schoolName);
  return `<!doctype html><html><body style="margin:0;background:#F5F8FC;font-family:Arial,Helvetica,sans-serif;color:#263449">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F8FC;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border-radius:16px;overflow:hidden;border:1px solid #E3EAF3">
<tr><td style="background:${colour};color:#FFFFFF;padding:18px 24px;font-size:18px;font-weight:bold">${s}</td></tr>
<tr><td style="padding:24px">
<h1 style="margin:0 0 12px;font-size:20px;color:${colour}">${escapeHtml(heading)}</h1>
${bodyHtml}
</td></tr>
<tr><td style="padding:16px 24px;border-top:1px solid #EEF3F9;font-size:12px;color:#4A5A70">${footer}</td></tr>
</table></td></tr></table></body></html>`;
}

/** Sends up to 100 emails per request (Resend batch API). Returns how many were accepted. */
export async function sendEmailBatch(msgs: { to: string; subject: string; html: string; text: string; fromName?: string; replyTo?: string | null }[]): Promise<{ sent: number; failed: number; skipped: boolean }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { sent: 0, failed: 0, skipped: true };
  const fromAddress = process.env.EMAIL_FROM_ADDRESS ?? "notifications@simpliskool.com";
  let sent = 0;
  let failed = 0;
  for (let i = 0; i < msgs.length; i += 100) {
    const chunk = msgs.slice(i, i + 100);
    try {
      const res = await fetch(`${process.env.RESEND_API_URL ?? "https://api.resend.com"}/emails/batch`, {
        method: "POST",
        headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
        body: JSON.stringify(
          chunk.map((m) => ({
            from: `${(m.fromName ? `${m.fromName} via Simpliskool` : "Simpliskool").replace(/["<>]/g, "")} <${fromAddress}>`,
            to: [m.to],
            subject: m.subject,
            html: m.html,
            text: m.text,
            ...(m.replyTo ? { reply_to: m.replyTo } : {}),
          })),
        ),
        signal: AbortSignal.timeout(20000),
      });
      if (res.ok) sent += chunk.length;
      else failed += chunk.length;
    } catch {
      failed += chunk.length;
    }
  }
  return { sent, failed, skipped: false };
}
