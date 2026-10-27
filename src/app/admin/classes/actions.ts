"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSchool } from "@/lib/auth";
import type { ActionState } from "@/components/forms";
import { SETUP_ROLES } from "@/components/admin";
import { levelOrder, SECTIONS, sectionOfClass, SUBJECTS, type Section } from "@/lib/nigeria";

const uuid = z.string().uuid();
const done = (message: string): ActionState => {
  revalidatePath("/admin/classes");
  revalidatePath("/admin");
  return { ok: true, message, at: Date.now() };
};
const oops = "Something went wrong. Please try again.";

function parseArms(raw: string): string[] {
  const arms = raw
    .split(/[,\s]+/)
    .map((a) => a.trim())
    .filter(Boolean)
    .map((a) => (a.length <= 2 ? a.toUpperCase() : a[0].toUpperCase() + a.slice(1)));
  return Array.from(new Set(arms)).slice(0, 8);
}

/** Creates the usual Nigerian classes (with arms) and subjects, and puts the subjects on each class. */
export async function applyTemplate(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, school } = await requireSchool(SETUP_ROLES);
  const sections = fd.getAll("section").map(String).filter((s): s is Section => SECTIONS.some((x) => x.key === s));
  if (!sections.length) return { error: "Tick at least one section." };
  const arms = parseArms(String(fd.get("arms") ?? "A"));
  if (!arms.length) arms.push("A");

  const classRows = sections.flatMap((s) =>
    SECTIONS.find((x) => x.key === s)!.classes.flatMap((name) => arms.map((arm) => ({ school_id: school.id, name, arm, level_order: levelOrder(name) }))),
  );
  const { error: cErr } = await supabase.from("classes").upsert(classRows, { onConflict: "school_id,name,arm", ignoreDuplicates: true });
  if (cErr) return { error: oops };

  const subjectNames = Array.from(new Set(sections.flatMap((s) => SUBJECTS[s])));
  const { error: sErr } = await supabase
    .from("subjects")
    .upsert(subjectNames.map((name) => ({ school_id: school.id, name })), { onConflict: "school_id,name", ignoreDuplicates: true });
  if (sErr) return { error: oops };

  const [{ data: classes }, { data: subjects }] = await Promise.all([
    supabase.from("classes").select("id, name").eq("school_id", school.id),
    supabase.from("subjects").select("id, name").eq("school_id", school.id),
  ]);
  const subjectId = new Map((subjects ?? []).map((s) => [s.name, s.id]));
  const links = (classes ?? []).flatMap((c) => {
    const sec = sectionOfClass(c.name);
    if (!sec || !sections.includes(sec)) return [];
    return SUBJECTS[sec].map((n) => ({ school_id: school.id, class_id: c.id, subject_id: subjectId.get(n)! })).filter((l) => l.subject_id);
  });
  if (links.length) {
    const { error } = await supabase.from("class_subjects").upsert(links, { onConflict: "class_id,subject_id", ignoreDuplicates: true });
    if (error) return { error: oops };
  }
  return done(`Added ${classRows.length} classes and ${subjectNames.length} subjects.`);
}

const classSchema = z.object({
  name: z.string().trim().min(2, "Enter the class name, like JSS 1").max(40),
  arms: z.string().trim().max(60),
});

export async function addClass(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, school } = await requireSchool(SETUP_ROLES);
  const parsed = classSchema.safeParse({ name: fd.get("name"), arms: fd.get("arms") ?? "" });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const arms = parseArms(parsed.data.arms);
  const rows = (arms.length ? arms : [""]).map((arm) => ({ school_id: school.id, name: parsed.data.name, arm, level_order: levelOrder(parsed.data.name) }));
  const { data, error } = await supabase.from("classes").upsert(rows, { onConflict: "school_id,name,arm", ignoreDuplicates: true }).select("id");
  if (error) return { error: oops };
  if (!data?.length) return { error: "That class already exists." };

  // Give new arms the same subjects as an existing arm of the same class.
  const { data: sibling } = await supabase
    .from("classes")
    .select("id, class_subjects(subject_id)")
    .eq("school_id", school.id)
    .eq("name", parsed.data.name)
    .not("id", "in", `(${data.map((d) => d.id).join(",")})`)
    .limit(1)
    .maybeSingle<{ id: string; class_subjects: { subject_id: string }[] }>();
  if (sibling?.class_subjects.length) {
    await supabase
      .from("class_subjects")
      .upsert(data.flatMap((c) => sibling.class_subjects.map((s) => ({ school_id: school.id, class_id: c.id, subject_id: s.subject_id }))), { onConflict: "class_id,subject_id", ignoreDuplicates: true });
  }
  return done(`Added ${data.length} class${data.length === 1 ? "" : "es"}.`);
}

export async function updateClass(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, school } = await requireSchool(SETUP_ROLES);
  const id = String(fd.get("class_id"));
  const teacher = String(fd.get("class_teacher_id") ?? "");
  const name = String(fd.get("name") ?? "").trim();
  const arm = String(fd.get("arm") ?? "").trim();
  if (!uuid.safeParse(id).success || (teacher && !uuid.safeParse(teacher).success)) return { error: oops };
  if (name.length < 2) return { error: "Enter the class name." };
  const { error } = await supabase
    .from("classes")
    .update({ name, arm: arm.length <= 2 ? arm.toUpperCase() : arm, level_order: levelOrder(name), class_teacher_id: teacher || null })
    .eq("id", id)
    .eq("school_id", school.id);
  if (error) return { error: error.code === "23505" ? "Another class already has that name and arm." : oops };
  return done("Class saved.");
}

export async function deleteClass(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, school } = await requireSchool(SETUP_ROLES);
  const id = String(fd.get("class_id"));
  if (!uuid.safeParse(id).success) return { error: oops };
  const { count } = await supabase.from("students").select("id", { count: "exact", head: true }).eq("class_id", id).eq("status", "active");
  if (count) return { error: `Move the ${count} student${count === 1 ? "" : "s"} in this class to another class first.` };
  const { error } = await supabase.from("classes").delete().eq("id", id).eq("school_id", school.id);
  if (error) return { error: oops };
  revalidatePath("/admin/classes");
  return { ok: true, message: "Class removed.", at: Date.now() };
}

/** Save subject teachers for a class. */
export async function saveClassSubjects(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, school } = await requireSchool(SETUP_ROLES);
  const ids = fd.getAll("cs_id").map(String).filter((i) => uuid.safeParse(i).success);
  for (const id of ids) {
    const t = String(fd.get(`t_${id}`) ?? "");
    const { error } = await supabase
      .from("class_subjects")
      .update({ teacher_id: t && uuid.safeParse(t).success ? t : null })
      .eq("id", id)
      .eq("school_id", school.id);
    if (error) return { error: oops };
  }
  return done("Subject teachers saved.");
}

/** Add a subject to a class: an existing school subject, or a new one by name. */
export async function addSubjectToClass(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, school } = await requireSchool(SETUP_ROLES);
  const classId = String(fd.get("class_id"));
  let subjectId = String(fd.get("subject_id") ?? "");
  const newName = String(fd.get("new_subject") ?? "").trim();
  if (!uuid.safeParse(classId).success) return { error: oops };
  if (!subjectId && newName.length < 2) return { error: "Choose a subject or type a new one." };
  if (!subjectId) {
    const { data, error } = await supabase
      .from("subjects")
      .upsert({ school_id: school.id, name: newName }, { onConflict: "school_id,name" })
      .select("id")
      .single();
    if (error || !data) return { error: oops };
    subjectId = data.id;
  }
  if (!uuid.safeParse(subjectId).success) return { error: oops };
  const { error } = await supabase.from("class_subjects").insert({ school_id: school.id, class_id: classId, subject_id: subjectId });
  if (error) return { error: error.code === "23505" ? "This class already has that subject." : oops };
  return done("Subject added.");
}

export async function removeClassSubject(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, school } = await requireSchool(SETUP_ROLES);
  const id = String(fd.get("cs_id"));
  if (!uuid.safeParse(id).success) return { error: oops };
  // Removing a subject from a class would also delete its scores, so stop if any exist.
  const { count } = await supabase.from("scores").select("id", { count: "exact", head: true }).eq("class_subject_id", id);
  if (count) return { error: "This subject already has scores for this class, so it can't be removed." };
  const { error } = await supabase.from("class_subjects").delete().eq("id", id).eq("school_id", school.id);
  if (error) return { error: oops };
  return done("Subject removed from the class.");
}

/** Copy this class's subjects to the other arms of the same class (e.g. JSS 1A -> JSS 1B, 1C). */
export async function copySubjectsToArms(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, school } = await requireSchool(SETUP_ROLES);
  const id = String(fd.get("class_id"));
  if (!uuid.safeParse(id).success) return { error: oops };
  const { data: cls } = await supabase.from("classes").select("name, class_subjects(subject_id)").eq("id", id).single<{ name: string; class_subjects: { subject_id: string }[] }>();
  if (!cls) return { error: oops };
  const { data: arms } = await supabase.from("classes").select("id").eq("school_id", school.id).eq("name", cls.name).neq("id", id);
  if (!arms?.length) return { error: "This class has no other arms." };
  const rows = arms.flatMap((a) => cls.class_subjects.map((s) => ({ school_id: school.id, class_id: a.id, subject_id: s.subject_id })));
  if (rows.length) {
    const { error } = await supabase.from("class_subjects").upsert(rows, { onConflict: "class_id,subject_id", ignoreDuplicates: true });
    if (error) return { error: oops };
  }
  return done(`Subjects copied to ${arms.length} other arm${arms.length === 1 ? "" : "s"}.`);
}

export async function addSubject(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, school } = await requireSchool(SETUP_ROLES);
  const name = String(fd.get("name") ?? "").trim();
  if (name.length < 2) return { error: "Enter the subject name." };
  const { error } = await supabase.from("subjects").insert({ school_id: school.id, name });
  if (error) return { error: error.code === "23505" ? "That subject already exists." : oops };
  return done(`${name} added.`);
}

export async function deleteSubject(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, school } = await requireSchool(SETUP_ROLES);
  const id = String(fd.get("subject_id"));
  if (!uuid.safeParse(id).success) return { error: oops };
  const { data: links } = await supabase.from("class_subjects").select("id").eq("subject_id", id);
  if (links?.length) {
    const { count } = await supabase.from("scores").select("id", { count: "exact", head: true }).in("class_subject_id", links.map((l) => l.id));
    if (count) return { error: "This subject already has scores, so it can't be deleted." };
  }
  const { error } = await supabase.from("subjects").delete().eq("id", id).eq("school_id", school.id);
  if (error) return { error: oops };
  return done("Subject deleted.");
}
