"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSchool, type Role } from "@/lib/auth";
import type { ActionState } from "@/components/forms";
import { SETUP_ROLES } from "@/components/admin";
import { normalizeEmail, normalizePhone } from "@/lib/people";
import { createAdminClient } from "@/lib/supabase/admin";

const STAFF_ROLES = ["admin", "principal", "bursar", "teacher"] as const;
type StaffRole = (typeof STAFF_ROLES)[number];
const oops = "Something went wrong. Please try again.";

/** Owners and admins can give any staff role; principals can add teachers and bursars. */
function canGrant(by: Role, role: StaffRole) {
  if (by === "owner" || by === "admin") return true;
  return by === "principal" && (role === "teacher" || role === "bursar");
}

function origin() {
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "simpliskool.com";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Sends a sign-in link to someone who already has an account. Failures are ignored: they can still sign in with a code. */
async function sendSignInLink(email: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return;
  const client = createPlainClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  await client.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: `${origin()}/auth/callback` } }).catch(() => null);
}

const inviteSchema = z.object({
  name: z.string().trim().min(2, "Enter their full name"),
  email: z.string().trim(),
  phone: z.string().trim(),
  role: z.enum(STAFF_ROLES),
});

export async function inviteStaff(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, school, membership } = await requireSchool(SETUP_ROLES);
  const parsed = inviteSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (!canGrant(membership.role, d.role)) return { error: "Only the owner or an admin can add admins and principals." };
  const email = normalizeEmail(d.email);
  if (!email) return { error: "Enter a valid email address. Staff sign in with a code sent to it." };
  const phone = d.phone ? normalizePhone(d.phone) : null;
  if (d.phone && !phone) return { error: "That phone number doesn't look right. Use 11 digits, like 08031234567." };

  const admin = createAdminClient();
  const { data: existing } = await admin.from("profiles").select("id, full_name, phone").ilike("email", email).limit(1).maybeSingle<{ id: string; full_name: string | null; phone: string | null }>();
  let userId = existing?.id ?? null;
  let invited = false;

  if (!userId) {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: d.name },
      redirectTo: `${origin()}/auth/callback`,
    });
    userId = data?.user?.id ?? null;
    invited = !!userId;
    if (!userId && error) {
      // Email sending can fail (for example before custom SMTP is set up). Create the account anyway;
      // they can still sign in at /login with a code.
      const { data: created } = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { full_name: d.name } });
      userId = created?.user?.id ?? null;
    }
  }
  if (!userId) return { error: "We couldn't create an account for that email. Please check it and try again." };

  const patch: Record<string, string> = {};
  if (!existing?.full_name?.trim()) patch.full_name = d.name;
  if (phone && !existing?.phone) patch.phone = phone;
  if (Object.keys(patch).length) await admin.from("profiles").update(patch).eq("id", userId);

  const { error: mErr } = await supabase.from("memberships").insert({ school_id: school.id, user_id: userId, role: d.role });
  if (mErr) {
    if (mErr.code === "23505") return { error: `${d.name} is already a ${d.role} here.` };
    return { error: "You don't have permission to add that role." };
  }
  if (!invited) await sendSignInLink(email);

  revalidatePath("/admin/staff");
  revalidatePath("/admin");
  return { ok: true, message: `${d.name} added as ${d.role}. We've emailed them a link to sign in.`, at: Date.now() };
}

export async function changeRole(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, school, membership, user } = await requireSchool(SETUP_ROLES);
  const userId = String(fd.get("user_id"));
  const from = String(fd.get("from")) as StaffRole;
  const to = String(fd.get("role")) as StaffRole;
  if (!z.string().uuid().safeParse(userId).success || !STAFF_ROLES.includes(to) || !STAFF_ROLES.includes(from)) return { error: oops };
  if (userId === user.id) return { error: "You can't change your own role." };
  if (from === to) return { ok: true, message: "No change.", at: Date.now() };
  if (!canGrant(membership.role, to) || !canGrant(membership.role, from)) return { error: "Only the owner or an admin can change admins and principals." };

  const { error: addErr } = await supabase.from("memberships").insert({ school_id: school.id, user_id: userId, role: to });
  if (addErr && addErr.code !== "23505") return { error: oops };
  const { error: delErr } = await supabase.from("memberships").delete().eq("school_id", school.id).eq("user_id", userId).eq("role", from);
  if (delErr) return { error: oops };
  revalidatePath("/admin/staff");
  return { ok: true, message: "Role changed.", at: Date.now() };
}

export async function removeStaff(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, school, membership, user } = await requireSchool(SETUP_ROLES);
  const userId = String(fd.get("user_id"));
  if (!z.string().uuid().safeParse(userId).success) return { error: oops };
  if (userId === user.id) return { error: "You can't remove yourself." };
  const { data: roles } = await supabase.from("memberships").select("role").eq("school_id", school.id).eq("user_id", userId);
  const staffRoles = (roles ?? []).map((r) => r.role as Role).filter((r) => r !== "parent" && r !== "student");
  if (staffRoles.includes("owner")) return { error: "The school owner can't be removed." };
  if (staffRoles.some((r) => !canGrant(membership.role, r as StaffRole))) return { error: "Only the owner or an admin can remove admins and principals." };

  const { error } = await supabase.from("memberships").delete().eq("school_id", school.id).eq("user_id", userId).in("role", STAFF_ROLES as unknown as string[]);
  if (error) return { error: oops };
  // They no longer teach or lead classes here.
  await supabase.from("classes").update({ class_teacher_id: null }).eq("school_id", school.id).eq("class_teacher_id", userId);
  await supabase.from("class_subjects").update({ teacher_id: null }).eq("school_id", school.id).eq("teacher_id", userId);
  revalidatePath("/admin/staff");
  return { ok: true, message: "Removed from the school.", at: Date.now() };
}

export async function resendInvite(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, school } = await requireSchool(SETUP_ROLES);
  const userId = String(fd.get("user_id"));
  if (!z.string().uuid().safeParse(userId).success) return { error: oops };
  const { data: m } = await supabase.from("memberships").select("id").eq("school_id", school.id).eq("user_id", userId).limit(1);
  if (!m?.length) return { error: oops };
  const { data: p } = await supabase.from("profiles").select("email").eq("id", userId).maybeSingle<{ email: string | null }>();
  if (!p?.email) return { error: "This person has no email address." };
  await sendSignInLink(p.email);
  return { ok: true, message: `Sign-in link sent to ${p.email}.`, at: Date.now() };
}
