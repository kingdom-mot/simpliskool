"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSchool } from "@/lib/auth";
import type { ActionState } from "@/components/forms";
import { emailReady } from "@/lib/email";
import { RATINGS, RESULTS_ADMIN, type ClassResults } from "@/lib/results";
import { sendReportCardEmails, sendScoreReminders } from "@/lib/result-emails";
import { classLabel } from "@/components/admin";

const uuid = z.string().uuid();
const scoreVal = z.union([z.number().min(0), z.null()]);
const rowsSchema = z.array(z.object({ student_id: z.string().uuid(), ca1: scoreVal, ca2: scoreVal, exam: scoreVal })).max(300);

export type SaveScoresResult = { ok: boolean; error?: string; saved?: number; locked?: number; at?: number };

/** Called by the score sheet (autosave, Save and Submit). The database checks who may save. */
export async function saveScores(csId: string, termId: string, rows: unknown, submit: boolean): Promise<SaveScoresResult> {
  const { supabase } = await requireSchool(["owner", "admin", "principal", "teacher"]);
  if (!uuid.safeParse(csId).success || !uuid.safeParse(termId).success) return { ok: false, error: "Something went wrong. Refresh the page." };
  const p = rowsSchema.safeParse(rows);
  if (!p.success) return { ok: false, error: "Some scores aren't numbers. Check the boxes marked in red." };
  for (const r of p.data) {
    if ((r.ca1 ?? 0) > 20 || (r.ca2 ?? 0) > 20 || (r.exam ?? 0) > 60) return { ok: false, error: "Some scores are more than the maximum. Fix the boxes marked in red." };
  }
  const { data, error } = await supabase.rpc("save_scores", { p_class_subject: csId, p_term: termId, p_rows: p.data, p_submit: submit });
  if (error) return { ok: false, error: /not allowed/.test(error.message) ? "You can't enter scores for this subject." : "We couldn't save. Check your connection and try again." };
  revalidatePath("/teacher/scores");
  revalidatePath("/admin/results");
  const r = data as { saved: number; locked: number };
  return { ok: true, saved: r.saved, locked: r.locked, at: Date.now() };
}

const commentSchema = z.object({ student: z.string().uuid(), term: z.string().uuid(), comment: z.string().trim().max(600, "Keep the comment under 600 characters") });

export async function saveClassComment(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireSchool(["owner", "admin", "principal", "teacher"]);
  const p = commentSchema.safeParse({ student: fd.get("student"), term: fd.get("term"), comment: fd.get("comment") ?? "" });
  if (!p.success) return { error: p.error.issues[0].message };
  const ratings: Record<string, number> = {};
  for (const r of RATINGS) {
    const v = Number(fd.get(`r_${r}`));
    if ([1, 2, 3, 4, 5].includes(v)) ratings[r] = v;
  }
  const { error } = await supabase.rpc("save_class_comment", { p_student: p.data.student, p_term: p.data.term, p_comment: p.data.comment, p_ratings: Object.keys(ratings).length ? ratings : null });
  if (error) return { error: /released/i.test(error.message) ? "This report card has been released, so only the school admin can change it." : /not allowed/.test(error.message) ? "Only the class teacher can write this comment." : "We couldn't save. Please try again." };
  revalidatePath("/teacher/broadsheet");
  revalidatePath("/admin/report-cards");
  const next = String(fd.get("next") ?? "");
  if (next && uuid.safeParse(next).success && fd.get("go") === "next") {
    const cls = String(fd.get("class") ?? "");
    redirect(`/teacher/broadsheet?${new URLSearchParams({ class: cls, term: p.data.term, student: next, saved: "1" })}`);
  }
  return { ok: true, message: "Comment saved.", at: Date.now() };
}

export async function savePrincipalComment(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireSchool(RESULTS_ADMIN);
  const p = commentSchema.safeParse({ student: fd.get("student"), term: fd.get("term"), comment: fd.get("comment") ?? "" });
  if (!p.success) return { error: p.error.issues[0].message };
  const { error } = await supabase.rpc("save_principal_comment", { p_student: p.data.student, p_term: p.data.term, p_comment: p.data.comment });
  if (error) return { error: "We couldn't save. Please try again." };
  revalidatePath("/admin/report-cards");
  return { ok: true, message: "Principal's comment saved.", at: Date.now() };
}

export async function releaseResults(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, school } = await requireSchool(RESULTS_ADMIN);
  const cls = uuid.safeParse(fd.get("class"));
  const term = uuid.safeParse(fd.get("term"));
  if (!cls.success || !term.success) return { error: "Something went wrong. Refresh the page and try again." };
  const release = fd.get("release") !== "0";
  const { data, error } = await supabase.rpc("release_results", { p_class: cls.data, p_term: term.data, p_release: release });
  if (error) return { error: "We couldn't do that. Please try again." };
  revalidatePath("/admin/report-cards");
  revalidatePath("/admin/results");
  const n = Number(data) || 0;
  if (release && !n) return { error: "No student in this class has scores yet, so there's nothing to release." };
  const q = new URLSearchParams({ class: cls.data, term: term.data, done: release ? "released" : "withdrawn", n: String(n) });
  if (release && fd.get("email") === "1") {
    const t = await sendReportCardEmails(school.id, cls.data, term.data);
    q.set("sent", String(t.sent));
    q.set("failed", String(t.failed));
    q.set("skipped", String(t.skipped));
    q.set("noemail", String(t.noEmail));
  }
  // The release buttons change once released or taken back, so the result is shown on the page.
  redirect(`/admin/report-cards?${q}`);
}

export async function remindScoreTeachers(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, school } = await requireSchool(RESULTS_ADMIN);
  const cls = uuid.safeParse(fd.get("class"));
  const term = uuid.safeParse(fd.get("term"));
  if (!cls.success || !term.success) return { error: "Something went wrong. Refresh the page and try again." };
  if (!emailReady()) return { error: "Email isn't set up yet, so reminders can't be sent." };
  const [{ data }, { data: c }] = await Promise.all([
    supabase.rpc("class_results", { p_class: cls.data, p_term: term.data }),
    supabase.from("classes").select("name, arm").eq("id", cls.data).single<{ name: string; arm: string }>(),
  ]);
  const r = data as ClassResults | null;
  if (!r || !c) return { error: "Something went wrong. Refresh the page and try again." };
  const open = r.subjects.filter((s) => !s.submitted_at && s.complete < r.class_size);
  const withEmail = open.filter((s) => s.teacher_email);
  if (!open.length) return { ok: true, message: "Every subject's scores are in.", at: Date.now() };
  const t = await sendScoreReminders(
    school.id,
    withEmail.map((s) => ({ email: s.teacher_email!, name: s.teacher, subject: s.name, className: classLabel(c.name, c.arm), classSubjectId: s.id })),
  );
  const none = open.length - withEmail.length;
  const parts = [t.sent && `${t.sent} sent`, t.failed && `${t.failed} failed`].filter(Boolean).join(", ");
  return { ok: true, message: `${parts ? `Reminders: ${parts}.` : "These teachers already got a reminder today."}${none ? ` ${none} subject${none === 1 ? " has" : "s have"} no teacher with an email; set one under Classes and subjects.` : ""}`, at: Date.now() };
}
