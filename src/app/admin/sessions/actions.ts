"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSchool } from "@/lib/auth";
import type { ActionState } from "@/components/forms";
import { SETUP_ROLES } from "@/components/admin";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date").or(z.literal(""));

const sessionSchema = z.object({
  name: z.string().trim().regex(/^\d{4}\/\d{4}$/, "Write the session like 2026/2027"),
  current: z.enum(["", "1", "2", "3"]),
  t1s: date, t1e: date, t2s: date, t2e: date, t3s: date, t3e: date,
});

function checkTermDates(terms: { term_no: number; starts_on: string; ends_on: string }[]): string | null {
  for (const t of terms) {
    if (t.starts_on && t.ends_on && t.starts_on >= t.ends_on) return `${["", "First", "Second", "Third"][t.term_no]} Term must end after it starts.`;
  }
  for (let i = 1; i < terms.length; i++) {
    const prev = terms[i - 1].ends_on;
    const next = terms[i].starts_on;
    if (prev && next && next <= prev) return `${["", "First", "Second", "Third"][terms[i].term_no]} Term must start after the previous term ends.`;
  }
  return null;
}

export async function createSession(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, school } = await requireSchool(SETUP_ROLES);
  const parsed = sessionSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const [a, b] = d.name.split("/").map(Number);
  if (b !== a + 1) return { error: "The second year should follow the first, like 2026/2027." };

  const terms = [1, 2, 3].map((n) => ({
    term_no: n,
    starts_on: d[`t${n}s` as "t1s"],
    ends_on: d[`t${n}e` as "t1e"],
  }));
  const problem = checkTermDates(terms);
  if (problem) return { error: problem };

  const { error } = await supabase.rpc("create_session", {
    p_school: school.id,
    p_name: d.name,
    p_terms: terms,
    p_current_term: d.current ? Number(d.current) : null,
  });
  if (error) {
    if (error.code === "23505") return { error: `${d.name} already exists.` };
    return { error: "We couldn't add the session. Please try again." };
  }
  revalidatePath("/admin/sessions");
  revalidatePath("/admin");
  return { ok: true, message: `${d.name} added.`, at: Date.now() };
}

const termsSchema = z.object({
  session_id: z.string().uuid(),
  ids: z.array(z.string().uuid()),
});

export async function saveTermDates(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, school } = await requireSchool(SETUP_ROLES);
  const parsed = termsSchema.safeParse({ session_id: fd.get("session_id"), ids: fd.getAll("term_id") });
  if (!parsed.success) return { error: "Something went wrong. Refresh the page and try again." };

  const terms = parsed.data.ids.map((id) => ({
    id,
    term_no: Number(fd.get(`no_${id}`)),
    starts_on: String(fd.get(`s_${id}`) ?? ""),
    ends_on: String(fd.get(`e_${id}`) ?? ""),
  }));
  terms.sort((x, y) => x.term_no - y.term_no);
  const problem = checkTermDates(terms);
  if (problem) return { error: problem };

  for (const t of terms) {
    const { error } = await supabase
      .from("terms")
      .update({ starts_on: t.starts_on || null, ends_on: t.ends_on || null })
      .eq("id", t.id)
      .eq("school_id", school.id);
    if (error) return { error: "We couldn't save the dates. Please try again." };
  }
  const starts = terms.map((t) => t.starts_on).filter(Boolean).sort();
  const ends = terms.map((t) => t.ends_on).filter(Boolean).sort();
  await supabase
    .from("academic_sessions")
    .update({ starts_on: starts[0] ?? null, ends_on: ends[ends.length - 1] ?? null })
    .eq("id", parsed.data.session_id)
    .eq("school_id", school.id);

  revalidatePath("/admin/sessions");
  return { ok: true, message: "Term dates saved.", at: Date.now() };
}

export async function makeCurrentTerm(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireSchool(SETUP_ROLES);
  const id = String(fd.get("term_id") ?? "");
  if (!z.string().uuid().safeParse(id).success) return { error: "Something went wrong. Refresh the page and try again." };
  const { error } = await supabase.rpc("set_current_term", { p_term: id });
  if (error) return { error: "We couldn't change the current term. Please try again." };
  revalidatePath("/admin/sessions");
  revalidatePath("/admin");
  return { ok: true, message: "Current term changed.", at: Date.now() };
}
