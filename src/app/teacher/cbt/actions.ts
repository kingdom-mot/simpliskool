"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/components/forms";
import { requireSchool } from "@/lib/auth";
import { loadTerms } from "@/lib/fees";
import { setFlash } from "@/lib/flash";
import { asParts } from "@/lib/results";
import { fromLagos, num } from "@/lib/teaching";

const uuid = z.string().uuid();

export async function createTest(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, school, user } = await requireSchool(["teacher"]);
  const [subject, level] = String(fd.get("bank") ?? "").split("|");
  if (!uuid.safeParse(subject).success || !level) return { error: "Choose the class level and subject." };
  const title = String(fd.get("title") ?? "").trim();
  if (title.length < 3 || title.length > 120) return { error: "Give the test a name (3 to 120 letters)." };
  const classIds = [...new Set(fd.getAll("class").map(String))].filter((c) => uuid.safeParse(c).success);
  if (!classIds.length) return { error: "Choose at least one class." };
  const { data: taught } = await supabase.from("class_subjects").select("class_id, classes!inner(name)").eq("subject_id", subject).eq("teacher_id", user.id).in("class_id", classIds).eq("classes.name", level).returns<{ class_id: string }[]>();
  if ((taught ?? []).length !== classIds.length) return { error: "You can only set tests for classes you teach this subject in." };
  const duration = Number(fd.get("duration"));
  if (!Number.isInteger(duration) || duration < 5 || duration > 240) return { error: "Choose how long students get." };
  const opens = fromLagos(fd.get("open_date"), fd.get("open_time"));
  const closes = fromLagos(fd.get("close_date"), fd.get("close_time"));
  if (!opens || !closes) return { error: "Choose when the test opens and closes." };
  if (closes <= opens) return { error: "The test must close after it opens." };
  if (new Date(closes).getTime() - new Date(opens).getTime() < duration * 60000) return { error: `Leave at least ${duration} minutes between opening and closing.` };
  if (new Date(closes).getTime() < Date.now()) return { error: "The closing time has already passed." };
  const topics = fd.getAll("topic").map(String);
  if (!topics.length) return { error: "Choose at least one topic." };
  const count = Number(fd.get("count"));
  if (!Number.isInteger(count) || count < 1 || count > 100) return { error: "Choose how many questions (1 to 100)." };
  const marksEach = Number(fd.get("marks_each") || 1);
  if (!(marksEach > 0 && marksEach <= 10)) return { error: "Marks for each question must be between 0.5 and 10." };
  const practice = fd.get("practice") === "1";
  let caPart: string | null = null;
  if (!practice && fd.get("ca_part")) {
    caPart = String(fd.get("ca_part"));
    const { data: parts } = await supabase.rpc("assessment_parts", { p_school: school.id });
    if (!asParts(parts).some((p) => p.key === caPart && p.key !== "exam")) return { error: "Choose which CA the scores go to." };
  }

  const { data: pool } = await supabase.from("questions").select("id").eq("school_id", school.id).eq("subject_id", subject).eq("level", level).eq("checked", true).in("topic", topics).returns<{ id: string }[]>();
  const ids = (pool ?? []).map((q) => q.id);
  if (ids.length < count) return { error: `Only ${ids.length} checked question${ids.length === 1 ? "" : "s"} in those topics. Choose fewer questions or more topics.` };
  // A random set from the chosen topics; every student gets the same questions (in their own order if shuffled).
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  const { term } = await loadTerms(supabase, school.id);
  if (!term) return { error: "The school hasn't set up this term yet." };
  const { data, error } = await supabase
    .from("cbt_tests")
    .insert({ school_id: school.id, subject_id: subject, term_id: term.id, level, title, teacher_id: user.id, class_ids: classIds, practice, duration_min: duration, opens_at: opens, closes_at: closes, question_ids: ids.slice(0, count), marks_each: marksEach, shuffle: fd.get("shuffle") === "1", show_score: practice || fd.get("show_score") === "1", ca_part: caPart })
    .select("id")
    .single<{ id: string }>();
  if (error || !data) return { error: error && /relation/i.test(error.message) ? "Run database file 0015_teaching.sql in Supabase first." : "We couldn't schedule the test. Please try again." };
  revalidatePath("/teacher/cbt");
  await setFlash(`"${title}" is scheduled: ${count} questions, ${duration} minutes. Students see it in their CBT list.`, `/teacher/cbt/${data.id}`);
  redirect(`/teacher/cbt/${data.id}`);
}

export async function deleteTest(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireSchool(["teacher"]);
  const id = uuid.safeParse(fd.get("id"));
  if (!id.success) return { error: "Something went wrong." };
  const { data, error } = await supabase.from("cbt_tests").delete().eq("id", id.data).select("title");
  if (error || !data?.length) return { error: "We couldn't delete the test." };
  revalidatePath("/teacher/cbt");
  await setFlash(`Deleted "${data[0].title}".`, "/teacher/cbt");
  redirect("/teacher/cbt");
}

/** Extra time, a later chance, or a fresh start for one student. */
export async function allowStudent(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, school } = await requireSchool(["teacher"]);
  const test = uuid.safeParse(fd.get("test"));
  const st = uuid.safeParse(fd.get("student"));
  if (!test.success || !st.success) return { error: "Something went wrong." };
  const what = String(fd.get("what"));
  if (what === "retake") {
    const { error } = await supabase.rpc("cbt_reset_attempt", { p_test: test.data, p_student: st.data });
    if (error) return { error: "We couldn't reset the attempt." };
  }
  if (what === "retake" || what === "reopen" || what === "extra") {
    const { data: cur } = await supabase.from("cbt_allowances").select("extra_min, until").eq("test_id", test.data).eq("student_id", st.data).maybeSingle<{ extra_min: number; until: string | null }>();
    const row = {
      test_id: test.data,
      student_id: st.data,
      school_id: school.id,
      extra_min: what === "extra" ? Math.min(240, (cur?.extra_min ?? 0) + 10) : (cur?.extra_min ?? 0),
      until: what === "extra" ? (cur?.until ?? null) : new Date(Date.now() + 2 * 86400000).toISOString(),
    };
    const { error } = await supabase.from("cbt_allowances").upsert(row, { onConflict: "test_id,student_id" });
    if (error) return { error: "We couldn't save that." };
  }
  revalidatePath(`/teacher/cbt/${test.data}`);
  const msg = what === "extra" ? "10 more minutes added for this student." : what === "retake" ? "Their attempt was cleared. They can take the test again in the next 2 days." : "Reopened for this student for 2 days.";
  await setFlash(msg, `/teacher/cbt/${test.data}`);
  redirect(`/teacher/cbt/${test.data}`);
}

export async function sendTestToCa(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, school } = await requireSchool(["teacher"]);
  const id = uuid.safeParse(fd.get("id"));
  if (!id.success) return { error: "Something went wrong." };
  const { data: t } = await supabase.from("cbt_tests").select("id, subject_id, term_id, class_ids, ca_part").eq("id", id.data).maybeSingle<{ id: string; subject_id: string; term_id: string; class_ids: string[]; ca_part: string | null }>();
  if (!t?.ca_part) return { error: "This test doesn't count toward CA." };
  const { data: res, error: rErr } = await supabase.rpc("cbt_results", { p_test: t.id });
  if (rErr) return { error: "We couldn't read the results." };
  const students = (res as { students: { id: string; class_id: string; score: number | null; total: number | null; submitted_at: string | null }[] }).students.filter((s) => s.submitted_at && s.total);
  if (!students.length) return { error: "No one has finished the test yet." };
  const { data: partsRaw } = await supabase.rpc("assessment_parts", { p_school: school.id });
  const part = asParts(partsRaw).find((p) => p.key === t.ca_part);
  if (!part) return { error: "Your school doesn't use that part any more." };
  const { data: cs } = await supabase.from("class_subjects").select("id, class_id").eq("subject_id", t.subject_id).in("class_id", t.class_ids).returns<{ id: string; class_id: string }[]>();
  let saved = 0;
  let locked = 0;
  for (const c of cs ?? []) {
    const rows = students.filter((s) => s.class_id === c.class_id).map((s) => ({ student_id: s.id, score: Math.round((Number(s.score) / Number(s.total)) * part.max * 10) / 10 }));
    if (!rows.length) continue;
    const { data, error } = await supabase.rpc("set_ca_part", { p_class_subject: c.id, p_term: t.term_id, p_part: t.ca_part, p_rows: rows });
    if (error) return { error: "We couldn't send the scores. Please try again." };
    saved += (data as { saved: number }).saved;
    locked += (data as { locked: number }).locked;
  }
  await supabase.from("cbt_tests").update({ ca_sent_at: new Date().toISOString() }).eq("id", t.id);
  revalidatePath(`/teacher/cbt/${t.id}`);
  return { ok: true, message: `${saved} score${saved === 1 ? "" : "s"} sent to ${part.label} (out of ${num(part.max)}).${locked ? ` ${locked} skipped: results already released.` : ""} Students who didn't take it were left out.`, at: Date.now() };
}
