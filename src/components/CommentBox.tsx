"use client";

import { useState } from "react";

/**
 * Comment textarea with a suggestion button. With AI switched on it asks the AI for a
 * comment based on the student's results; otherwise it fills in a starting comment
 * built from the scores. The teacher always reads and edits before saving.
 */
export function CommentBox({
  id,
  name,
  label,
  initial,
  suggestion,
  hint,
  ai,
}: {
  id: string;
  name: string;
  label: string;
  initial: string;
  suggestion: string;
  hint?: string;
  ai?: { student: string; term: string; who: "teacher" | "principal" } | null;
}) {
  const [v, setV] = useState(initial);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function suggest() {
    if (!ai) {
      setV(suggestion);
      setNote("This suggestion comes from the student's scores. Read it and make it personal before saving.");
      return;
    }
    setBusy(true);
    setNote("Asking the AI…");
    try {
      const res = await fetch("/api/ai-comment", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(ai) });
      const data = (await res.json().catch(() => ({}))) as { comment?: string; error?: string };
      if (res.ok && data.comment) {
        setV(data.comment);
        setNote("AI suggestions are a starting point. Read and edit before saving.");
      } else {
        if (suggestion) setV(suggestion);
        setNote(`${data.error ?? "The AI didn't answer."}${suggestion ? " A starting comment from the scores was filled in instead." : ""}`);
      }
    } catch {
      if (suggestion) setV(suggestion);
      setNote("Couldn't reach the AI. A starting comment from the scores was filled in instead.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="label !mb-0" htmlFor={id}>
          {label}
        </label>
        {(suggestion || ai) && (
          <button type="button" className="s-btn2 !min-h-[40px] !px-3 text-sm" onClick={suggest} disabled={busy}>
            {busy ? "Thinking…" : ai ? "Suggest with AI" : "Suggest a starting comment"}
          </button>
        )}
      </div>
      <textarea id={id} name={name} rows={4} maxLength={600} className="sk-input min-h-[110px] py-3" value={v} onChange={(e) => setV(e.target.value)} aria-describedby={`${id}-h`} />
      <span id={`${id}-h`} role="status" className="text-[13px] text-[#4A5A70]">
        {note ?? hint ?? "Up to 600 characters."}
      </span>
    </div>
  );
}
