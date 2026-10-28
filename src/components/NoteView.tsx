import type { Note } from "@/lib/lesson-notes";

/** A lesson note laid out for reading (review, archive, inspector, students). */
export function NoteView({ note }: { note: Pick<Note, "topic" | "lesson_date" | "duration_min" | "objectives" | "materials" | "content" | "evaluation"> }) {
  const date = note.lesson_date ? new Date(`${note.lesson_date}T12:00:00+01:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Africa/Lagos" }) : null;
  return (
    <dl className="flex flex-col gap-3 text-sm text-brand-slate">
      {[
        ["Topic", note.topic + (date ? ` · lesson on ${date}` : "") + ` · ${note.duration_min} minutes`],
        ["Objectives", note.objectives],
        ["Materials", note.materials],
        ["Steps", note.content],
        ["Evaluation", note.evaluation],
      ].map(([k, v]) => (
        <div key={k}>
          <dt className="text-xs font-bold uppercase tracking-[0.05em] text-[#4A5A70]">{k}</dt>
          <dd className="whitespace-pre-line">{v || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
