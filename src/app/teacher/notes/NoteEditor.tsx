"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/forms";
import type { Note } from "@/lib/lesson-notes";
import { saveNote } from "./actions";

type Fields = { topic: string; lesson_date: string; duration_min: string; objectives: string; materials: string; content: string; evaluation: string };

export function NoteEditor({ note, csId, termId, week, subject, level, ai, locked }: { note: Note | null; csId: string; termId: string; week: number; subject: string; level: string; ai: boolean; locked: boolean }) {
  const [f, setF] = useState<Fields>({
    topic: note?.topic ?? "",
    lesson_date: note?.lesson_date ?? "",
    duration_min: String(note?.duration_min ?? 40),
    objectives: note?.objectives ?? "",
    materials: note?.materials ?? "",
    content: note?.content ?? "",
    evaluation: note?.evaluation ?? "",
  });
  const [aiMsg, setAiMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  async function draft() {
    if (f.topic.trim().length < 2) return setAiMsg("Enter the topic first.");
    setBusy(true);
    setAiMsg("Drafting…");
    try {
      const res = await fetch("/api/ai-note", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ topic: f.topic, subject, level, minutes: Number(f.duration_min) }) });
      const j = (await res.json().catch(() => ({}))) as Partial<Fields> & { error?: string };
      if (!res.ok) return setAiMsg(j.error ?? "The AI didn't answer.");
      setF({ ...f, objectives: j.objectives ?? f.objectives, materials: j.materials ?? f.materials, content: j.content ?? f.content, evaluation: j.evaluation ?? f.evaluation });
      setAiMsg("AI drafts are a starting point. Read and change them to fit your class before submitting.");
    } catch {
      setAiMsg("Couldn't reach the AI.");
    } finally {
      setBusy(false);
    }
  }

  const area = (k: keyof Fields, label: string, rows: number, max: number, hint?: string) => (
    <div>
      <label className="label" htmlFor={`n-${k}`}>
        {label}
      </label>
      {hint && (
        <span id={`n-${k}-h`} className="mb-1 block text-[13px] text-[#4A5A70]">
          {hint}
        </span>
      )}
      <textarea id={`n-${k}`} name={k} rows={rows} maxLength={max} className="sk-input py-3" value={f[k]} onChange={set(k)} disabled={locked} aria-describedby={hint ? `n-${k}-h` : undefined} />
    </div>
  );

  return (
    <ActionForm action={saveNote} className="flex flex-col gap-4">
      <input type="hidden" name="class_subject_id" value={csId} />
      <input type="hidden" name="term_id" value={termId} />
      <input type="hidden" name="week" value={week} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-[2fr_1fr_1fr]">
        <div>
          <label className="label" htmlFor="n-topic">
            Topic
          </label>
          <input id="n-topic" name="topic" className="sk-input" required maxLength={160} value={f.topic} onChange={set("topic")} disabled={locked} />
        </div>
        <div>
          <label className="label" htmlFor="n-date">
            Lesson date
          </label>
          <input id="n-date" name="lesson_date" type="date" className="sk-input" value={f.lesson_date} onChange={set("lesson_date")} disabled={locked} />
        </div>
        <div>
          <label className="label" htmlFor="n-dur">
            Duration
          </label>
          <select id="n-dur" name="duration_min" className="sk-input sk-select" value={f.duration_min} onChange={set("duration_min")} disabled={locked}>
            <option value="40">40 minutes</option>
            <option value="80">80 minutes</option>
            <option value="120">120 minutes</option>
          </select>
        </div>
      </div>
      {ai && !locked && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="s-btn2" onClick={draft} disabled={busy}>
            {busy ? "Drafting…" : "Draft with AI"}
          </button>
          <span role="status" className="text-[13px] text-[#4A5A70]">
            {aiMsg ?? "Fills in objectives, materials, steps and evaluation from the topic."}
          </span>
        </div>
      )}
      {area("objectives", "Learning objectives", 3, 2000, "What students can do by the end, e.g. \"Students can solve simple equations.\"")}
      {area("materials", "Instructional materials", 2, 1000)}
      {area("content", "Lesson content and steps", 8, 8000, "Starter, teaching, examples, practice and plenary.")}
      {area("evaluation", "Evaluation", 3, 2000, "Questions to check what students learnt.")}
      {locked ? (
        <p className="text-sm text-[#4A5A70]">This note is approved, so it can&apos;t be changed.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <SubmitButton className="s-btn2">
            <span>Save draft</span>
          </SubmitButton>
          <button name="go" value="submit" className="s-btn">
            {note?.status === "returned" ? "Send back to principal" : note?.status === "submitted" ? "Update and resend" : "Submit to principal"}
          </button>
        </div>
      )}
    </ActionForm>
  );
}
