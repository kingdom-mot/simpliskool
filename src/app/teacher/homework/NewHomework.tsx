"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { createHomework } from "./actions";

type CS = { id: string; label: string; subject: string };

export function NewHomework({ classes, parts, preselect, defaultDate }: { classes: CS[]; parts: { key: string; label: string; max: number }[]; preselect: string | null; defaultDate: string }) {
  const [kind, setKind] = useState<"homework" | "assignment">("homework");
  const [modes, setModes] = useState<string[]>(["photo", "file"]);
  const [picked, setPicked] = useState<string[]>(preselect ? [preselect] : classes.length === 1 ? [classes[0].id] : []);
  const subject = classes.find((c) => c.id === picked[0])?.subject;
  const caParts = parts.filter((p) => p.key !== "exam");
  const toggleMode = (m: string) => {
    if (m === "paper") setModes(modes.includes("paper") ? ["photo"] : ["paper"]);
    else setModes((cur) => {
      const base = cur.filter((x) => x !== "paper");
      return base.includes(m) ? base.filter((x) => x !== m) : [...base, m];
    });
  };
  const chip = "flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border-[1.5px] border-[#DCE5F0] px-3 text-sm font-bold text-brand-slate has-[:checked]:border-c2 has-[:checked]:bg-[#F3FBF9] has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-c2";

  return (
    <ActionForm action={createHomework} resetOnSuccess onSuccess={() => setPicked(preselect ? [preselect] : [])} className="flex flex-col gap-4">
      <fieldset className="flex flex-wrap gap-2">
        <legend className="label">Type</legend>
        <label className={chip}>
          <input type="radio" name="kind" value="homework" checked={kind === "homework"} onChange={() => setKind("homework")} className="h-4 w-4" /> Homework
        </label>
        <label className={chip}>
          <input type="radio" name="kind" value="assignment" checked={kind === "assignment"} onChange={() => setKind("assignment")} className="h-4 w-4" /> Assignment (counts toward CA)
        </label>
      </fieldset>
      <div>
        <label className="label" htmlFor="hw-title">
          Title
        </label>
        <input id="hw-title" name="title" className="sk-input" required minLength={3} maxLength={160} placeholder="e.g. Simple equations, Exercise 4B" />
      </div>
      <div>
        <label className="label" htmlFor="hw-ins">
          Instructions
        </label>
        <textarea id="hw-ins" name="instructions" rows={4} maxLength={4000} className="sk-input min-h-[110px] py-3" placeholder="Solve questions 1 to 12. Show every step. Take a clear photo of your working and upload it." />
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="label">Classes</legend>
        <div className="flex flex-wrap gap-2">
          {classes.map((c) => {
            const other = !!subject && c.subject !== subject && !picked.includes(c.id);
            return (
              <label key={c.id} className={`${chip} ${other ? "opacity-60" : ""}`}>
                <input
                  type="checkbox"
                  name="cs"
                  value={c.id}
                  checked={picked.includes(c.id)}
                  onChange={(e) => setPicked(e.target.checked ? [...picked.filter((x) => classes.find((k) => k.id === x)?.subject === c.subject), c.id] : picked.filter((x) => x !== c.id))}
                  className="h-4 w-4"
                />
                {c.label}
              </label>
            );
          })}
        </div>
        <span className="text-[13px] text-[#4A5A70]">Pick classes for one subject at a time. Each class gets its own copy to mark.</span>
      </fieldset>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="hw-marks">
            Marks
          </label>
          <input id="hw-marks" name="max_marks" type="number" min={1} max={100} step="0.5" required defaultValue={10} className="sk-input" />
        </div>
        <div>
          <label className="label" htmlFor="hw-date">
            Due date
          </label>
          <input id="hw-date" name="due_date" type="date" required defaultValue={defaultDate} className="sk-input" />
        </div>
        <div>
          <label className="label" htmlFor="hw-time">
            Due time
          </label>
          <input id="hw-time" name="due_time" type="time" required defaultValue="16:00" className="sk-input" />
        </div>
      </div>
      {kind === "assignment" && caParts.length > 0 && (
        <div className="max-w-sm">
          <label className="label" htmlFor="hw-ca">
            Counts toward
          </label>
          <select id="hw-ca" name="ca_part" className="sk-input sk-select" defaultValue={caParts[caParts.length - 1].key}>
            {caParts.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label} (out of {p.max})
              </option>
            ))}
          </select>
          <span className="mt-1 block text-[13px] text-[#4A5A70]">After marking, send the marks to the score sheet with one click. They&apos;re scaled to fit.</span>
        </div>
      )}
      <fieldset className="flex flex-col gap-2">
        <legend className="label">Students can hand in</legend>
        <div className="flex flex-wrap gap-2">
          {[
            ["photo", "Photo"],
            ["file", "File"],
            ["text", "Typed answer"],
            ["paper", "On paper in class"],
          ].map(([k, l]) => (
            <label key={k} className={chip}>
              <input type="checkbox" name="mode" value={k} checked={modes.includes(k)} onChange={() => toggleMode(k)} className="h-4 w-4" /> {l}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex min-h-[44px] items-center gap-2 text-sm font-semibold text-brand-slate">
        <input type="checkbox" name="allow_late" value="1" defaultChecked className="h-5 w-5" /> Accept late work (marked as late)
      </label>
      <div>
        <label className="label" htmlFor="hw-attach">
          Attach a worksheet (optional)
        </label>
        <input id="hw-attach" name="attach" type="file" multiple accept="image/*,.pdf,.docx,.xlsx,.pptx" className="sk-input py-2" aria-describedby="hw-attach-h" />
        <span id="hw-attach-h" className="mt-1 block text-[13px] text-[#4A5A70]">
          PDF, Word, Excel, PowerPoint or a photo. Up to 4 MB in all.
        </span>
      </div>
      <p className="text-[13px] text-[#4A5A70]">Students and parents see it in the app as soon as you set it.</p>
      <div>
        <SubmitButton pending="Setting…">{kind === "assignment" ? "Set assignment" : "Set homework"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
