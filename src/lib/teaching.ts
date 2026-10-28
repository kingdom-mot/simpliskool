import { levelOrder } from "@/lib/nigeria";

/** "JSS 2" + "A" -> "JSS 2A" (same as classLabel in components/admin, safe in the browser). */
export function classLabel(name: string, arm: string | null | undefined) {
  const a = (arm ?? "").trim();
  return `${name}${a.length <= 2 ? "" : " "}${a}`.trim();
}

type DB = Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>;

export type MyCS = { id: string; class_id: string; className: string; level: string; subject_id: string; subject: string; label: string; levelOrder: number };

/** The class-subjects this teacher teaches, sorted by class then subject. */
export async function myClassSubjects(supabase: DB, schoolId: string, userId: string): Promise<MyCS[]> {
  const { data } = await supabase
    .from("class_subjects")
    .select("id, class_id, subject_id, classes(name, arm, level_order), subjects(name)")
    .eq("school_id", schoolId)
    .eq("teacher_id", userId)
    .returns<{ id: string; class_id: string; subject_id: string; classes: { name: string; arm: string; level_order: number } | null; subjects: { name: string } | null }[]>();
  return (data ?? [])
    .map((r) => {
      const className = classLabel(r.classes?.name ?? "", r.classes?.arm ?? "");
      return { id: r.id, class_id: r.class_id, className, level: r.classes?.name ?? "", subject_id: r.subject_id, subject: r.subjects?.name ?? "", label: `${className} · ${r.subjects?.name ?? ""}`, levelOrder: r.classes?.level_order || levelOrder(r.classes?.name ?? "") };
    })
    .sort((a, b) => a.levelOrder - b.levelOrder || a.className.localeCompare(b.className) || a.subject.localeCompare(b.subject));
}

const TZ = "Africa/Lagos";
const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { timeZone: TZ, ...o });

/** "Fri, 6 Nov" */
export function dayLabel(iso: string) {
  return fmt({ weekday: "short", day: "numeric", month: "short" }).format(new Date(iso));
}
/** "4:00pm" */
export function timeLabel(iso: string) {
  return fmt({ hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(iso)).replace(" ", "").toLowerCase();
}
/** "Fri, 6 Nov, 4:00pm" */
export function dayTime(iso: string) {
  return `${dayLabel(iso)}, ${timeLabel(iso)}`;
}
/** yyyy-mm-dd and HH:MM in Lagos for form defaults. */
export function lagosParts(d: Date) {
  return {
    date: new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d),
    time: new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d),
  };
}
/** A Lagos date and time from a form to an ISO timestamp (null if malformed). */
export function fromLagos(date: unknown, time: unknown): string | null {
  const d = String(date ?? "");
  const t = String(time ?? "") || "16:00";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !/^\d{2}:\d{2}$/.test(t)) return null;
  const v = new Date(`${d}T${t}:00+01:00`);
  return Number.isNaN(v.getTime()) ? null : v.toISOString();
}

/** "Due today, 4pm", "Due tomorrow", "Due Mon 9 Nov", "Was due 2 Nov". */
export function dueText(iso: string, now = new Date()) {
  const day = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
  const due = new Date(iso);
  if (due < now) return `Was due ${fmt({ day: "numeric", month: "short" }).format(due)}`;
  if (day(due) === day(now)) return `Due today, ${timeLabel(iso)}`;
  if (day(due) === day(new Date(now.getTime() + 86400000))) return `Due tomorrow, ${timeLabel(iso)}`;
  return `Due ${fmt({ weekday: "short", day: "numeric", month: "short" }).format(due)}`;
}

export const SUBMIT_MODES = [
  { key: "photo", label: "Photo" },
  { key: "file", label: "File" },
  { key: "text", label: "Typed answer" },
  { key: "paper", label: "On paper in class" },
] as const;

export type HwFile = { path: string; name: string; type: string; size: number };

export const CA_LABEL: Record<string, string> = { ca1: "CA 1", ca2: "CA 2", ca3: "CA 3" };

/** Number like 7.5 or 8 (no trailing .0). */
export function num(n: number | string | null | undefined) {
  if (n === null || n === undefined || n === "") return "";
  const v = Number(n);
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}
