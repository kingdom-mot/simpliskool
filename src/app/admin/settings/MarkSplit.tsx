"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { PART_PRESETS, type Part, type PartKey } from "@/lib/results";
import { saveAssessment } from "./actions";

const CA_KEYS: PartKey[] = ["ca1", "ca2", "ca3"];

/** Choose how the 100 marks are split: up to 3 continuous assessments plus the exam. */
export function MarkSplit({ initial }: { initial: Part[] }) {
  const [parts, setParts] = useState<Part[]>(initial);
  const cas = parts.filter((p) => p.key !== "exam");
  const exam = parts.find((p) => p.key === "exam");
  const sum = parts.reduce((a, p) => a + (Number.isFinite(p.max) ? p.max : 0), 0);

  function update(key: PartKey, patch: Partial<Part>) {
    setParts((old) => old.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  }
  function setCount(n: number) {
    const next: Part[] = CA_KEYS.slice(0, n).map((k, i) => cas.find((c) => c.key === k) ?? { key: k, label: `CA ${i + 1}`, max: 10 });
    setParts([...next, exam ?? { key: "exam", label: "Exam", max: 60 }]);
  }

  return (
    <ActionForm action={saveAssessment} className="flex flex-col gap-4">
      <input type="hidden" name="parts" value={JSON.stringify(parts)} />
      <fieldset className="flex flex-col gap-2">
        <legend className="label">Start from a common split</legend>
        <div className="flex flex-wrap gap-2">
          {PART_PRESETS.map((pr) => {
            const on = JSON.stringify(pr.parts) === JSON.stringify(parts);
            return (
              <button key={pr.name} type="button" aria-pressed={on} onClick={() => setParts(pr.parts)} className={`min-h-[44px] rounded-xl border-[1.5px] px-3 text-sm font-bold ${on ? "border-c1 bg-c1 text-white" : "border-[#DCE5F0] bg-white text-brand-slate"}`}>
                {pr.name}
              </button>
            );
          })}
        </div>
      </fieldset>
      <div className="max-w-xs">
        <label className="label" htmlFor="ca-count">
          Number of continuous assessments (CA)
        </label>
        <select id="ca-count" className="sk-input sk-select" value={cas.length} onChange={(e) => setCount(Number(e.target.value))}>
          {[0, 1, 2, 3].map((n) => (
            <option key={n} value={n}>
              {n === 0 ? "None (exam only)" : n}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {parts.map((p, i) => (
          <fieldset key={p.key} className="flex flex-col gap-2 rounded-xl border border-[#E3EAF3] bg-brand-cloud p-3">
            <legend className="sr-only">Part {i + 1}</legend>
            <div>
              <label className="label" htmlFor={`pl-${p.key}`}>
                Part {i + 1} name
              </label>
              <input id={`pl-${p.key}`} className="sk-input" maxLength={20} value={p.label} onChange={(e) => update(p.key, { label: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor={`pm-${p.key}`}>
                Out of
              </label>
              <input id={`pm-${p.key}`} className="sk-input" inputMode="numeric" value={Number.isFinite(p.max) ? String(p.max) : ""} onChange={(e) => update(p.key, { max: e.target.value === "" ? NaN : Number(e.target.value) })} />
            </div>
          </fieldset>
        ))}
      </div>
      <p aria-live="polite" className={`text-sm font-bold ${sum === 100 ? "text-[#0B6B5A]" : "text-[#912018]"}`}>
        Total: {sum} of 100{sum === 100 ? " ✓" : sum < 100 ? ` (add ${100 - sum} more)` : ` (${sum - 100} too many)`}
      </p>
      <div>
        <SubmitButton>Save mark split</SubmitButton>
      </div>
      <p className="text-[13px] text-[#4A5A70]">Change the split before teachers enter scores for the term. Scores already entered must still fit.</p>
    </ActionForm>
  );
}
