"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/components/forms";
import { SCHOOL_COOKIE, requireUser, requireSchool } from "@/lib/auth";
import { deliverAnnouncement } from "@/lib/announce";
import { setFlash } from "@/lib/flash";
import { GROUP_COOKIE, requireGroup } from "@/lib/group";
import { featureOn } from "@/lib/platform-settings";
import { findOrCreateUser, normalizeEmail, normalizePhone } from "@/lib/people";
import { asParts } from "@/lib/results";
import { createAdminClient } from "@/lib/supabase/admin";

const uuid = z.string().uuid();
const cookieOpts = { httpOnly: true, sameSite: "lax" as const, secure: true, path: "/", maxAge: 60 * 60 * 24 * 180 };

export async function chooseGroup(fd: FormData) {
  const { user } = await requireUser();
  const id = uuid.safeParse(fd.get("group_id"));
  if (!id.success) redirect("/dashboard");
  const { data } = await createAdminClient().from("group_members").select("group_id").eq("group_id", id.data).eq("user_id", user.id).maybeSingle();
  if (!data) redirect("/dashboard");
  (await cookies()).set(GROUP_COOKIE, id.data, cookieOpts);
  redirect("/group");
}

/** Proprietors go into a branch as its owner. */
export async function openBranch(fd: FormData) {
  const ctx = await requireGroup("overview");
  const id = uuid.safeParse(fd.get("school_id"));
  if (!id.success || !ctx.ids.includes(id.data)) redirect("/group");
  const { data } = await ctx.admin.from("memberships").select("role").eq("school_id", id.data).eq("user_id", ctx.user.id).in("role", ["owner", "admin", "principal", "bursar"]).limit(1).returns<{ role: string }[]>();
  if (!data?.length) {
    await setFlash("You don't have a login at that branch. Ask its principal to add you, or open it as the proprietor.", "/group", "warn");
    redirect("/group");
  }
  (await cookies()).set(SCHOOL_COOKIE, id.data, cookieOpts);
  redirect("/admin");
}

/** An owner turns their school into the first branch of a group (from Settings). */
export async function createGroup(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, school, membership } = await requireSchool(["owner"]);
  if (membership.role !== "owner") return { error: "Only the school owner can do this." };
  if (!(await featureOn(school.id, "grp"))) return { error: "School groups aren't switched on for your school. Contact Simpliskool." };
  const name = String(fd.get("group_name") ?? "").trim();
  if (name.length < 3) return { error: "Give the group a name, like Bright Stars Group." };
  const { data, error } = await supabase.rpc("create_group", { p_school: school.id, p_name: name });
  if (error) return { error: /Already/.test(error.message) ? "This school is already in a group." : /function/.test(error.message) ? "Run database file 0017_groups.sql in Supabase first." : "We couldn't create the group." };
  (await cookies()).set(GROUP_COOKIE, String(data), cookieOpts);
  await setFlash(`${name} is set up with ${school.name} as its first branch. Add your other branches here.`, "/group/branches");
  redirect("/group/branches");
}

const slugRe = /^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$/;

export async function addBranch(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireGroup("branches");
  if (ctx.role !== "proprietor") return { error: "Only the proprietor can add branches." };
  const name = String(fd.get("name") ?? "").trim();
  const slug = String(fd.get("slug") ?? "").trim().toLowerCase();
  if (name.length < 3 || name.length > 120) return { error: "Enter the branch name, like Lekki campus." };
  if (!slugRe.test(slug)) return { error: "The web address can use small letters, numbers and dashes (3 to 40)." };
  const copy = String(fd.get("copy_from") ?? "");
  const copyFrom = uuid.safeParse(copy).success && ctx.ids.includes(copy) ? copy : null;
  // Runs as the proprietor, so they become the new branch's owner.
  const { supabase } = await requireUser();
  const { data: school, error } = await supabase.rpc("add_branch", { p_group: ctx.group.id, p_name: name, p_slug: slug, p_copy_from: copyFrom });
  if (error || !school) return { error: /duplicate|unique/i.test(error?.message ?? "") ? `The web address ${slug} is taken. Choose another.` : "We couldn't add the branch." };
  const updates: Record<string, unknown> = {};
  const addr = String(fd.get("address") ?? "").trim();
  if (addr) updates.address = addr.slice(0, 300);
  const cap = Number(fd.get("capacity"));
  if (Number.isInteger(cap) && cap > 0) updates.capacity = Math.min(cap, 20000);
  if (Object.keys(updates).length) await ctx.admin.from("schools").update(updates).eq("id", school);
  // Invite the principal by email or phone.
  let invited = "";
  const contact = String(fd.get("principal") ?? "").trim();
  if (contact) {
    const email = normalizeEmail(contact);
    const phone = email ? null : normalizePhone(contact);
    const uid = email || phone ? await findOrCreateUser({ email, phone, fullName: String(fd.get("principal_name") ?? "").trim() || null }) : null;
    if (uid) {
      await ctx.admin.from("memberships").upsert({ school_id: school, user_id: uid, role: "principal" }, { onConflict: "school_id,user_id,role", ignoreDuplicates: true });
      invited = ` The principal (${contact}) can now sign in with a one-time code.`;
    } else invited = " The principal's email or phone didn't look right, so add them later under Staff.";
  }
  revalidatePath("/group", "layout");
  return { ok: true, message: `${name} added${copyFrom ? ", with classes, subjects, bell times and grading copied" : ""}.${invited}`, at: Date.now() };
}

export async function setCapacity(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireGroup("branches");
  if (ctx.role !== "proprietor") return { error: "Only the proprietor can change this." };
  const id = String(fd.get("school_id") ?? "");
  if (!ctx.ids.includes(id)) return { error: "Something went wrong." };
  const cap = Number(fd.get("capacity"));
  if (!Number.isInteger(cap) || cap < 1 || cap > 20000) return { error: "Enter the number of places, like 750." };
  await ctx.admin.from("schools").update({ capacity: cap }).eq("id", id);
  revalidatePath("/group", "layout");
  return { ok: true, message: "Places saved.", at: Date.now() };
}

export async function approveBranchPayroll(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireGroup("payroll");
  if (ctx.role !== "proprietor") return { error: "Only the proprietor can approve payroll. Group finance can view and prepare it." };
  const ids = fd.getAll("run").map(String).filter((x) => uuid.safeParse(x).success);
  if (!ids.length) return { error: "Nothing to approve." };
  const { data, error } = await ctx.admin.from("payroll_runs").update({ status: "approved", approved_by: ctx.user.id, approved_at: new Date().toISOString() }).in("id", ids).in("school_id", ctx.ids).eq("status", "draft").select("id");
  if (error) return { error: "We couldn't approve the payroll." };
  revalidatePath("/group/payroll");
  const month = /^\d{4}-\d{2}$/.test(String(fd.get("month"))) ? String(fd.get("month")) : "";
  await setFlash(`${data?.length ?? 0} payroll run${data?.length === 1 ? "" : "s"} approved. Each branch bursar pays staff from their bank schedule, then marks it paid.`, "/group/payroll");
  redirect(`/group/payroll${month ? `?month=${month}` : ""}`);
}

const annSchema = z.object({
  title: z.string().trim().min(3, "Give the announcement a title").max(120, "Keep the title under 120 characters"),
  body: z.string().trim().min(1, "Write the message").max(3000, "Keep the message under 3,000 characters"),
  audience: z.enum(["school", "parents", "staff"]),
});

/** One message to several branches; it goes out under each branch's name. */
export async function sendGroupAnnouncement(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireGroup("announcements");
  const p = annSchema.safeParse({ title: fd.get("title"), body: fd.get("body"), audience: fd.get("audience") });
  if (!p.success) return { error: p.error.issues[0].message };
  const targets = fd.getAll("branch").map(String).filter((b) => ctx.ids.includes(b));
  if (!targets.length) return { error: "Choose at least one branch." };
  const email = fd.get("email") === "1";
  const sms = fd.get("sms") === "1";
  let reach = 0;
  let emailed = 0;
  let texted = 0;
  for (const school of targets) {
    const { data: users } = await ctx.admin.rpc("announcement_users", { p_school: school, p_audience: p.data.audience, p_classes: null });
    const n = new Set(((users ?? []) as { user_id: string }[]).map((u) => u.user_id)).size;
    reach += n;
    const { data: row, error } = await ctx.admin
      .from("announcements")
      .insert({ school_id: school, title: p.data.title, body: p.data.body, audience: p.data.audience, kind: "notice", created_by: ctx.user.id, reach: n, send_email: email, send_sms: sms, dispatched_at: email || sms ? null : new Date().toISOString() })
      .select("id")
      .single<{ id: string }>();
    if (error || !row) return { error: "We couldn't send to every branch. Check the branches' announcement pages." };
    if (email || sms) {
      const d = await deliverAnnouncement(row.id);
      emailed += d?.emailed ?? 0;
      texted += d?.texted ?? 0;
    }
  }
  revalidatePath("/group/announcements");
  return { ok: true, message: `Sent to ${targets.length} branch${targets.length === 1 ? "" : "es"}: ${reach} ${reach === 1 ? "person" : "people"} in the app${email ? `, ${emailed} emailed` : ""}${sms ? `, ${texted} texted (from each branch's SMS)` : ""}.`, at: Date.now() };
}

const SETTINGS = ["grading", "split", "brand", "late"] as const;

/** Copies chosen settings from one branch to the others, so they match. */
export async function shareSettings(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireGroup("settings");
  if (ctx.role === "finance") return { error: "Not allowed." };
  const from = String(fd.get("from") ?? "");
  if (!ctx.ids.includes(from)) return { error: "Choose the branch to copy from." };
  const what = SETTINGS.filter((k) => fd.getAll("what").includes(k));
  if (ctx.role === "academic" && what.includes("brand")) return { error: "Only the proprietor can change logos and colours." };
  if (!what.length) return { error: "Tick what to copy." };
  const to = ctx.ids.filter((id) => id !== from);
  if (!to.length) return { error: "There are no other branches yet." };
  const { admin } = ctx;
  const { data: src } = await admin.from("schools").select("assessment, primary_color, secondary_color, logo_url, staff_late_after").eq("id", from).single<{ assessment: unknown; primary_color: string; secondary_color: string; logo_url: string | null; staff_late_after: string }>();
  if (!src) return { error: "Something went wrong." };
  const upd: Record<string, unknown> = {};
  if (what.includes("split")) upd.assessment = src.assessment ?? asParts(null);
  if (what.includes("brand")) Object.assign(upd, { primary_color: src.primary_color, secondary_color: src.secondary_color, logo_url: src.logo_url });
  if (what.includes("late")) upd.staff_late_after = src.staff_late_after;
  if (Object.keys(upd).length) {
    const { error } = await admin.from("schools").update(upd).in("id", to);
    if (error) return { error: /fit|scores/i.test(error.message) ? "A branch already has scores that don't fit that mark split. Change the split at the start of a term." : "We couldn't copy the settings." };
  }
  if (what.includes("grading")) {
    const { data: scale } = await admin.from("grading_scales").select("grade, min_score, max_score, remark").eq("school_id", from).returns<{ grade: string; min_score: number; max_score: number; remark: string | null }[]>();
    if (scale?.length) {
      await admin.from("grading_scales").delete().in("school_id", to);
      await admin.from("grading_scales").insert(to.flatMap((s) => scale.map((g) => ({ ...g, school_id: s }))));
    }
  }
  revalidatePath("/", "layout");
  const labels: Record<string, string> = { grading: "grading scale", split: "mark split", brand: "logo and colours", late: "staff resumption time" };
  return { ok: true, message: `Copied the ${what.map((w) => labels[w]).join(", ")} to ${to.length} other branch${to.length === 1 ? "" : "es"}.`, at: Date.now() };
}

export async function inviteGroupMember(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireGroup("team");
  if (ctx.role !== "proprietor") return { error: "Only the proprietor can invite people." };
  const contact = String(fd.get("contact") ?? "").trim();
  const email = normalizeEmail(contact);
  const phone = email ? null : normalizePhone(contact);
  if (!email && !phone) return { error: "Enter an email address or a Nigerian phone number." };
  const role = String(fd.get("role"));
  if (!["proprietor", "finance", "academic"].includes(role)) return { error: "Choose a role." };
  const picked = fd.getAll("branch").map(String).filter((b) => ctx.ids.includes(b));
  const all = fd.get("all") === "1" || picked.length === ctx.ids.length;
  if (!all && !picked.length) return { error: "Choose which branches they can see." };
  const name = String(fd.get("name") ?? "").trim();
  if (name.length < 2) return { error: "Enter their name." };
  const uid = await findOrCreateUser({ email, phone, fullName: name });
  if (!uid) return { error: "We couldn't add them. Check the email or phone." };
  const { error } = await ctx.admin.from("group_members").upsert({ group_id: ctx.group.id, user_id: uid, role, branch_ids: all || role === "proprietor" ? null : picked, invited_by: ctx.user.id }, { onConflict: "group_id,user_id" });
  if (error) return { error: "We couldn't add them." };
  revalidatePath("/group/team");
  return { ok: true, message: `${name} added to the group team. They sign in at ${process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "simpliskool.com"} with a one-time code sent to ${email ?? phone}.`, at: Date.now() };
}

export async function removeGroupMember(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireGroup("team");
  if (ctx.role !== "proprietor") return { error: "Only the proprietor can do this." };
  const id = uuid.safeParse(fd.get("user_id"));
  if (!id.success) return { error: "Something went wrong." };
  if (id.data === ctx.user.id) return { error: "You can't remove yourself." };
  await ctx.admin.from("group_members").delete().eq("group_id", ctx.group.id).eq("user_id", id.data);
  revalidatePath("/group/team");
  await setFlash("Removed from the group team.", "/group/team");
  redirect("/group/team");
}
