"use client";

import { useState } from "react";
import { Bar } from "@/components/ui";
import { PinSlip, type Slip } from "@/components/PinSlip";
import { resetStudentPin } from "@/lib/student-pin";

type S = { id: string; name: string; hasPin: boolean };

export function PinSheet({ students, className, schoolName, schoolCode, loginHost }: { students: S[]; className: string; schoolName: string; schoolCode: string; loginHost: string }) {
  const without = students.filter((s) => !s.hasPin);
  const [which, setWhich] = useState<"missing" | "all">(without.length ? "missing" : "all");
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [slips, setSlips] = useState<Slip[]>([]);
  const [failed, setFailed] = useState<string[]>([]);
  const target = which === "missing" ? without : students;

  async function run() {
    if (which === "all" && students.some((s) => s.hasPin) && !confirm(`Make new PINs for all ${students.length} students in ${className}? Their old PINs will stop working.`)) return;
    setRunning(true);
    setDone(0);
    setSlips([]);
    setFailed([]);
    const out: Slip[] = [];
    const bad: string[] = [];
    for (let i = 0; i < target.length; i += 3) {
      await Promise.all(
        target.slice(i, i + 3).map(async (s) => {
          const res = await resetStudentPin(s.id).catch(() => ({ ok: false as const, error: "" }));
          if (res.ok) out.push({ name: s.name, className, admissionNo: res.admissionNo, pin: res.pin });
          else bad.push(s.name);
          setDone((d) => d + 1);
        }),
      );
    }
    out.sort((a, b) => a.name.localeCompare(b.name));
    setSlips(out);
    setFailed(bad);
    setRunning(false);
  }

  if (slips.length) {
    return (
      <div className="flex flex-col gap-4">
        <div className="no-print flex flex-wrap items-center justify-between gap-3 rounded-[18px] bg-[#FFF6E3] p-4">
          <p role="status" className="text-sm font-bold text-[#5C4310]">
            {slips.length} new PIN{slips.length === 1 ? "" : "s"} made. They are shown only now: print the slips before leaving this page.
            {failed.length ? ` Not done: ${failed.join(", ")}.` : ""}
          </p>
          <button type="button" className="s-btn" onClick={() => window.print()}>
            Print slips
          </button>
        </div>
        <div className="print-area grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2">
          {slips.map((s) => (
            <PinSlip key={s.admissionNo} slip={s} schoolName={schoolName} schoolCode={schoolCode} loginHost={loginHost} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <section aria-labelledby="ps-h" className="flex flex-col gap-4 rounded-[18px] border border-[#E3EAF3] bg-white p-[22px]">
      <h2 id="ps-h" className="text-lg !text-c1">
        PIN slips for {className}
      </h2>
      <p className="text-[15px] text-[#4A5A70]">
        {students.length} student{students.length === 1 ? "" : "s"} sign in with a PIN. {without.length} {without.length === 1 ? "has" : "have"} no PIN yet.
      </p>
      <fieldset className="flex flex-col gap-2">
        <legend className="label">Make PINs for</legend>
        {(
          [
            ["missing", `Only students without a PIN (${without.length})`],
            ["all", `Everyone in ${className} (${students.length}). Old PINs stop working.`],
          ] as const
        ).map(([k, label]) => (
          <label key={k} className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl border-[1.5px] px-3" style={{ borderColor: which === k ? "var(--c2,#0B7D6E)" : "#DCE5F0" }}>
            <input type="radio" name="which" checked={which === k} onChange={() => setWhich(k)} className="h-5 w-5 accent-[var(--c2,#0B7D6E)]" disabled={running} />
            {label}
          </label>
        ))}
      </fieldset>
      {running && (
        <div className="flex flex-col gap-2">
          <Bar value={Math.round((done / Math.max(1, target.length)) * 100)} fill="var(--c2,#0B7D6E)" height={10} label="PINs made" />
          <p role="status" className="text-sm text-[#4A5A70]">
            {done} of {target.length} done…
          </p>
        </div>
      )}
      <div>
        <button type="button" className="s-btn" onClick={run} disabled={running || !target.length}>
          {running ? "Making PINs…" : `Make ${target.length} PIN${target.length === 1 ? "" : "s"} and show slips`}
        </button>
      </div>
    </section>
  );
}
