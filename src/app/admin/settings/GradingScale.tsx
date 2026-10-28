"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { saveGradingScale } from "./actions";

type Row = { grade: string; min: string; remark: string };

/** Edit the grade boundaries: each grade runs from its minimum up to just below the next grade. */
export function GradingScale({ initial }: { initial: { grade: string; min: number; remark: string | null }[] }) {
  const [rows, setRows] = useState<Row[]>(initial.map((r) => ({ grade: r.grade, min: String(r.min), remark: r.remark ?? "" })));
  const set = (i: number, k: keyof Row, v: string) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const sorted = [...rows].map((r) => ({ ...r, n: Number(r.min) })).sort((a, b) => b.n - a.n);
  return (
    <ActionForm action={saveGradingScale} className="flex flex-col gap-3">
      <input type="hidden" name="rows" value={JSON.stringify(rows.map((r) => ({ grade: r.grade, min: Number(r.min), remark: r.remark })))} />
      <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Grading scale: scroll sideways to see more">
        <table className="tbl min-w-[560px]">
          <caption className="sr-only">Grading scale</caption>
          <thead>
            <tr>
              <th scope="col">Grade</th>
              <th scope="col">From (mark)</th>
              <th scope="col">To</th>
              <th scope="col">Remark</th>
              <th scope="col">
                <span className="sr-only">Remove</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const pos = sorted.findIndex((x) => x.grade === r.grade && x.min === r.min);
              const above = pos > 0 ? sorted[pos - 1].n : null;
              return (
                <tr key={i}>
                  <td>
                    <input aria-label={`Grade ${i + 1} letter`} className="sk-input w-20 py-2 text-center font-bold" maxLength={3} value={r.grade} onChange={(e) => set(i, "grade", e.target.value)} />
                  </td>
                  <td>
                    <input aria-label={`Grade ${r.grade || i + 1} starts at`} className="sk-input w-24 py-2 text-center" inputMode="decimal" value={r.min} onChange={(e) => set(i, "min", e.target.value)} />
                  </td>
                  <td className="whitespace-nowrap text-sm text-[#4A5A70]">{above === null ? "100" : Number.isFinite(above) ? `below ${above}` : "—"}</td>
                  <td>
                    <input aria-label={`Remark for grade ${r.grade || i + 1}`} className="sk-input py-2" maxLength={40} value={r.remark} onChange={(e) => set(i, "remark", e.target.value)} />
                  </td>
                  <td>
                    {rows.length > 2 && (
                      <button type="button" className="s-btn-danger !min-h-[40px]" onClick={() => setRows(rows.filter((_, j) => j !== i))}>
                        Remove<span className="sr-only"> grade {r.grade}</span>
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-2">
        {rows.length < 12 && (
          <button type="button" className="s-btn2" onClick={() => setRows([...rows, { grade: "", min: "", remark: "" }])}>
            + Add a grade
          </button>
        )}
        <SubmitButton>Save grading scale</SubmitButton>
      </div>
      <p className="text-[13px] text-[#4A5A70]">The lowest grade must start at 0. Changes apply to report cards straight away, including ones already released.</p>
    </ActionForm>
  );
}
