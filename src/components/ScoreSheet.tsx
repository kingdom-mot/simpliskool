"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { Pill } from "@/components/ui";
import { saveScores } from "@/lib/results-actions";
import { fmtScore, gradeKind, gradeOf, type Part, type PartKey, type ScaleRow } from "@/lib/results";

export type SheetStudent = { id: string; name: string; ca1: number | null; ca2: number | null; ca3: number | null; exam: number | null; locked: boolean };
type Vals = Record<string, Partial<Record<PartKey, string>>>;
type Draft = { vals: Vals; at: string };

const NUM = /^\d{1,3}(\.\d{1,2})?$/;
const DRAFT = (cs: string, term: string) => `sk-scores-draft:${cs}:${term}`;

function readDraft(key: string): Draft | null {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as Draft) : null;
  } catch {
    return null;
  }
}
function writeDraft(key: string, d: Draft | null) {
  try {
    if (d) localStorage.setItem(key, JSON.stringify(d));
    else localStorage.removeItem(key);
  } catch {
    /* storage blocked or full */
  }
}

function problem(v: string | undefined, max: number): string | null {
  if (!v) return null;
  if (!NUM.test(v)) return "Numbers only";
  if (Number(v) > max) return `Max is ${max}`;
  return null;
}

const noop = () => () => {};
const clock = () => new Date().toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Africa/Lagos" }).replace(" ", "").toLowerCase();

type Props = {
  csId: string;
  termId: string;
  title: string;
  students: SheetStudent[];
  parts: Part[];
  scale: ScaleRow[];
  submittedAt: string | null;
  submitLabel?: string;
};

/** Reads scores saved on this device while offline, so it renders once running in the browser. */
export function ScoreSheet(props: Props) {
  const hydrated = useSyncExternalStore(noop, () => true, () => false);
  if (!hydrated) {
    return (
      <p className="rounded-xl bg-brand-cloud px-4 py-3 text-sm text-[#4A5A70]" role="status">
        Loading the score sheet…
      </p>
    );
  }
  return <Sheet {...props} />;
}

function Sheet({ csId, termId, title, students, parts, scale, submittedAt, submitLabel = "Submit to class teacher" }: Props) {
  const key = DRAFT(csId, termId);
  const editable = useMemo(() => students.filter((s) => !s.locked), [students]);
  // Unsent scores saved on this device win over the server copy.
  const [start] = useState(() => {
    const server: Vals = Object.fromEntries(students.map((s) => [s.id, Object.fromEntries(parts.map((p) => [p.key, fmtScore(s[p.key])]))]));
    const d = readDraft(key);
    if (!d) return { vals: server, restored: false };
    const merged = { ...server };
    for (const s of editable) if (d.vals[s.id]) merged[s.id] = { ...server[s.id], ...d.vals[s.id] };
    return { vals: merged, restored: true };
  });
  const [vals, setVals] = useState<Vals>(start.vals);
  const [dirty, setDirty] = useState(start.restored);
  const [status, setStatus] = useState<{ kind: "idle" | "saving" | "saved" | "error" | "offline"; text: string }>(
    start.restored
      ? { kind: "offline", text: "Scores saved on this device earlier were restored. Sending them now…" }
      : { kind: "idle", text: submittedAt ? "Submitted. You can still make changes." : "Changes save automatically, even without internet." },
  );
  const [submitted, setSubmitted] = useState(!!submittedAt);
  const [pending, start2] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  const errors = useMemo(() => {
    const out: { name: string; part: Part; msg: string }[] = [];
    for (const s of editable)
      for (const p of parts) {
        const m = problem(vals[s.id]?.[p.key], p.max);
        if (m) out.push({ name: s.name, part: p, msg: m });
      }
    return out;
  }, [vals, editable, parts]);

  const save = useCallback(
    (submit: boolean) => {
      if (errors.length) {
        setStatus({ kind: "error", text: `Not saved: ${errors.length} score${errors.length === 1 ? " needs" : "s need"} fixing.` });
        return;
      }
      const rows = editable.map((s) => {
        const v = vals[s.id] ?? {};
        const num = (k: PartKey) => (v[k] ? Number(v[k]) : null);
        return { student_id: s.id, ca1: num("ca1"), ca2: num("ca2"), ca3: num("ca3"), exam: num("exam") };
      });
      // Keep a copy on this device until the server has it.
      writeDraft(key, { vals: Object.fromEntries(editable.map((s) => [s.id, vals[s.id]])), at: new Date().toISOString() });
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setStatus({ kind: "offline", text: `No internet. Saved on this device at ${clock()}; it will send when you're back online.` });
        return;
      }
      setStatus({ kind: "saving", text: "Saving…" });
      start2(async () => {
        let r: Awaited<ReturnType<typeof saveScores>>;
        try {
          r = await saveScores(csId, termId, rows, submit);
        } catch {
          setStatus({ kind: "offline", text: `Couldn't reach the school's server. Saved on this device at ${clock()}; it will send when the connection is back.` });
          return;
        }
        if (!r.ok) return setStatus({ kind: "error", text: r.error ?? "We couldn't save." });
        writeDraft(key, null);
        setDirty(false);
        if (submit) setSubmitted(true);
        setStatus({ kind: "saved", text: submit ? `Submitted at ${clock()}. The class teacher and admin can see the scores.` : `All changes saved at ${clock()}.` });
      });
    },
    [errors.length, editable, vals, csId, termId, key],
  );

  // Autosave two seconds after the last change.
  useEffect(() => {
    if (!dirty || errors.length) return;
    timer.current = setTimeout(() => save(false), 2000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [dirty, errors.length, vals, save]);

  // Send scores saved on this device when the connection comes back.
  useEffect(() => {
    const back = () => {
      if (readDraft(key)) save(false);
    };
    window.addEventListener("online", back);
    return () => window.removeEventListener("online", back);
  }, [key, save]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty && navigator.onLine) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function set(id: string, k: PartKey, v: string) {
    setVals((old) => ({ ...old, [id]: { ...old[id], [k]: v.trim() } }));
    setDirty(true);
    setStatus({ kind: "idle", text: "Unsaved changes…" });
  }

  /** Pasting a block from Excel fills the boxes from the one you pasted into. */
  function onPaste(e: React.ClipboardEvent<HTMLInputElement>, row: number, col: number) {
    const text = e.clipboardData.getData("text");
    if (!/[\t\n]/.test(text.trim())) return;
    e.preventDefault();
    const lines = text.replace(/\r/g, "").replace(/\n+$/, "").split("\n");
    setVals((old) => {
      const next = { ...old };
      lines.forEach((line, i) => {
        const s = editable[row + i];
        if (!s) return;
        next[s.id] = { ...next[s.id] };
        line.split("\t").forEach((c, j) => {
          const p = parts[col + j];
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
    tableRef.current?.querySelector<HTMLInputElement>(`input[data-cell="${e.shiftKey ? row - 1 : row + 1}-${col}"]`)?.focus();
  }

  const complete = editable.filter((s) => parts.every((p) => vals[s.id]?.[p.key])).length;
  const tone = { error: "text-[#912018]", saved: "text-[#0B6B5A]", offline: "text-[#7A5300]", idle: "text-[#4A5A70]", saving: "text-[#4A5A70]" }[status.kind];

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
        <table ref={tableRef} className="tbl" style={{ minWidth: 300 + parts.length * 110 }}>
          <caption className="sr-only">{title}</caption>
          <thead>
            <tr>
              <th scope="col">Student</th>
              {parts.map((p) => (
                <th key={p.key} scope="col" className="whitespace-nowrap">
                  {p.label} ({p.max})
                </th>
              ))}
              <th scope="col">Total</th>
              <th scope="col">Grade</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => {
              const v = vals[s.id] ?? {};
              const row = editable.indexOf(s);
              const bad = parts.map((p) => problem(v[p.key], p.max));
              const filled = parts.filter((p) => v[p.key]);
              const total = !bad.some(Boolean) && filled.length ? parts.reduce((a, p) => a + (v[p.key] ? Number(v[p.key]) : 0), 0) : null;
              const done = filled.length === parts.length && total !== null;
              const g = done ? gradeOf(total, scale) : null;
              return (
                <tr key={s.id}>
                  <th scope="row">
                    {s.name}
                    {s.locked && <span className="block text-xs font-normal text-[#4A5A70]">Report card released</span>}
                  </th>
                  {parts.map((p, j) => (
                    <td key={p.key}>
                      <input
                        className="sk-input w-[84px] py-2 text-center"
                        inputMode="decimal"
                        autoComplete="off"
                        data-cell={`${row}-${j}`}
                        aria-label={`${p.label} for ${s.name}`}
                        aria-invalid={bad[j] ? true : undefined}
                        aria-describedby={bad[j] ? `e-${s.id}-${p.key}` : undefined}
                        value={v[p.key] ?? ""}
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
        <span role="status" aria-live="polite" className={`text-sm font-semibold ${tone}`}>
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
              const missing = editable.length - complete;
              if (missing > 0 && !window.confirm(`${missing} student${missing === 1 ? " is" : "s are"} missing a score. Submit anyway?`)) return;
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
