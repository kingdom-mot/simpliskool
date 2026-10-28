"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Pill } from "@/components/ui";
import { saveScores } from "@/lib/results-actions";
import { PARTS, fmtScore, gradeKind, gradeOf, type PartKey, type ScaleRow } from "@/lib/results";

export type SheetStudent = { id: string; name: string; ca1: number | null; ca2: number | null; exam: number | null; locked: boolean };
type Vals = Record<string, Record<PartKey, string>>;

const NUM = /^\d{1,2}(\.\d{1,2})?$/;

function problem(v: string, max: number): string | null {
  if (v === "") return null;
  if (!NUM.test(v)) return "Numbers only";
  if (Number(v) > max) return `Max is ${max}`;
  return null;
}

export function ScoreSheet({
  csId,
  termId,
  title,
  students,
  scale,
  submittedAt,
  submitLabel = "Submit to class teacher",
}: {
  csId: string;
  termId: string;
  title: string;
  students: SheetStudent[];
  scale: ScaleRow[];
  submittedAt: string | null;
  submitLabel?: string;
}) {
  const initial = useMemo<Vals>(() => Object.fromEntries(students.map((s) => [s.id, { ca1: fmtScore(s.ca1), ca2: fmtScore(s.ca2), exam: fmtScore(s.exam) }])), [students]);
  const [vals, setVals] = useState<Vals>(initial);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<{ kind: "idle" | "saving" | "saved" | "error"; text: string }>({ kind: "idle", text: submittedAt ? "Submitted. You can still make changes." : "Changes save automatically." });
  const [submitted, setSubmitted] = useState(!!submittedAt);
  const [pending, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const editable = students.filter((s) => !s.locked);

  const errors = useMemo(() => {
    const out: { id: string; name: string; part: (typeof PARTS)[number]; msg: string }[] = [];
    for (const s of editable) for (const p of PARTS) {
      const m = problem(vals[s.id][p.key], p.max);
      if (m) out.push({ id: s.id, name: s.name, part: p, msg: m });
    }
    return out;
  }, [vals, editable]);

  const save = useCallback(
    (submit: boolean) => {
      if (errors.length) {
        setStatus({ kind: "error", text: `Not saved: ${errors.length} score${errors.length === 1 ? " needs" : "s need"} fixing.` });
        return;
      }
      const rows = editable.map((s) => ({
        student_id: s.id,
        ca1: vals[s.id].ca1 === "" ? null : Number(vals[s.id].ca1),
        ca2: vals[s.id].ca2 === "" ? null : Number(vals[s.id].ca2),
        exam: vals[s.id].exam === "" ? null : Number(vals[s.id].exam),
      }));
      setStatus({ kind: "saving", text: "Saving…" });
      start(async () => {
        const r = await saveScores(csId, termId, rows, submit).catch(() => ({ ok: false, error: "We couldn't save. Check your connection and try again." }) as const);
        if (!r.ok) return setStatus({ kind: "error", text: r.error ?? "We couldn't save." });
        setDirty(false);
        if (submit) setSubmitted(true);
        const time = new Date().toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Africa/Lagos" }).replace(" ", "").toLowerCase();
        setStatus({ kind: "saved", text: submit ? `Submitted at ${time}. The class teacher and admin can see the scores.` : `All changes saved at ${time}.` });
      });
    },
    [errors.length, editable, vals, csId, termId],
  );

  // Autosave two seconds after the last change.
  useEffect(() => {
    if (!dirty || errors.length) return;
    timer.current = setTimeout(() => save(false), 2000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [dirty, errors.length, vals, save]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function set(id: string, key: PartKey, v: string) {
    setVals((old) => ({ ...old, [id]: { ...old[id], [key]: v.trim() } }));
    setDirty(true);
    setStatus({ kind: "idle", text: "Unsaved changes…" });
  }

  /** Pasting a block from Excel fills the boxes from the one you pasted into. */
  function onPaste(e: React.ClipboardEvent<HTMLInputElement>, row: number, col: number) {
    const text = e.clipboardData.getData("text");
    if (!/[\t\n]/.test(text.trim())) return;
    e.preventDefault();
    const lines = text.replace(/\r/g, "").split("\n").filter((l, i, a) => l !== "" || i < a.length - 1);
    setVals((old) => {
      const next = { ...old };
      lines.forEach((line, i) => {
        const s = editable[row + i];
        if (!s) return;
        const cells = line.split("\t");
        next[s.id] = { ...next[s.id] };
        cells.forEach((c, j) => {
          const p = PARTS[col + j];
          if (p) next[s.id][p.key] = c.trim();
        });
      });
      return next;
    });
    setDirty(true);
    setStatus({ kind: "idle", text: `Pasted ${lines.length} row${lines.length === 1 ? "" : "s"}. Saving soon…` });
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>, row: number, col: number) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const nextRow = e.shiftKey ? row - 1 : row + 1;
    tableRef.current?.querySelector<HTMLInputElement>(`input[data-cell="${nextRow}-${col}"]`)?.focus();
  }

  const complete = editable.filter((s) => PARTS.every((p) => vals[s.id][p.key] !== "")).length;

  return (
    <div className="flex flex-col gap-3">
      {errors.length > 0 && (
        <div role="alert" className="rounded-xl bg-[#FEF3F2] px-4 py-3 text-sm font-semibold text-[#912018]">
          {errors.length === 1 ? "1 score needs fixing: " : `${errors.length} scores need fixing: `}
          {errors
            .slice(0, 3)
            .map((e) => `${e.name}'s ${e.part.label} (${e.msg.toLowerCase()})`)
            .join("; ")}
          {errors.length > 3 ? "…" : "."}
        </div>
      )}
      <p className="text-[13px] text-[#4A5A70]">
        Type each score, or copy columns from Excel and paste into the first box. Press Enter to go down. Totals and grades work themselves out.
      </p>
      <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={`${title}: scroll sideways to see more`}>
        <table ref={tableRef} className="tbl min-w-[640px]">
          <caption className="sr-only">{title}</caption>
          <thead>
            <tr>
              <th scope="col">Student</th>
              {PARTS.map((p) => (
                <th key={p.key} scope="col">
                  {p.label} ({p.max})
                </th>
              ))}
              <th scope="col">Total</th>
              <th scope="col">Grade</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => {
              const v = vals[s.id];
              const row = editable.indexOf(s);
              const bad = PARTS.map((p) => problem(v[p.key], p.max));
              const filled = PARTS.filter((p) => v[p.key] !== "");
              const total = !bad.some(Boolean) && filled.length ? PARTS.reduce((a, p) => a + (v[p.key] === "" ? 0 : Number(v[p.key])), 0) : null;
              const done = filled.length === PARTS.length && total !== null;
              const g = done ? gradeOf(total, scale) : null;
              return (
                <tr key={s.id}>
                  <th scope="row">
                    {s.name}
                    {s.locked && <span className="block text-xs font-normal text-[#4A5A70]">Report card released</span>}
                  </th>
                  {PARTS.map((p, j) => (
                    <td key={p.key}>
                      <input
                        className="sk-input w-[84px] py-2 text-center"
                        inputMode="decimal"
                        autoComplete="off"
                        data-cell={`${row}-${j}`}
                        aria-label={`${p.label} for ${s.name}`}
                        aria-invalid={bad[j] ? true : undefined}
                        aria-describedby={bad[j] ? `e-${s.id}-${p.key}` : undefined}
                        value={v[p.key]}
                        disabled={s.locked}
                        onChange={(e) => set(s.id, p.key, e.target.value)}
                        onPaste={(e) => onPaste(e, row, j)}
                        onKeyDown={(e) => onKey(e, row, j)}
                      />
                      {bad[j] && (
                        <span id={`e-${s.id}-${p.key}`} className="mt-1 block text-xs font-bold text-[#912018]">
                          {bad[j]}
                        </span>
                      )}
                    </td>
                  ))}
                  <td className="font-extrabold text-brand-slate">{total === null ? "—" : fmtScore(total)}</td>
                  <td>{g ? <Pill kind={gradeKind(g.grade, scale)}>{g.grade}</Pill> : <span className="text-xs text-[#4A5A70]">{filled.length ? "Not finished" : "—"}</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span role="status" aria-live="polite" className={`text-sm font-semibold ${status.kind === "error" ? "text-[#912018]" : status.kind === "saved" ? "text-[#0B6B5A]" : "text-[#4A5A70]"}`}>
          {status.text}
        </span>
        <span className="text-sm text-[#4A5A70]">
          {complete} of {editable.length} complete
        </span>
        <div className="ml-auto flex flex-wrap gap-2">
          <button type="button" className="s-btn2" disabled={pending} onClick={() => save(false)}>
            Save
          </button>
          <button
            type="button"
            className="s-btn"
            disabled={pending}
            onClick={() => {
              if (complete < editable.length && !window.confirm(`${editable.length - complete} student${editable.length - complete === 1 ? " is" : "s are"} missing a score. Submit anyway?`)) return;
              save(true);
            }}
          >
            {submitted ? "Submit again" : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
