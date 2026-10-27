"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSchool } from "@/lib/auth";
import type { ActionState } from "@/components/forms";
import { classLabel, SETUP_ROLES } from "@/components/admin";
import { findOrCreateUser, normalizeEmail, normalizePhone } from "@/lib/people";
import { initials } from "@/lib/theme";
import { classKey, toGender, toIsoDate, type ImportProblem, type ImportRow } from "@/lib/students-import";
import { createAdminClient, studentLoginEmail } from "@/lib/supabase/admin";

const uuid = z.string().uuid();
const oops = "Something went wrong. Please try again.";
const MAX_BATCH = 50;

type Ctx = Awaited<ReturnType<typeof requireSchool>>;
type Clean = {
  row: number;
  name: string;
  student: { first_name: string; last_name: string; other_names: string | null; gender: "male" | "female" | null; date_of_birth: string | null; class_id: string; admission_no: string | null };
  parent: { name: string | null; phone: string | null; email: string | null; relationship: string | null } | null;
};

async function classMap(ctx: Ctx) {
  const { data } = await ctx.supabase.from("classes").select("id, name, arm").eq("school_id", ctx.school.id);
  const map = new Map<string, string>();
  for (const c of data ?? []) {
    map.set(classKey(classLabel(c.name, c.arm)), c.id);
    map.set(classKey(`${c.name} ${c.arm}`), c.id);
  }
  // "JSS 1" on its own means JSS 1 when there is only one arm.
  const byName = new Map<string, string[]>();
  for (const c of data ?? []) byName.set(classKey(c.name), [...(byName.get(classKey(c.name)) ?? []), c.id]);
  byName.forEach((ids, k) => {
    if (ids.length === 1 && !map.has(k)) map.set(k, ids[0]);
  });
  return map;
}

/** Validates rows. Admission numbers are checked against the file and the school. */
async function validate(ctx: Ctx, rows: ImportRow[]): Promise<{ good: Clean[]; problems: ImportProblem[] }> {
  const classes = await classMap(ctx);
  const given = rows.map((r) => (r.admission_no ?? "").trim()).filter(Boolean);
  const taken = new Set<string>();
  for (let i = 0; i < given.length; i += 200) {
    const { data } = await ctx.supabase.from("students").select("admission_no").eq("school_id", ctx.school.id).in("admission_no", given.slice(i, i + 200));
    for (const d of data ?? []) taken.add(d.admission_no.toUpperCase());
  }
  const seen = new Set<string>();
  const good: Clean[] = [];
  const problems: ImportProblem[] = [];

  for (const r of rows) {
    const first = (r.first_name ?? "").trim();
    const last = (r.last_name ?? "").trim();
    const name = `${first} ${last}`.trim() || "(no name)";
    const fail = (problem: string) => problems.push({ row: r.row, name, problem });

    if (!first || !last) { fail("First name and surname are both needed."); continue; }
    if (!(r.class ?? "").trim()) { fail("Class is missing."); continue; }
    const classId = classes.get(classKey(r.class!));
    if (!classId) { fail(`There is no class called "${r.class}". Check the spelling or add it under Classes.`); continue; }
    const gender = toGender(r.gender);
    if (gender === null) { fail(`Gender "${r.gender}" should be Male or Female.`); continue; }
    const dob = toIsoDate(r.date_of_birth ?? "");
    if (dob === null) { fail(`Date of birth "${r.date_of_birth}" isn't a date. Use day/month/year, like 14/03/2014.`); continue; }
    const adm = (r.admission_no ?? "").trim();
    if (adm) {
      const k = adm.toUpperCase();
      if (taken.has(k)) { fail(`Admission number ${adm} is already used by another student.`); continue; }
      if (seen.has(k)) { fail(`Admission number ${adm} appears twice in the file.`); continue; }
      seen.add(k);
    }
    const phoneRaw = (r.parent_phone ?? "").trim();
    const emailRaw = (r.parent_email ?? "").trim();
    const phone = normalizePhone(phoneRaw);
    const email = normalizeEmail(emailRaw);
    if (phoneRaw && !phone) { fail(`Parent phone "${phoneRaw}" doesn't look right. Use 11 digits, like 08031234567.`); continue; }
    if (emailRaw && !email) { fail(`Parent email "${emailRaw}" doesn't look right.`); continue; }

    good.push({
      row: r.row,
      name,
      student: { first_name: first, last_name: last, other_names: (r.other_names ?? "").trim() || null, gender: gender || null, date_of_birth: dob || null, class_id: classId, admission_no: adm || null },
      parent: phone || email ? { name: (r.parent_name ?? "").trim() || null, phone, email, relationship: (r.relationship ?? "").trim() || null } : null,
    });
  }
  return { good, problems };
}

export async function checkStudents(rows: ImportRow[]): Promise<{ ready: number; parents: number; problems: ImportProblem[] } | { error: string }> {
  const ctx = await requireSchool(SETUP_ROLES);
  if (!Array.isArray(rows) || rows.length > 5000) return { error: "Upload up to 5,000 students at a time." };
  const { good, problems } = await validate(ctx, rows);
  return { ready: good.length, parents: good.filter((g) => g.parent).length, problems };
}

/** Adds students (and links parents). The upload page sends rows in small batches. */
export async function importStudents(rows: ImportRow[]): Promise<{ added: number; parents: number; problems: ImportProblem[]; ids: string[] } | { error: string }> {
  const ctx = await requireSchool(SETUP_ROLES);
  if (!Array.isArray(rows) || rows.length > MAX_BATCH) return { error: oops };
  const { good, problems } = await validate(ctx, rows);
  if (!good.length) return { added: 0, parents: 0, problems, ids: [] };

  // Admission numbers for rows without one: BS/2026/001, BS/2026/002 …
  const prefix = `${initials(ctx.school.name)}/${new Date().getFullYear()}/`;
  let next = 0;
  if (good.some((g) => !g.student.admission_no)) {
    const { data } = await ctx.supabase.rpc("next_admission_no", { p_school: ctx.school.id, p_prefix: prefix });
    next = Number(String(data ?? `${prefix}001`).slice(prefix.length)) || 1;
  }
  for (const g of good) {
    if (!g.student.admission_no) g.student.admission_no = `${prefix}${String(next++).padStart(3, "0")}`;
  }

  const { data: inserted, error } = await ctx.supabase
    .from("students")
    .insert(good.map((g) => ({ school_id: ctx.school.id, ...g.student })))
    .select("id, admission_no");
  if (error || !inserted) {
    return { error: error?.code === "23505" ? "Some admission numbers were taken while you were uploading. Check the file again." : oops };
  }
  const idByAdm = new Map(inserted.map((s) => [s.admission_no, s.id]));

  let parents = 0;
  const withParent = good.filter((g) => g.parent);
  for (let i = 0; i < withParent.length; i += 5) {
    await Promise.all(
      withParent.slice(i, i + 5).map(async (g) => {
        const studentId = idByAdm.get(g.student.admission_no!);
        if (!studentId || !g.parent) return;
        const ok = await linkParent(ctx, studentId, g.parent);
        if (ok) parents++;
        else problems.push({ row: g.row, name: g.name, problem: "Student added, but the parent couldn't be linked. Add them from the student's page." });
      }),
    );
  }

  revalidatePath("/admin/students");
  revalidatePath("/admin");
  return { added: inserted.length, parents, problems, ids: inserted.map((s) => s.id) };
}

async function linkParent(ctx: Ctx, studentId: string, p: { name: string | null; phone: string | null; email: string | null; relationship: string | null }) {
  const userId = await findOrCreateUser({ email: p.email, phone: p.phone, fullName: p.name });
  if (!userId) return false;
  const { error: mErr } = await ctx.supabase
    .from("memberships")
    .upsert({ school_id: ctx.school.id, user_id: userId, role: "parent" }, { onConflict: "school_id,user_id,role", ignoreDuplicates: true });
  if (mErr) return false;
  const { error: gErr } = await ctx.supabase
    .from("guardians")
    .upsert({ school_id: ctx.school.id, student_id: studentId, user_id: userId, relationship: p.relationship }, { onConflict: "student_id,user_id", ignoreDuplicates: true });
  return !gErr;
}

/** The "Add a student" form. */
export async function addStudent(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const row: ImportRow = {
    row: 1,
    first_name: String(fd.get("first_name") ?? ""),
    last_name: String(fd.get("last_name") ?? ""),
    other_names: String(fd.get("other_names") ?? ""),
    gender: String(fd.get("gender") ?? ""),
    date_of_birth: String(fd.get("date_of_birth") ?? ""),
    class: String(fd.get("class") ?? ""),
    admission_no: String(fd.get("admission_no") ?? ""),
    parent_name: String(fd.get("parent_name") ?? ""),
    parent_phone: String(fd.get("parent_phone") ?? ""),
    parent_email: String(fd.get("parent_email") ?? ""),
    relationship: String(fd.get("relationship") ?? ""),
  };
  const res = await importStudents([row]);
  if ("error" in res) return { error: res.error };
  if (!res.added) return { error: res.problems[0]?.problem ?? oops };
  redirect(`/admin/students/${res.ids[0]}?added=1`);
}

const editSchema = z.object({
  id: z.string().uuid(),
  first_name: z.string().trim().min(1, "Enter the first name"),
  last_name: z.string().trim().min(1, "Enter the surname"),
  other_names: z.string().trim(),
  gender: z.enum(["", "male", "female"]),
  date_of_birth: z.string(),
  class_id: z.string().uuid().or(z.literal("")),
  admission_no: z.string().trim().min(1, "Enter the admission number"),
  status: z.enum(["active", "graduated", "withdrawn"]),
});

export async function updateStudent(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, school } = await requireSchool(SETUP_ROLES);
  const parsed = editSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const dob = toIsoDate(d.date_of_birth);
  if (dob === null) return { error: "Date of birth isn't a valid date." };
  const { error } = await supabase
    .from("students")
    .update({ first_name: d.first_name, last_name: d.last_name, other_names: d.other_names || null, gender: d.gender || null, date_of_birth: dob || null, class_id: d.class_id || null, admission_no: d.admission_no, status: d.status })
    .eq("id", d.id)
    .eq("school_id", school.id);
  if (error) return { error: error.code === "23505" ? "Another student already has that admission number." : oops };
  revalidatePath(`/admin/students/${d.id}`);
  revalidatePath("/admin/students");
  return { ok: true, message: "Details saved.", at: Date.now() };
}

export async function addGuardian(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireSchool(SETUP_ROLES);
  const id = String(fd.get("student_id"));
  if (!uuid.safeParse(id).success) return { error: oops };
  const phoneRaw = String(fd.get("phone") ?? "").trim();
  const emailRaw = String(fd.get("email") ?? "").trim();
  const phone = normalizePhone(phoneRaw);
  const email = normalizeEmail(emailRaw);
  if (!phone && !email) return { error: "Enter the parent's phone number or email." };
  if (phoneRaw && !phone) return { error: "That phone number doesn't look right. Use 11 digits, like 08031234567." };
  if (emailRaw && !email) return { error: "That email doesn't look right." };
  const ok = await linkParent(ctx, id, { name: String(fd.get("name") ?? "").trim() || null, phone, email, relationship: String(fd.get("relationship") ?? "").trim() || null });
  if (!ok) return { error: "We couldn't link this parent. Please try again." };
  revalidatePath(`/admin/students/${id}`);
  return { ok: true, message: "Parent linked. They can sign in with their phone or email.", at: Date.now() };
}

export async function removeGuardian(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, school } = await requireSchool(SETUP_ROLES);
  const id = String(fd.get("guardian_id"));
  const studentId = String(fd.get("student_id"));
  if (!uuid.safeParse(id).success) return { error: oops };
  const { error } = await supabase.from("guardians").delete().eq("id", id).eq("school_id", school.id);
  if (error) return { error: oops };
  revalidatePath(`/admin/students/${studentId}`);
  return { ok: true, message: "Parent unlinked.", at: Date.now() };
}

/**
 * Older students sign in with their own phone or email (a one-time code each time).
 * Switching back to PIN is done by issuing a new PIN.
 */
export async function setOwnSignIn(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireSchool(SETUP_ROLES);
  const id = String(fd.get("student_id"));
  const contact = String(fd.get("contact") ?? "").trim();
  if (!uuid.safeParse(id).success) return { error: oops };
  const email = contact.includes("@") ? normalizeEmail(contact) : null;
  const phone = contact.includes("@") ? null : normalizePhone(contact);
  if (!email && !phone) return { error: "Enter the student's own phone number or email." };

  const { data: st } = await ctx.supabase.from("students").select("id, user_id, first_name, last_name").eq("id", id).eq("school_id", ctx.school.id).single();
  if (!st) return { error: oops };

  const userId = await findOrCreateUser({ email, phone, fullName: `${st.first_name} ${st.last_name}` });
  if (!userId) return { error: "We couldn't set up that sign-in. Please try again." };

  const admin = createAdminClient();
  // Another student may not share a sign-in.
  const { data: clash } = await admin.from("students").select("id").eq("user_id", userId).neq("id", id).limit(1);
  if (clash?.length) return { error: "That phone or email is already used by another student." };
  const { data: asParent } = await admin.from("guardians").select("id").eq("user_id", userId).limit(1);
  if (asParent?.length) return { error: "That phone or email belongs to a parent. Use the student's own phone or email." };

  const old = st.user_id as string | null;
  const { error } = await admin.from("students").update({ user_id: userId, signin_method: "own" }).eq("id", id).eq("school_id", ctx.school.id);
  if (error) return { error: oops };
  await admin.from("memberships").upsert({ school_id: ctx.school.id, user_id: userId, role: "student" }, { onConflict: "school_id,user_id,role", ignoreDuplicates: true });
  await admin.from("student_pins").delete().eq("student_id", id);

  // Remove the old PIN-only account, which nobody else can use.
  if (old && old !== userId) {
    const { data: u } = await admin.auth.admin.getUserById(old);
    if (u?.user?.email === studentLoginEmail(id)) await admin.auth.admin.deleteUser(old);
  }
  revalidatePath(`/admin/students/${id}`);
  return { ok: true, message: "Saved. The student now signs in with a one-time code sent to their phone or email.", at: Date.now() };
}
