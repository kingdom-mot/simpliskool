"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Bar } from "@/components/ui";
import { COLUMNS, mapHeadings, toIsoDate, type ImportProblem, type ImportRow } from "@/lib/students-import";
import { checkStudents, importStudents } from "../actions";

type Step = "template" | "upload" | "check" | "importing" | "done";
const BATCH = 25;

/** Very small CSV reader: commas or semicolons, quoted fields, Windows line endings. */
function parseCsv(text: string): string[][] {
  const sep = (text.split("\n")[0].match(/;/g)?.length ?? 0) > (text.split("\n")[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

function cellText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim();
}

export function ImportWizard({ classNames, schoolName }: { classNames: string[]; schoolName: string }) {
  const [step, setStep] = useState<Step>("template");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [check, setCheck] = useState<{ ready: number; parents: number; problems: ImportProblem[] } | null>(null);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ added: number; parents: number; problems: ImportProblem[] }>({ added: 0, parents: 0, problems: [] });
  const fileRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const go = (s: Step) => {
    setStep(s);
    setError(null);
    requestAnimationFrame(() => headingRef.current?.focus());
  };

  async function downloadTemplate() {
    const { default: writeXlsxFile } = await import("write-excel-file/browser");
    const head = COLUMNS.map((c) => ({ value: c.heading, fontWeight: "bold" as const }));
    const example = COLUMNS.map((c) => ({ value: c.key === "class" ? classNames[0] ?? c.example : c.example, type: String }));
    await writeXlsxFile([
      { data: [head, example], sheet: "Students", columns: COLUMNS.map(() => ({ width: 20 })), stickyRowsCount: 1 },
      { data: [[{ value: "Your classes (type them exactly like this)", fontWeight: "bold" as const }], ...classNames.map((c) => [{ value: c }])], sheet: "Classes", columns: [{ width: 40 }] },
    ]).toFile(`${schoolName.replace(/[^A-Za-z0-9]+/g, "-")}-students-template.xlsx`);
  }

  async function readFile(file: File) {
    setError(null);
    setRows([]);
    setFileName(file.name);
    if (file.size > 5 * 1024 * 1024) return setError("That file is bigger than 5 MB. Split it into smaller files.");
    let table: unknown[][];
    try {
      if (/\.csv$/i.test(file.name)) table = parseCsv(await file.text());
      else if (/\.xlsx$/i.test(file.name)) {
        const { readSheet } = await import("read-excel-file/browser");
        table = (await readSheet(file)) as unknown[][];
      } else return setError("Choose an Excel (.xlsx) or CSV file. Older .xls files: open them in Excel and save as .xlsx.");
    } catch {
      return setError("We couldn't read that file. Make sure it's the filled-in template saved as .xlsx or .csv.");
    }
    const start = table.findIndex((r) => r.some((c) => cellText(c)));
    if (start < 0) return setError("The file is empty.");
    const map = mapHeadings(table[start].map(cellText));
    const missing = (["first_name", "last_name", "class"] as const).filter((k) => map[k] === undefined).map((k) => COLUMNS.find((c) => c.key === k)!.heading);
    if (missing.length) return setError(`We couldn't find these columns: ${missing.join(", ")}. Use the headings from our template.`);

    const out: ImportRow[] = [];
    table.slice(start + 1).forEach((r, i) => {
      if (!r.some((c) => cellText(c))) return;
      const get = (k: keyof typeof map) => (map[k] === undefined ? "" : r[map[k]!]);
      const dob = get("date_of_birth");
      out.push({
        row: start + i + 2,
        first_name: cellText(get("first_name")),
        last_name: cellText(get("last_name")),
        other_names: cellText(get("other_names")),
        gender: cellText(get("gender")),
        date_of_birth: toIsoDate(dob) ?? cellText(dob),
        class: cellText(get("class")),
        admission_no: cellText(get("admission_no")),
        parent_name: cellText(get("parent_name")),
        parent_phone: cellText(get("parent_phone")),
        parent_email: cellText(get("parent_email")),
        relationship: cellText(get("relationship")),
      });
    });
    if (!out.length) return setError("We found the headings but no students under them.");
    if (out.length > 5000) return setError("Upload up to 5,000 students at a time.");
    setRows(out);
  }

  async function runCheck() {
    setBusy(true);
    setError(null);
    const res = await checkStudents(rows).catch(() => ({ error: "We couldn't check the file. Please try again." }));
    setBusy(false);
    if ("error" in res) return setError(res.error);
    setCheck(res);
    go("check");
  }

  async function runImport() {
    const bad = new Set(check?.problems.map((p) => p.row));
    const good = rows.filter((r) => !bad.has(r.row));
    go("importing");
    setProgress(0);
    const total = { added: 0, parents: 0, problems: [] as ImportProblem[] };
    for (let i = 0; i < good.length; i += BATCH) {
      const batch = good.slice(i, i + BATCH);
      const res = await importStudents(batch).catch(() => ({ error: "Connection lost." }));
      if ("error" in res) total.problems.push(...batch.map((r) => ({ row: r.row, name: `${r.first_name} ${r.last_name}`, problem: `Not added: ${res.error}` })));
      else {
        total.added += res.added;
        total.parents += res.parents;
        total.problems.push(...res.problems);
      }
      setProgress(Math.round(((i + batch.length) / good.length) * 100));
    }
    setResult(total);
    go("done");
  }

  const steps: [Step, string][] = [["template", "Get the template"], ["upload", "Upload"], ["check", "Check"], ["done", "Done"]];
  const idx = (s: Step) => (s === "importing" ? 3 : steps.findIndex(([k]) => k === s));

  return (
    <div className="flex flex-col gap-4">
      <nav aria-label="Upload progress">
        <ol className="flex flex-wrap gap-2">
          {steps.map(([k, label], i) => {
            const cur = idx(step) === i;
            const past = idx(step) > i;
            return (
              <li key={k} aria-current={cur ? "step" : undefined} className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-bold ${cur ? "bg-c1 text-white" : past ? "bg-[#E7F6F2] text-[#0B6B5A]" : "bg-white text-[#4A5A70]"}`}>
                <span aria-hidden="true">{past ? "✓" : i + 1}</span>
                {label}
                {past && <span className="sr-only"> (done)</span>}
              </li>
            );
          })}
        </ol>
      </nav>

      <section aria-labelledby="step-h" className="flex flex-col gap-4 rounded-[18px] border border-[#E3EAF3] bg-white p-[22px]">
        {step === "template" && (
          <>
            <h2 id="step-h" ref={headingRef} tabIndex={-1} className="text-xl !text-c1 outline-none">
              Get our Excel template
            </h2>
            <p className="text-[15px] text-[#4A5A70]">Fill one row per student. Put the parent&apos;s name and phone on the same row and we&apos;ll create their sign-in and link them to the child.</p>
            <div className="overflow-x-auto">
              <table className="tbl min-w-[560px]">
                <caption className="sr-only">Template columns</caption>
                <thead>
                  <tr>
                    <th scope="col">Column</th>
                    <th scope="col">Needed?</th>
                    <th scope="col">Example</th>
                  </tr>
                </thead>
                <tbody>
                  {COLUMNS.map((c) => (
                    <tr key={c.key}>
                      <th scope="row">{c.heading}</th>
                      <td>{c.required}</td>
                      <td>{c.key === "class" ? `${classNames[0] ?? c.example} (must match your classes)` : c.example}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap justify-end gap-2.5">
              <button type="button" className="s-btn2" onClick={downloadTemplate}>
                Download template (.xlsx)
              </button>
              <button type="button" className="s-btn" onClick={() => go("upload")}>
                I&apos;ve filled it in
              </button>
            </div>
          </>
        )}

        {step === "upload" && (
          <>
            <h2 id="step-h" ref={headingRef} tabIndex={-1} className="text-xl !text-c1 outline-none">
              Upload your file
            </h2>
            <label
              htmlFor="file"
              className="flex cursor-pointer flex-col items-center gap-1 rounded-2xl border-2 border-dashed border-[#C9D6EA] bg-brand-cloud px-6 py-10 text-center hover:border-c1"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files[0];
                if (f) readFile(f);
              }}
            >
              <span className="text-base font-extrabold text-c1">Choose a file or drag it here</span>
              <span className="text-sm text-[#4A5A70]">Excel (.xlsx) or CSV, up to 5 MB</span>
            </label>
            <input
              ref={fileRef}
              id="file"
              type="file"
              accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) readFile(f);
              }}
            />
            {rows.length > 0 && !error && (
              <p role="status" className="rounded-xl bg-[#E7F6F2] px-4 py-3 text-sm font-semibold text-[#0B6B5A]">
                {fileName}: {rows.length} student{rows.length === 1 ? "" : "s"} found
              </p>
            )}
            {error && (
              <p role="alert" className="rounded-xl bg-[#FEF3F2] px-4 py-3 text-sm font-semibold text-[#912018]">
                {error}
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-2.5">
              <button type="button" className="s-btn2" onClick={() => go("template")}>
                Back
              </button>
              <button type="button" className="s-btn" disabled={!rows.length || busy || !!error} onClick={runCheck}>
                {busy ? "Checking…" : "Check my file"}
              </button>
            </div>
          </>
        )}

        {step === "check" && check && (
          <>
            <h2 id="step-h" ref={headingRef} tabIndex={-1} className="text-xl !text-c1 outline-none">
              Check before importing
            </h2>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-[#E7F6F2] px-3 py-1.5 text-sm font-extrabold text-[#0B6B5A]">{check.ready} ready</span>
              {check.parents > 0 && <span className="rounded-full bg-[#EEF3F9] px-3 py-1.5 text-sm font-extrabold text-[#173B70]">{check.parents} with a parent</span>}
              {check.problems.length > 0 && <span className="rounded-full bg-[#FEF3F2] px-3 py-1.5 text-sm font-extrabold text-[#912018]">{check.problems.length} need fixing</span>}
            </div>
            {check.problems.length > 0 && <Problems problems={check.problems} caption="Rows that need fixing" />}
            <p className="text-[15px] text-[#4A5A70]">
              {check.problems.length ? `You can import the ${check.ready} good rows now and add the rest later, or fix the file and upload it again.` : "Everything looks good."}
            </p>
            <div className="flex flex-wrap justify-end gap-2.5">
              <button
                type="button"
                className="s-btn2"
                onClick={() => {
                  setRows([]);
                  if (fileRef.current) fileRef.current.value = "";
                  go("upload");
                }}
              >
                Upload a fixed file
              </button>
              <button type="button" className="s-btn" disabled={!check.ready} onClick={runImport}>
                Import {check.ready} student{check.ready === 1 ? "" : "s"}
              </button>
            </div>
          </>
        )}

        {step === "importing" && (
          <>
            <h2 id="step-h" ref={headingRef} tabIndex={-1} className="text-xl !text-c1 outline-none">
              Adding students…
            </h2>
            <Bar value={progress} fill="var(--c2,#0B7D6E)" height={12} label="Import progress" />
            <p role="status" className="text-sm text-[#4A5A70]">
              {progress}% done. Please keep this page open.
            </p>
          </>
        )}

        {step === "done" && (
          <>
            <h2 id="step-h" ref={headingRef} tabIndex={-1} className="text-xl !text-c1 outline-none">
              {result.added} student{result.added === 1 ? "" : "s"} added
            </h2>
            <p className="text-[15px] text-[#4A5A70]">
              {result.parents ? `We linked ${result.parents} parent${result.parents === 1 ? "" : "s"}. They can sign in at simpliskool.com with the phone number or email you gave.` : "No parents were linked. You can add them from each student's page."}{" "}
              Next, print PIN slips so younger students can sign in.
            </p>
            {result.problems.length > 0 && <Problems problems={result.problems} caption="Rows not added, or added with a note" />}
            <div className="flex flex-wrap justify-end gap-2.5">
              <Link className="s-btn2" href="/admin/students/import" onClick={() => location.reload()}>
                Upload another file
              </Link>
              <Link className="s-btn" href="/admin/students">
                View students
              </Link>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function Problems({ problems, caption }: { problems: ImportProblem[]; caption: string }) {
  return (
    <div className="max-h-[360px] overflow-auto rounded-xl border border-[#EEF3F9]">
      <table className="tbl min-w-[560px]">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 bg-white">
          <tr>
            <th scope="col">Row</th>
            <th scope="col">Student</th>
            <th scope="col">Problem</th>
          </tr>
        </thead>
        <tbody>
          {problems.slice(0, 300).map((p) => (
            <tr key={`${p.row}-${p.problem}`}>
              <td>{p.row}</td>
              <td className="font-semibold">{p.name}</td>
              <td className="text-[#912018]">{p.problem}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
