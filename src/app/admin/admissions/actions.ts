"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { SETUP_ROLES, classLabel } from "@/components/admin";
import type { ActionState } from "@/components/forms";
import { requireSchool } from "@/lib/auth";
import { emailReady } from "@/lib/email";
import { emailFromSchool } from "@/lib/school-email";
import { setFlash } from "@/lib/flash";
import { importStudents } from "@/app/admin/students/actions";

const uuid = z.string().uuid();
type App = { id: string; child_name: string; parent_name: string; parent_email: string | null; parent_phone: string; date_of_birth: string | null; gender: string | null; class_applied: string | null; status: string; ref_no: number | null };

async function load(fd: FormData) {
  const ctx = await requireSchool(SETUP_ROLES);
  const id = uuid.safeParse(fd.get("id"));
  if (!id.success) return null;
  const { data } = await ctx.supabase.from("admission_applications").select("id, child_name, parent_name, parent_email, parent_phone, date_of_birth, gender, class_applied, status, ref_no").eq("id", id.data).eq("school_id", ctx.school.id).maybeSingle<App>();
  return data ? { ctx, app: data } : null;
}

async function tell(schoolId: string, app: App, heading: string, paragraphs: string[], button?: { label: string; href: string }) {
  if (!app.parent_email || !emailReady()) return "";
  const r = await emailFromSchool(schoolId, { to: app.parent_email, heading, paragraphs: [`Dear ${app.parent_name.split(/\s+/)[0]},`, ...paragraphs], button });
  return r.ok ? " We emailed the parent." : " The email to the parent didn't send.";
}

async function done(id: string, tab: string, message: string): Promise<never> {
  await setFlash(message, "/admin/admissions");
  revalidatePath("/admin/admissions");
  revalidatePath("/admin");
  redirect(`/admin/admissions?${new URLSearchParams({ tab, app: id })}`);
}

export async function saveNotes(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const r = await load(fd);
  if (!r) return { error: "Something went wrong. Refresh the page." };
  const notes = String(fd.get("admin_notes") ?? "").trim().slice(0, 2000);
  const { error } = await r.ctx.supabase.from("admission_applications").update({ admin_notes: notes || null, updated_at: new Date().toISOString() }).eq("id", r.app.id);
  if (error) return { error: "We couldn't save the notes." };
  revalidatePath("/admin/admissions");
  return { ok: true, message: "Notes saved.", at: Date.now() };
}

export async function inviteToAssessment(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const r = await load(fd);
  if (!r) return { error: "Something went wrong. Refresh the page." };
  const d = String(fd.get("date") ?? "");
  const t = String(fd.get("time") ?? "") || "09:00";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return { error: "Choose the assessment date." };
  const at = new Date(`${d}T${t}:00+01:00`);
  const { error } = await r.ctx.supabase.from("admission_applications").update({ status: "assessment", assessment_at: at.toISOString(), updated_at: new Date().toISOString() }).eq("id", r.app.id);
  if (error) return { error: "We couldn't update the application." };
  const when = at.toLocaleString("en-GB", { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Africa/Lagos" });
  const mail = await tell(r.ctx.school.id, r.app, `${r.app.child_name} is invited to an assessment`, [
    `Thank you for applying to ${r.ctx.school.name}. We'd like to invite ${r.app.child_name} to an entrance assessment on ${when}.`,
    String(fd.get("bring") ?? "").trim() || "Please bring the child's last school report, birth certificate and two passport photographs.",
  ]);
  return done(r.app.id, "assessment", `${r.app.child_name} invited to an assessment on ${when}.${mail}`);
}

export async function sendOffer(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const r = await load(fd);
  if (!r) return { error: "Something went wrong. Refresh the page." };
  const { error } = await r.ctx.supabase.from("admission_applications").update({ status: "offer", updated_at: new Date().toISOString() }).eq("id", r.app.id);
  if (error) return { error: "We couldn't update the application." };
  const mail = await tell(r.ctx.school.id, r.app, `Offer of admission for ${r.app.child_name}`, [
    `We're pleased to offer ${r.app.child_name} a place${r.app.class_applied ? ` in ${r.app.class_applied}` : ""} at ${r.ctx.school.name}.`,
    "Please contact the school to accept the offer and complete registration.",
  ]);
  return done(r.app.id, "offer", `Offer sent for ${r.app.child_name}.${mail}`);
}

export async function declineApplication(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const r = await load(fd);
  if (!r) return { error: "Something went wrong. Refresh the page." };
  const { error } = await r.ctx.supabase.from("admission_applications").update({ status: "declined", updated_at: new Date().toISOString() }).eq("id", r.app.id);
  if (error) return { error: "We couldn't update the application." };
  const mail = fd.get("notify") === "1" ? await tell(r.ctx.school.id, r.app, `Your application for ${r.app.child_name}`, [`Thank you for applying to ${r.ctx.school.name}. We're sorry we can't offer ${r.app.child_name} a place at this time.`]) : "";
  return done(r.app.id, "declined", `Application declined.${mail}`);
}

/** Creates the student and the parent's account (linked), then marks the application enrolled. */
export async function enrolApplicant(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const r = await load(fd);
  if (!r) return { error: "Something went wrong. Refresh the page." };
  if (r.app.status === "enrolled") return { error: "Already enrolled." };
  const classId = uuid.safeParse(fd.get("class_id"));
  if (!classId.success) return { error: "Choose the class the child will join." };
  const { data: cls } = await r.ctx.supabase.from("classes").select("name, arm").eq("id", classId.data).eq("school_id", r.ctx.school.id).maybeSingle<{ name: string; arm: string }>();
  if (!cls) return { error: "Choose the class the child will join." };
  const parts = r.app.child_name.trim().split(/\s+/);
  const first = parts[0] ?? r.app.child_name;
  const last = parts.length > 1 ? parts[parts.length - 1] : "";
  const other = parts.slice(1, -1).join(" ");
  if (!last) return { error: "The child's full name (first name and surname) is needed. Edit the name on the student page after enrolling, or ask the parent." };
  const dob = r.app.date_of_birth ? r.app.date_of_birth.split("-").reverse().join("/") : "";
  const res = await importStudents([
    {
      row: 1,
      first_name: first,
      last_name: last,
      other_names: other,
      gender: r.app.gender ?? "",
      date_of_birth: dob,
      class: classLabel(cls.name, cls.arm),
      admission_no: "",
      parent_name: r.app.parent_name,
      parent_phone: r.app.parent_phone,
      parent_email: r.app.parent_email ?? "",
      relationship: "",
    },
  ]);
  if ("error" in res) return { error: res.error };
  if (!res.added) return { error: res.problems[0]?.problem ?? "We couldn't create the student." };
  const studentId = res.ids[0];
  await r.ctx.supabase.from("students").update({ admitted_on: new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date()) }).eq("id", studentId);
  await r.ctx.supabase.from("admission_applications").update({ status: "enrolled", student_id: studentId, updated_at: new Date().toISOString() }).eq("id", r.app.id);
  const mail = await tell(r.ctx.school.id, r.app, `Welcome to ${r.ctx.school.name}`, [
    `${first} is now enrolled in ${classLabel(cls.name, cls.arm)}.`,
    `You can follow ${first}'s attendance, results and fees in the Simpliskool parent app. Sign in with this email address or your phone number; we'll send you a code.`,
  ], { label: "Open the parent app", href: "/login" });
  return done(r.app.id, "enrolled", `${first} enrolled in ${classLabel(cls.name, cls.arm)}${res.parents ? " and the parent's account linked" : ""}.${mail}`);
}
