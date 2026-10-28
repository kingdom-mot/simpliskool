"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { markWork } from "../actions";

const QUICK = ["Well done!", "Show all your steps.", "Check your working again.", "Neat work.", "Good effort, keep practising."];

export function MarkForm({ hw, student, next, max, score, feedback, name }: { hw: string; student: string; next: string | null; max: number; score: string; feedback: string; name: string }) {
  const [fb, setFb] = useState(feedback);
  return (
    <ActionForm action={markWork} className="flex flex-col gap-3">
      <input type="hidden" name="hw" value={hw} />
      <input type="hidden" name="student" value={student} />
      <input type="hidden" name="next" value={next ?? ""} />
      <div className="max-w-[200px]">
        <label className="label" htmlFor="mk-score">
          Score (out of {max})
        </label>
        <input id="mk-score" name="score" type="number" inputMode="decimal" min={0} max={max} step="0.5" required defaultValue={score} className="sk-input" />
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="label">Quick feedback</legend>
        <div className="flex flex-wrap gap-2">
          {QUICK.map((q) => (
            <button key={q} type="button" className="min-h-[44px] rounded-full border-[1.5px] border-[#DCE5F0] bg-white px-3 text-sm font-bold text-brand-slate hover:border-c2" onClick={() => setFb((f) => (f ? `${f} ${q}` : q))}>
              + {q}
            </button>
          ))}
        </div>
      </fieldset>
      <div>
        <label className="label" htmlFor="mk-fb">
          Feedback to {name}
        </label>
        <textarea id="mk-fb" name="feedback" rows={3} maxLength={1000} value={fb} onChange={(e) => setFb(e.target.value)} className="sk-input min-h-[90px] py-3" />
      </div>
      <div>
        <SubmitButton pending="Saving…">{next ? "Return and next" : "Return"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
