"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSchool } from "@/lib/auth";
import type { ActionState } from "@/components/forms";
import { RESULTS_ADMIN } from "@/lib/results";

const uuid = z.string().uuid();
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a time like 08:00");

function refresh() {
  revalidatePath("/admin/timetable");
  revalidatePath("/teacher");
  revalidatePath("/student");
}

export async function applyStandardDay(): Promise<ActionState> {
  const { supabase, school } = await requireSchool(RESULTS_ADMIN);
  const { error } = await supabase.rpc("use_standard_periods", { p_school: school.id });
  if (error) return { error: /already/.test(error.message) ? "Period times are already set." : "We couldn't set the periods. Please try again." };
  refresh();
  redirect("/admin/timetable");
}

const periodSchema = z.object({ label: z.string().trim().min(1, "Give the period a name").max(30, "Keep the name short"), kind: z.enum(["lesson", "break"]), starts_at: time, ends_at: time });

export async function savePeriod(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, school } = await requireSchool(RESULTS_ADMIN);
  const p = periodSchema.safeParse({ label: fd.get("label"), kind: fd.get("kind"), starts_at: fd.get("starts_at"), ends_at: fd.get("ends_at") });
  if (!p.success) return { error: p.error.issues[0].message };
  if (p.data.starts_at >= p.data.ends_at) return { error: "The end time must be after the start time." };
  const id = String(fd.get("id") ?? "");
  // Periods mustn't overlap.
  const { data: all } = await supabase.from("school_periods").select("id, label, starts_at, ends_at").eq("school_id", school.id).returns<{ id: string; label: string; starts_at: string; ends_at: string }[]>();
  const clash = (all ?? []).find((x) => x.id !== id && x.starts_at.slice(0, 5) < p.data.ends_at && x.ends_at.slice(0, 5) > p.data.starts_at);
  if (clash) return { error: `That overlaps ${clash.label} (${clash.starts_at.slice(0, 5)}–${clash.ends_at.slice(0, 5)}).` };
  const { error } = id && uuid.safeParse(id).success
    ? await supabase.from("school_periods").update(p.data).eq("id", id).eq("school_id", school.id)
    : await supabase.from("school_periods").insert({ ...p.data, school_id: school.id });
  if (error) return { error: "We couldn't save. Please try again." };
  refresh();
  return { ok: true, message: `${p.data.label} saved. Every class timetable uses the new time.`, at: Date.now() };
}

export async function deletePeriod(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, school } = await requireSchool(RESULTS_ADMIN);
  const id = uuid.safeParse(fd.get("id"));
  if (!id.success) return { error: "Something went wrong." };
  const { data, error } = await supabase.from("school_periods").delete().eq("id", id.data).eq("school_id", school.id).select("label");
  if (error || !data?.length) return { error: "We couldn't remove it. Please try again." };
  refresh();
  return { ok: true, message: `${data[0].label} removed, with its lessons.`, at: Date.now() };
}

export async function saveSlot(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireSchool(RESULTS_ADMIN);
  const cls = uuid.safeParse(fd.get("class"));
  const period = uuid.safeParse(fd.get("period"));
  const day = Number(fd.get("day"));
  if (!cls.success || !period.success || ![1, 2, 3, 4, 5, 6].includes(day)) return { error: "Something went wrong. Refresh the page and try again." };
  const cs = String(fd.get("class_subject") ?? "");
  const clear = fd.get("clear") === "1" || !cs;
  if (!clear && !uuid.safeParse(cs).success) return { error: "Choose a subject." };
  const room = String(fd.get("room") ?? "").trim().slice(0, 40);
  const { error } = await supabase.rpc("save_timetable_slot", { p_class: cls.data, p_day: day, p_period: period.data, p_class_subject: clear ? null : cs, p_room: room });
  if (error) {
    const m = error.message.match(/^Clash: (.*)$/);
    if (m) return { error: `${m[1]}. Pick another teacher or time.` };
    return { error: /Breaks/.test(error.message) ? "Breaks can't have lessons." : "We couldn't save. Please try again." };
  }
  refresh();
  return { ok: true, message: clear ? "Period cleared." : "Period saved. Teachers' and students' timetables update straight away.", at: Date.now() };
}
