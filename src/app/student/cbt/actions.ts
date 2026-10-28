"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/components/forms";
import { requireSchool } from "@/lib/auth";

const uuid = z.string().uuid();
const answersSchema = z.record(z.string().uuid(), z.number().int().min(0).max(9));

export async function startTest(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireSchool(["student"]);
  const id = uuid.safeParse(fd.get("test"));
  if (!id.success) return { error: "Something went wrong." };
  const { error } = await supabase.rpc("cbt_start", { p_test: id.data });
  if (error) {
    if (/Already handed in/.test(error.message)) redirect(`/student/cbt/${id.data}`);
    if (/Not open yet/.test(error.message)) return { error: "This test isn't open yet." };
    if (/closed|Time is up/.test(error.message)) return { error: "This test has closed. Ask your teacher if you missed it." };
    return { error: "We couldn't start the test. Check your connection and try again." };
  }
  redirect(`/student/cbt/${id.data}`);
}

export type SaveResult = { saved: boolean; reason?: string; deadline_at?: string; now?: string } | { error: string };

export async function saveAnswers(attempt: string, answers: Record<string, number>, flags: string[]): Promise<SaveResult> {
  const { supabase } = await requireSchool(["student"]);
  if (!uuid.safeParse(attempt).success) return { error: "bad" };
  const a = answersSchema.safeParse(answers);
  if (!a.success) return { error: "bad" };
  const { data, error } = await supabase.rpc("cbt_save", { p_attempt: attempt, p_answers: a.data, p_flags: flags.filter((f) => uuid.safeParse(f).success).slice(0, 100) });
  if (error) return { error: "not saved" };
  return data as SaveResult;
}

export type HandInResult = { submitted_at: string; practice: boolean; score: number | null; total: number | null; answered: number; questions: number } | { error: string };

export async function handInTest(attempt: string, answers: Record<string, number>): Promise<HandInResult> {
  const { supabase } = await requireSchool(["student"]);
  if (!uuid.safeParse(attempt).success) return { error: "Something went wrong." };
  const a = answersSchema.safeParse(answers);
  const { data, error } = await supabase.rpc("cbt_submit", { p_attempt: attempt, p_answers: a.success ? a.data : null });
  if (error) return { error: "We couldn't hand in. Check your connection and press Hand in again. Your answers are saved." };
  return data as HandInResult;
}
