"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { SETUP_ROLES } from "@/components/admin";
import type { ActionState } from "@/components/forms";
import { requireSchool } from "@/lib/auth";
import { emailReady } from "@/lib/email";
import { findOrCreateUser, normalizeEmail, normalizePhone } from "@/lib/people";
import { emailFromSchool } from "@/lib/school-email";

const uuid = z.string().uuid();
type Ctx = Awaited<ReturnType<typeof requireSchool>>;

/** Emails one parent how to sign in, and records the invite. */
async function invite(ctx: Ctx, parent: { id: string; name: string | null; email: string | null; children: string[] }) {
  if (!parent.email || parent.email.endsWith("@students.simpliskool.com")) return "no-email" as const;
  const kids = parent.children.length ? parent.children.join(" and ") : "your child";
  const r = await emailFromSchool(ctx.school.id, {
    to: parent.email,
    heading: `Join ${ctx.school.name} on Simpliskool`,
    paragraphs: [
      `Dear ${parent.name?.split(/\s+/)[0] || "parent"},`,
      `${ctx.school.name} uses Simpliskool to share attendance, results, fees and school news. You can follow ${kids} from your phone.`,
      `To sign in, open the link below and enter this email address (${parent.email}). We'll send you a code; there's no password to remember.`,
    ],
    button: { label: "Open the parent app", href: "/login" },
  });
  if (!r.ok) return r.skipped ? ("skipped" as const) : ("failed" as const);
  await ctx.supabase.from("parent_invites").upsert({ school_id: ctx.school.id, user_id: parent.id, sent_at: new Date().toISOString(), sent_by: ctx.user.id }, { onConflict: "school_id,user_id" });
  return "sent" as const;
}

type Parent = { id: string; name: string; email: string | null; phone: string | null; joined: boolean; invited_at: string | null; children: { name: string }[] };

export async function inviteParent(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireSchool(SETUP_ROLES);
  const id = uuid.safeParse(fd.get("id"));
  if (!id.success) return { error: "Something went wrong." };
  if (!emailReady()) return { error: "Email isn't set up yet, so invites can't be sent." };
  const { data } = await ctx.supabase.rpc("parent_list", { p_school: ctx.school.id });
  const p = ((data as Parent[] | null) ?? []).find((x) => x.id === id.data);
  if (!p) return { error: "Parent not found." };
  const r = await invite(ctx, { id: p.id, name: p.name, email: p.email, children: p.children.map((c) => c.name) });
  revalidatePath("/admin/parents");
  if (r === "no-email") return { error: `${p.name} has no email. Invites by text message come when SMS is switched on; for now, tell them to sign in at simpliskool.com with their phone number.` };
  if (r !== "sent") return { error: "The invite email didn't send. Please try again later." };
  return { ok: true, message: `Invite sent to ${p.email}.`, at: Date.now() };
}

export async function inviteAllParents(): Promise<ActionState> {
  const ctx = await requireSchool(SETUP_ROLES);
  if (!emailReady()) return { error: "Email isn't set up yet, so invites can't be sent." };
  const { data } = await ctx.supabase.rpc("parent_list", { p_school: ctx.school.id });
  const todo = ((data as Parent[] | null) ?? []).filter((p) => !p.joined && !p.invited_at);
  let sent = 0;
  let noEmail = 0;
  let failed = 0;
  for (const p of todo) {
    const r = await invite(ctx, { id: p.id, name: p.name, email: p.email, children: p.children.map((c) => c.name) });
    if (r === "sent") sent++;
    else if (r === "no-email") noEmail++;
    else failed++;
  }
  revalidatePath("/admin/parents");
  if (!todo.length) return { ok: true, message: "Every parent has already been invited or has joined.", at: Date.now() };
  return { ok: true, message: `Invites sent to ${sent} parent${sent === 1 ? "" : "s"}.${noEmail ? ` ${noEmail} have no email: they can sign in with their phone number.` : ""}${failed ? ` ${failed} failed.` : ""}`, at: Date.now() };
}

export async function addParent(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireSchool(SETUP_ROLES);
  const name = String(fd.get("name") ?? "").trim();
  if (name.length < 2) return { error: "Enter the parent's full name." };
  const phoneRaw = String(fd.get("phone") ?? "").trim();
  const emailRaw = String(fd.get("email") ?? "").trim();
  const phone = normalizePhone(phoneRaw);
  const email = normalizeEmail(emailRaw);
  if (!phone && !email) return { error: "Enter the parent's phone number or email, so they can sign in." };
  if (phoneRaw && !phone) return { error: "That phone number doesn't look right. Use 11 digits, like 08031234567." };
  if (emailRaw && !email) return { error: "That email doesn't look right." };
  const studentId = uuid.safeParse(fd.get("student_id"));
  if (!studentId.success) return { error: "Choose their child." };
  const { data: st } = await ctx.supabase.from("students").select("id, first_name").eq("id", studentId.data).eq("school_id", ctx.school.id).maybeSingle<{ id: string; first_name: string }>();
  if (!st) return { error: "Choose their child." };
  const userId = await findOrCreateUser({ email, phone, fullName: name });
  if (!userId) return { error: "We couldn't create an account for this parent. Please check the details." };
  const { error: mErr } = await ctx.supabase.from("memberships").upsert({ school_id: ctx.school.id, user_id: userId, role: "parent" }, { onConflict: "school_id,user_id,role", ignoreDuplicates: true });
  const rel = String(fd.get("relationship") ?? "").trim().slice(0, 30) || null;
  const { error: gErr } = await ctx.supabase.from("guardians").upsert({ school_id: ctx.school.id, student_id: st.id, user_id: userId, relationship: rel }, { onConflict: "student_id,user_id", ignoreDuplicates: true });
  if (mErr || gErr) return { error: "We couldn't link this parent. Please try again." };
  let note = "";
  if (fd.get("invite") === "1" && email && emailReady()) {
    const r = await invite(ctx, { id: userId, name, email, children: [st.first_name] });
    note = r === "sent" ? " Invite emailed." : "";
  }
  revalidatePath("/admin/parents");
  revalidatePath(`/admin/students/${st.id}`);
  return { ok: true, message: `${name} added as ${st.first_name}'s parent.${note}`, at: Date.now() };
}
