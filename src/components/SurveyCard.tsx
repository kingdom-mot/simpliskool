import { ActionForm, SubmitButton } from "@/components/forms";
import { submitSurvey, surveyLater } from "@/lib/survey-actions";
import { SURVEYS, type Group, type Question, type SurveyKey } from "@/lib/surveys";

/** The pilot survey, shown as a card on the person's home page until they answer it. */
export function SurveyCard({ survey, group, page }: { survey: SurveyKey; group: Group; page: string }) {
  const s = SURVEYS[survey];
  const qs = s.questions[group] ?? [];
  const hoursQs = qs.filter((q) => q.kind === "hours");
  const otherQs = qs.filter((q) => q.kind !== "hours");
  return (
    <section aria-labelledby="sv-h" className="flex flex-col gap-3 rounded-[18px] border-2 border-c2 bg-white p-[18px]">
      <div>
        <h2 id="sv-h" className="text-base !text-c1">
          {s.title}
        </h2>
        <p className="mt-1 text-sm text-[#263449]">{s.intro}</p>
      </div>
      <details>
        <summary className="s-btn inline-flex cursor-pointer list-none hover:opacity-100">Answer now</summary>
        <ActionForm action={submitSurvey} className="mt-4 flex flex-col gap-4">
          <input type="hidden" name="survey" value={survey} />
          <input type="hidden" name="page" value={page} />
          {hoursQs.length > 1 && (
            <fieldset className="flex flex-col gap-2">
              <legend className="label">
                {hoursQs[0].kind === "hours" && hoursQs[0].hint}
              </legend>
              <div className="grid grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-2">
                {hoursQs.map((q) => (
                  <div key={q.id}>
                    <label className="text-sm font-semibold text-[#263449]" htmlFor={`sv-${q.id}`}>
                      {q.label} (hours a month)
                    </label>
                    <input id={`sv-${q.id}`} name={q.id} inputMode="decimal" required className="sk-input mt-1" placeholder="e.g. 20" />
                  </div>
                ))}
              </div>
            </fieldset>
          )}
          {hoursQs.length === 1 && <Field q={hoursQs[0]} />}
          {otherQs.map((q) => (
            <Field key={q.id} q={q} />
          ))}
          <div>
            <SubmitButton pending="Saving…">Send my answers</SubmitButton>
          </div>
        </ActionForm>
      </details>
      <form action={surveyLater}>
        <input type="hidden" name="survey" value={survey} />
        <input type="hidden" name="page" value={page} />
        <button className="s-link text-sm">Not now</button>
      </form>
    </section>
  );
}

function Field({ q }: { q: Question }) {
  const id = `sv-${q.id}`;
  if (q.kind === "hours")
    return (
      <div>
        <label className="label" htmlFor={id}>
          {q.label}
        </label>
        {q.hint && <p className="-mt-1 mb-1 text-[13px] text-[#4A5A70]">{q.hint}</p>}
        <input id={id} name={q.id} inputMode="decimal" required className="sk-input max-w-[200px]" placeholder="Hours" />
      </div>
    );
  if (q.kind === "text")
    return (
      <div>
        <label className="label" htmlFor={id}>
          {q.label}
          {q.optional ? " (optional)" : ""}
        </label>
        <textarea id={id} name={q.id} rows={2} maxLength={1000} required={!q.optional} className="sk-input min-h-[64px] py-3" placeholder={q.placeholder} />
      </div>
    );
  if (q.kind === "choice")
    return (
      <fieldset>
        <legend className="label">{q.label}</legend>
        <div className="flex flex-col gap-1.5">
          {q.options.map((o) => (
            <label key={o} className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border-[1.5px] border-[#DCE5F0] px-3 text-sm font-semibold has-[:checked]:border-c1 has-[:checked]:bg-brand-cloud">
              <input type="radio" name={q.id} value={o} required className="h-4 w-4" />
              {o}
            </label>
          ))}
        </div>
      </fieldset>
    );
  const nums = Array.from({ length: q.max - (q.min ?? 1) + 1 }, (_, i) => i + (q.min ?? 1));
  return (
    <fieldset>
      <legend className="label">{q.label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {nums.map((n) => (
          <label key={n} className="flex h-11 min-w-[44px] cursor-pointer items-center justify-center rounded-xl border-[1.5px] border-[#DCE5F0] px-2 text-sm font-bold has-[:checked]:border-c1 has-[:checked]:bg-c1 has-[:checked]:text-white has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-c1">
            <input type="radio" name={q.id} value={n} required className="sr-only" />
            {n}
          </label>
        ))}
      </div>
      <p className="mt-1 flex justify-between text-xs text-[#4A5A70]">
        <span>
          {q.min ?? 1} = {q.low}
        </span>
        <span>
          {q.max} = {q.high}
        </span>
      </p>
    </fieldset>
  );
}
