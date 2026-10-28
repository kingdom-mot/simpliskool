"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSchool } from "@/lib/auth";
import type { ActionState } from "@/components/forms";
import { SETUP_ROLES } from "@/components/admin";
import { emailReady } from "@/lib/email";
import { notifyAbsences, remindTeachers } from "@/lib/notify";
import { smsAbsences } from "@/lib/sms-notices";
import { setFlash } from "@/lib/flash";

type Overview = { classes: { id: string; name: string; teacher: string | null; teacher_email: string | null; students: number; marked: number }[] };

function okDate(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(d);
}
function summary(t: { sent: number; failed: number; skipped: number }, what: string) {
  if (!t.sent && !t.failed && !t.skipped) return `No new ${what} to send.`;
  return [t.sent && `${t.sent} sent`, t.failed && `${t.failed} failed`, t.skipped && `${t.skipped} not sent (email isn't set up yet)`].filter(Boolean).join(", ") + ".";
}

export async function remindMissingRegisters(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, school } = await requireSchool(SETUP_ROLES);
  const date = String(fd.get("date") ?? "");
  if (!okDate(date)) return { error: "Something went wrong. Refresh and try again." };
  if (!emailReady()) return { error: "Email isn't set up yet, so reminders can't be sent. Ask Simpliskool support to switch it on." };
  const { data } = await supabase.rpc("attendance_overview", { p_school: school.id, p_date: date });
  const o = data as Overview | null;
  const missing = (o?.classes ?? []).filter((c) => c.students > 0 && c.marked === 0);
  const withEmail = missing.filter((c) => c.teacher_email).map((c) => ({ email: c.teacher_email!, name: c.teacher, className: c.name, classId: c.id }));
  if (!missing.length) return { ok: true, message: "Every class has taken its register.", at: Date.now() };
  const t = await remindTeachers(school.id, date, withEmail);
  revalidatePath("/admin/attendance");
  const noTeacher = missing.length - withEmail.length;
  return { ok: true, message: `Reminders: ${summary(t, "reminders")}${noTeacher ? ` ${noTeacher} class${noTeacher === 1 ? " has" : "es have"} no class teacher with an email.` : ""}`, at: Date.now() };
}

export async function sendAbsenceEmails(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { school } = await requireSchool(SETUP_ROLES);
  const date = String(fd.get("date") ?? "");
  if (!okDate(date)) return { error: "Something went wrong. Refresh and try again." };
  if (!emailReady()) return { error: "Email isn't set up yet. Ask Simpliskool support to switch it on." };
  const t = await notifyAbsences(school.id, date, null);
  revalidatePath("/admin/attendance");
  // The button goes once everyone is emailed, so the result is shown on the page.
  await setFlash(`Absence emails: ${summary(t, "absence emails")}`, "/admin/attendance");
  redirect(`/admin/attendance?date=${date}`);
}

export async function setAbsenceEmails(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, school, membership } = await requireSchool(SETUP_ROLES);
  if (membership.role === "principal") return { error: "Only the owner or an admin can change this." };
  const on = fd.get("on") === "1";
  const { error } = await supabase.from("schools").update({ notify_absence_email: on }).eq("id", school.id);
  if (error) return { error: "Couldn't save. Please try again." };
  revalidatePath("/admin/attendance");
  return { ok: true, message: on ? "Parents will get an email when their child is marked absent." : "Absence emails are off.", at: Date.now() };
}

export async function sendAbsenceTexts(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { school } = await requireSchool(SETUP_ROLES);
  const date = String(fd.get("date") ?? "");
  if (!okDate(date)) return { error: "Something went wrong. Refresh and try again." };
  const t = await smsAbsences(school.id, date, null);
  revalidatePath("/admin/attendance");
  if (!t.sent && !t.failed) return { ok: true, message: "No texts to send: parents were already texted, or have no phone number on file.", at: Date.now() };
  await setFlash(`Absence texts: ${t.sent} sent${t.failed ? `, ${t.failed} failed (check the phone numbers)` : ""}.`, "/admin/attendance", t.failed ? "warn" : "ok");
  redirect(`/admin/attendance?date=${date}`);
}
