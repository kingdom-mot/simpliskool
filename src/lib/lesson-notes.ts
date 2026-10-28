export type Note = {
  id: string;
  class_subject_id: string;
  term_id: string;
  week: number;
  teacher_id: string | null;
  topic: string;
  lesson_date: string | null;
  duration_min: number;
  objectives: string | null;
  materials: string | null;
  content: string | null;
  evaluation: string | null;
  status: "draft" | "submitted" | "returned" | "approved" | "shared";
  score: number | null;
  review_comment: string | null;
  reviewed_at: string | null;
  submitted_at: string | null;
  shared_at: string | null;
  updated_at: string;
};
export const NOTE_FIELDS = "id, class_subject_id, term_id, week, teacher_id, topic, lesson_date, duration_min, objectives, materials, content, evaluation, status, score, review_comment, reviewed_at, submitted_at, shared_at, updated_at";

export const NOTE_STATUS: Record<Note["status"] | "none", [string, "good" | "warn" | "bad" | "info"]> = {
  none: ["Not started", "warn"],
  draft: ["Draft", "warn"],
  submitted: ["With principal", "info"],
  returned: ["Returned", "bad"],
  approved: ["Approved", "good"],
  shared: ["Shared", "good"],
};

/** Week of term for a date (week 1 starts on the term's start date). */
export function weekOfTerm(startsOn: string | null, isoDate: string) {
  if (!startsOn) return 1;
  const days = Math.floor((Date.parse(`${isoDate}T12:00:00Z`) - Date.parse(`${startsOn}T12:00:00Z`)) / 864e5);
  return Math.min(16, Math.max(1, Math.floor(days / 7) + 1));
}
export function termWeeks(startsOn: string | null, endsOn: string | null) {
  if (!startsOn || !endsOn) return 13;
  return Math.min(16, Math.max(1, Math.ceil((Date.parse(endsOn) - Date.parse(startsOn)) / (7 * 864e5))));
}
