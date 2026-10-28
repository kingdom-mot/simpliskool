"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { createTest } from "./actions";

export type Bank = { key: string; label: string; classes: { id: string; label: string }[]; topics: { name: string; n: number }[] };

export function NewTest({ banks, parts, defaults }: { banks: Bank[]; parts: { key: string; label: string; max: number }[]; defaults: { openDate: string; closeDate: string } }) {
  const [key, setKey] = useState(banks[0]?.key ?? "");
  const bank = banks.find((b) => b.key === key) ?? banks[0];
  const [topics, setTopics] = useState<string[]>(bank?.topics.map((t) => t.name) ?? []);
  const [count, setCount] = useState(10);
  const [practice, setPractice] = useState(false);
  const available = bank?.topics.filter((t) => topics.includes(t.name)).reduce((a, t) => a + t.n, 0) ?? 0;
  const ca = parts.filter((p) => p.key !== "exam");
  const chip = "flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border-[1.5px] border-[#DCE5F0] px-3 text-sm font-bold text-brand-slate has-[:checked]:border-c2 has-[:checked]:bg-[#F3FBF9] has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-c2";
  if (!bank) return null;

  return (
    <ActionForm action={createTest} className="flex flex-col gap-4">
      <div>
        <label className="label" htmlFor="t-bank">
          Class level and subject
        </label>
        <select
          id="t-bank"
          name="bank"
          value={key}
          onChange={(e) => {
            setKey(e.target.value);
            setTopics(banks.find((b) => b.key === e.target.value)?.topics.map((t) => t.name) ?? []);
          }}
          className="sk-input sk-select"
        >
          {banks.map((b) => (
            <option key={b.key} value={b.key}>
              {b.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="t-title">
          Test name
        </label>
        <input id="t-title" name="title" required minLength={3} maxLength={120} className="sk-input" placeholder="e.g. CA 2 Mathematics" />
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="label">Classes</legend>
        <div className="flex flex-wrap gap-2">
          {bank.classes.map((c) => (
            <label key={c.id} className={chip}>
              <input type="checkbox" name="class" value={c.id} defaultChecked className="h-4 w-4" /> {c.label}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex min-h-[44px] items-center gap-2 text-sm font-semibold text-brand-slate">
        <input type="checkbox" name="practice" value="1" checked={practice} onChange={(e) => setPractice(e.target.checked)} className="h-5 w-5" /> Practice quiz (doesn&apos;t count; students see the right answers at the end)
      </label>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="t-dur">
            Time allowed
          </label>
          <select id="t-dur" name="duration" defaultValue="30" className="sk-input sk-select">
            {[10, 15, 20, 30, 45, 60, 90, 120].map((m) => (
              <option key={m} value={m}>
                {m < 60 ? `${m} minutes` : m === 60 ? "1 hour" : `${m / 60} hours`}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="t-count">
            Questions
          </label>
          <input id="t-count" name="count" type="number" min={1} max={Math.max(1, Math.min(100, available))} value={count} onChange={(e) => setCount(Number(e.target.value))} required className="sk-input" aria-describedby="t-count-h" />
          <span id="t-count-h" className="mt-1 block text-[13px] text-[#4A5A70]">
            {available} available in the topics ticked
          </span>
        </div>
        <div>
          <label className="label" htmlFor="t-marks">
            Marks each
          </label>
          <input id="t-marks" name="marks_each" type="number" min={0.5} max={10} step={0.5} defaultValue={1} className="sk-input" />
        </div>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
        <fieldset className="grid grid-cols-2 gap-2">
          <legend className="label">Opens</legend>
          <label className="sr-only" htmlFor="t-od">
            Opening date
          </label>
          <input id="t-od" name="open_date" type="date" required defaultValue={defaults.openDate} className="sk-input" />
          <label className="sr-only" htmlFor="t-ot">
            Opening time
          </label>
          <input id="t-ot" name="open_time" type="time" required defaultValue="09:00" className="sk-input" />
        </fieldset>
        <fieldset className="grid grid-cols-2 gap-2">
          <legend className="label">Closes</legend>
          <label className="sr-only" htmlFor="t-cd">
            Closing date
          </label>
          <input id="t-cd" name="close_date" type="date" required defaultValue={defaults.closeDate} className="sk-input" />
          <label className="sr-only" htmlFor="t-ct">
            Closing time
          </label>
          <input id="t-ct" name="close_time" type="time" required defaultValue="16:00" className="sk-input" />
        </fieldset>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="label">Questions from the bank</legend>
        {bank.topics.length ? (
          <div className="flex flex-col gap-1">
            {bank.topics.map((t) => (
              <label key={t.name} className="flex min-h-[44px] items-center gap-2 text-sm text-brand-slate">
                <input type="checkbox" name="topic" value={t.name} checked={topics.includes(t.name)} onChange={(e) => setTopics(e.target.checked ? [...topics, t.name] : topics.filter((x) => x !== t.name))} className="h-5 w-5" />
                {t.name} ({t.n} in bank)
              </label>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[#912018]">No checked questions for {bank.label} yet. Add some in the question bank first.</p>
        )}
        <span className="text-[13px] text-[#4A5A70]">
          {Math.min(count, available)} questions · {count} chosen at random from the topics ticked
        </span>
      </fieldset>
      <label className="flex min-h-[44px] items-center gap-2 text-sm font-semibold text-brand-slate">
        <input type="checkbox" name="shuffle" value="1" defaultChecked className="h-5 w-5" /> Shuffle questions and options for each student
      </label>
      {!practice && (
        <>
          <label className="flex min-h-[44px] items-center gap-2 text-sm font-semibold text-brand-slate">
            <input type="checkbox" name="show_score" value="1" defaultChecked className="h-5 w-5" /> Show students their score as soon as they finish
          </label>
          {ca.length > 0 && (
            <div className="max-w-sm">
              <label className="label" htmlFor="t-ca">
                Counts toward
              </label>
              <select id="t-ca" name="ca_part" defaultValue="" className="sk-input sk-select">
                <option value="">Nothing (just a class test)</option>
                {ca.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label} (out of {p.max}): send scores with one click
                  </option>
                ))}
              </select>
            </div>
          )}
        </>
      )}
      <p className="text-[13px] text-[#4A5A70]">Answers save on the student&apos;s device if the network drops, and upload when it&apos;s back. When time runs out, answers are handed in automatically.</p>
      <div>
        <SubmitButton pending="Scheduling…">Schedule test</SubmitButton>
      </div>
    </ActionForm>
  );
}
