"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { SETUP_ROLES } from "@/components/admin";
import type { ActionState } from "@/components/forms";
import { featureOn } from "@/lib/platform-settings";
import { requireSchool } from "@/lib/auth";
import { emailReady } from "@/lib/email";
import { setFlash } from "@/lib/flash";
import { emailFromSchool } from "@/lib/school-email";

const uuid = z.string().uuid();

export async function reviewNote(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireSchool(SETUP_ROLES);
  const id = uuid.safeParse(fd.get("id"));
  if (!id.success) return { error: "Something went wrong." };
  const approve = fd.get("decision") === "approve";
  const score = Number(fd.get("score"));
  const comment = String(fd.get("comment") ?? "").trim().slice(0, 1000);
  if (!approve && comment.length < 3) return { error: "Tell the teacher what to change." };
  const { error } = await supabase.rpc("review_lesson_note", { p_id: id.data, p_approve: approve, p_score: score >= 1 && score <= 10 ? score : null, p_comment: comment });
  if (error) return { error: "We couldn't save the review. Please try again." };
  await setFlash(approve ? "Approved and archived. The teacher can now share it with the class." : "Returned to the teacher with your comment.", "/admin/lesson-notes");
  revalidatePath("/admin/lesson-notes");
  redirect(`/admin/lesson-notes?tab=${approve ? "approved" : "returned"}&note=${id.data}`);
}

export async function remindNoteTeachers(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, school } = await requireSchool(SETUP_ROLES);
  if (!emailReady()) return { error: "Email isn't set up yet, so reminders can't be sent." };
  const week = Number(fd.get("week"));
  const term = uuid.safeParse(fd.get("term"));
  if (!term.success || !(week >= 1 && week <= 16)) return { error: "Something went wrong." };
  // Worked out here, not taken from the page: subjects with a teacher and no note this week.
  const [{ data: cs }, { data: done }] = await Promise.all([
    supabase.from("class_subjects").select("id, teacher_id, subjects(name), classes(name, arm), profiles:teacher_id(full_name, email)").eq("school_id", school.id).not("teacher_id", "is", null).returns<{ id: string; teacher_id: string; subjects: { name: string } | null; classes: { name: string; arm: string } | null; profiles: { full_name: string | null; email: string | null } | null }[]>(),
    supabase.from("lesson_notes").select("class_subject_id").eq("school_id", school.id).eq("term_id", term.data).eq("week", week).neq("status", "draft").returns<{ class_subject_id: string }[]>(),
  ]);
  const have = new Set((done ?? []).map((d) => d.class_subject_id));
  const byTeacher = new Map<string, { email: string | null; name: string; subjects: string[] }>();
  for (const c of cs ?? []) {
    if (have.has(c.id)) continue;
    const e = byTeacher.get(c.teacher_id) ?? { email: c.profiles?.email ?? null, name: c.profiles?.full_name?.trim() || "there", subjects: [] };
    e.subjects.push(`${c.subjects?.name ?? ""} ${c.classes ? `${c.classes.name}${c.classes.arm}` : ""}`.trim());
    byTeacher.set(c.teacher_id, e);
  }
  let sent = 0;
  for (const t of byTeacher.values()) {
    if (!t.email) continue;
    const r = await emailFromSchool(school.id, {
      to: t.email,
      heading: `Week ${week} lesson notes`,
      paragraphs: [`Hello ${t.name.split(/\s+/)[0]},`, `Your week ${week} lesson notes haven't been submitted yet: ${t.subjects.join(", ")}.`],
      button: { label: "Write lesson notes", href: "/teacher/notes" },
    });
    if (r.ok) sent++;
  }
  return { ok: true, message: `Reminders sent to ${sent} teacher${sent === 1 ? "" : "s"}.`, at: Date.now() };
}

export async function createInspectorLink(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, school, user } = await requireSchool(SETUP_ROLES);
  if (!(await featureOn(school.id, "inspect"))) return { error: "Inspector links are switched off for your school." };
  const name = String(fd.get("name") ?? "").trim();
  if (name.length < 2) return { error: "Enter the inspector's name." };
  const org = String(fd.get("organisation") ?? "").trim().slice(0, 120);
  const days = [1, 7, 30].includes(Number(fd.get("days"))) ? Number(fd.get("days")) : 7;
  const scope = String(fd.get("scope") ?? "");
  const [kind, id] = scope.split(":");
  if (!uuid.safeParse(id).success || !["term", "session"].includes(kind)) return { error: "Choose what they can see." };
  const token = randomBytes(24).toString("base64url");
  const { error } = await supabase.from("inspector_links").insert({
    school_id: school.id,
    token,
    name: name.slice(0, 120),
    organisation: org || null,
    term_id: kind === "term" ? id : null,
    session_id: kind === "session" ? id : null,
    expires_at: new Date(Date.now() + days * 864e5).toISOString(),
    created_by: user.id,
  });
  if (error) return { error: "We couldn't create the link." };
  revalidatePath("/admin/lesson-notes/archive");
  return { ok: true, message: `Link ready for ${name}. Copy it from the list below.`, at: Date.now() };
}

export async function revokeInspectorLink(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, school } = await requireSchool(SETUP_ROLES);
  const id = uuid.safeParse(fd.get("id"));
  if (!id.success) return { error: "Something went wrong." };
  const { error } = await supabase.from("inspector_links").update({ revoked_at: new Date().toISOString() }).eq("id", id.data).eq("school_id", school.id);
  if (error) return { error: "We couldn't cancel the link." };
  await setFlash("Inspector link cancelled. It no longer works.", "/admin/lesson-notes/archive");
  revalidatePath("/admin/lesson-notes/archive");
  redirect("/admin/lesson-notes/archive");
}
