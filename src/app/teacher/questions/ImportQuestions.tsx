"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { importQuestions } from "./actions";

const HEAD = ["Question", "A", "B", "C", "D", "E", "Answer", "Topic", "Difficulty", "Explanation"];
const text = (c: unknown) => (c === null || c === undefined ? "" : String(c).trim());

/** Excel (.xlsx) or CSV with our columns → rows sent to the server. */
export function ImportQuestions({ bank, label }: { bank: string; label: string }) {
  const [rows, setRows] = useState<unknown[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  async function template() {
    const { default: write } = await import("write-excel-file/browser");
    await write([
      {
        sheet: "Questions",
        columns: HEAD.map((h) => ({ width: h === "Question" || h === "Explanation" ? 40 : 14 })),
        stickyRowsCount: 1,
        data: [
          HEAD.map((h) => ({ value: h, fontWeight: "bold" as const })),
          ["If 2x + 3 = 11, what is x?", "7", "4", "8", "5.5", "", "B", "Simple equations", "Easy", "Take 3 from both sides, then divide by 2."].map((v) => ({ value: v })),
        ],
      },
    ]).toFile(`question-bank-template.xlsx`);
  }

  async function read(file: File) {
    setMsg(null);
    setRows([]);
    let table: unknown[][];
    try {
      if (/\.xlsx$/i.test(file.name)) {
        const { readSheet } = await import("read-excel-file/browser");
        table = (await readSheet(file)) as unknown[][];
      } else if (/\.csv$/i.test(file.name)) {
        table = (await file.text()).split(/\r?\n/).map((l) => l.split(",").map((c) => c.replace(/^"|"$/g, "")));
      } else return setMsg("Choose an Excel (.xlsx) or CSV file.");
    } catch {
      return setMsg("We couldn't read that file. Use the template, saved as .xlsx.");
    }
    const start = table.findIndex((r) => r.some((c) => text(c)));
    if (start < 0) return setMsg("The file is empty.");
    const heads = table[start].map((c) => text(c).toLowerCase());
    const col = (h: string) => heads.indexOf(h.toLowerCase());
    if (col("question") < 0 || col("answer") < 0 || col("a") < 0) return setMsg("Use the columns from our template: Question, A, B, C, D, E, Answer, Topic, Difficulty, Explanation.");
    const out = table
      .slice(start + 1)
      .map((r, i) => ({ r, row: start + i + 2 }))
      .filter(({ r }) => r.some((c) => text(c)))
      .map(({ r, row }) => {
        const opts = ["a", "b", "c", "d", "e"].map((k) => (col(k) < 0 ? "" : text(r[col(k)])));
        const letter = text(r[col("answer")]).toUpperCase().slice(0, 1);
        // Keep letters lined up with the options that are filled in.
        const kept: string[] = [];
        let answer = -1;
        opts.forEach((o, i) => {
          if (!o) return;
          if ("ABCDE"[i] === letter) answer = kept.length;
          kept.push(o);
        });
        return { row, body: text(r[col("question")]), options: kept, answer, topic: col("topic") < 0 ? "" : text(r[col("topic")]), difficulty: col("difficulty") < 0 ? "" : text(r[col("difficulty")]), explanation: col("explanation") < 0 ? "" : text(r[col("explanation")]) };
      });
    if (!out.length) return setMsg("No questions found under the headings.");
    setRows(out);
    setMsg(`${out.length} question${out.length === 1 ? "" : "s"} found. Press Import to add them to ${label}.`);
  }

  return (
    <ActionForm action={importQuestions} onSuccess={() => setRows([])} className="flex flex-col gap-3">
      <input type="hidden" name="bank" value={bank} />
      <input type="hidden" name="rows" value={JSON.stringify(rows)} />
      <p className="text-sm text-brand-slate">
        Fill in our template in Excel (one question per row, the right answer as a letter), then choose it here.{" "}
        <button type="button" onClick={template} className="font-bold text-c1 underline">
          Download the template
        </button>
      </p>
      <div>
        <label className="label" htmlFor="imp-file">
          Excel or CSV file
        </label>
        <input id="imp-file" type="file" accept=".xlsx,.csv" className="sk-input py-2" onChange={(e) => e.target.files?.[0] && read(e.target.files[0])} />
      </div>
      {msg && (
        <p role="status" className="text-sm font-semibold text-brand-slate">
          {msg}
        </p>
      )}
      <div>
        <SubmitButton pending="Importing…">Import {rows.length ? `${rows.length} question${rows.length === 1 ? "" : "s"}` : "questions"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
