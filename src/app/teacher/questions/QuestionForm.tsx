"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { saveQuestion } from "./actions";

export type Q = { id: string; body: string; options: string[]; answer: number; topic: string; difficulty: string; explanation: string | null };

/** Add a question, or edit one (when `q` is given). */
export function QuestionForm({ bank, topics, q }: { bank: string; topics: string[]; q?: Q }) {
  const [five, setFive] = useState((q?.options.length ?? 4) > 4);
  const keys = five ? ["A", "B", "C", "D", "E"] : ["A", "B", "C", "D"];
  const p = q?.id ?? "new";
  return (
    <ActionForm action={saveQuestion} resetOnSuccess={!q} className="flex flex-col gap-3">
      <input type="hidden" name="bank" value={bank} />
      {q && <input type="hidden" name="id" value={q.id} />}
      <div>
        <label className="label" htmlFor={`q-body-${p}`}>
          Question
        </label>
        <textarea id={`q-body-${p}`} name="body" rows={2} required maxLength={1000} defaultValue={q?.body} className="sk-input min-h-[70px] py-3" placeholder="If 2x + 3 = 11, what is x?" />
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="label">Options (choose the correct one)</legend>
        {keys.map((k, i) => (
          <div key={k} className="flex items-center gap-2">
            <input type="radio" name="answer" value={k} id={`q-ans-${p}-${k}`} defaultChecked={q ? q.answer === i : i === 0} className="h-5 w-5 flex-none" aria-label={`Option ${k} is correct`} />
            <label htmlFor={`q-opt-${p}-${k}`} className="w-5 flex-none text-sm font-extrabold text-c1">
              {k}
            </label>
            <input id={`q-opt-${p}-${k}`} name={`opt${k}`} maxLength={300} required={i < 2} defaultValue={q?.options[i] ?? ""} className="sk-input" />
          </div>
        ))}
        {!five && (
          <button type="button" className="self-start text-sm font-bold text-c1 underline" onClick={() => setFive(true)}>
            + Add a fifth option
          </button>
        )}
      </fieldset>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor={`q-topic-${p}`}>
            Topic
          </label>
          <input id={`q-topic-${p}`} name="topic" list={`q-topics-${p}`} required maxLength={80} defaultValue={q?.topic ?? topics[0] ?? ""} className="sk-input" />
          <datalist id={`q-topics-${p}`}>
            {topics.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="label" htmlFor={`q-diff-${p}`}>
            Difficulty
          </label>
          <select id={`q-diff-${p}`} name="difficulty" defaultValue={q?.difficulty ?? "medium"} className="sk-input sk-select">
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>
      </div>
      <div>
        <label className="label" htmlFor={`q-exp-${p}`}>
          Explanation <span className="font-normal text-[#4A5A70]">(optional, shown after practice quizzes)</span>
        </label>
        <input id={`q-exp-${p}`} name="explanation" maxLength={600} defaultValue={q?.explanation ?? ""} className="sk-input" />
      </div>
      <div>
        <SubmitButton>{q ? "Save changes" : "Save question"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
