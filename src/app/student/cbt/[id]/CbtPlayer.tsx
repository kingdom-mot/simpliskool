"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { handInTest, saveAnswers, type HandInResult } from "../actions";

export type Paper = {
  attempt: string;
  title: string;
  subject: string;
  practice: boolean;
  deadline_at: string;
  now: string;
  answers: Record<string, number>;
  flags: string[];
  questions: { id: string; body: string; options: { i: number; t: string }[] }[];
};

const KEY = (a: string) => `sk-cbt-${a}`;
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

const noop = () => () => {};

/** Runs only in the browser: the test uses this device's saved answers and clock. */
export function CbtPlayer(props: { paper: Paper; who: string; testId: string }) {
  const ready = useSyncExternalStore(noop, () => true, () => false);
  if (!ready) return <p className="rounded-xl bg-white p-4 text-sm text-brand-slate">Loading your test…</p>;
  return <Player {...props} />;
}

function Player({ paper, who, testId }: { paper: Paper; who: string; testId: string }) {
  // Answers on this device win over the server copy (they may not have uploaded yet).
  const [answers, setAnswers] = useState<Record<string, number>>(() => {
    try {
      const local = JSON.parse(localStorage.getItem(KEY(paper.attempt)) ?? "null") as { answers?: Record<string, number> } | null;
      return { ...paper.answers, ...(local?.answers ?? {}) };
    } catch {
      return paper.answers;
    }
  });
  const [flags, setFlags] = useState<string[]>(paper.flags ?? []);
  const [cur, setCur] = useState(0);
  const [save, setSave] = useState<"saved" | "saving" | "offline">("saved");
  const [confirm, setConfirm] = useState(false);
  const [result, setResult] = useState<HandInResult | null>(null);
  const [busy, setBusy] = useState(false);
  // Server clock minus this device's clock, so a wrong phone clock can't change the time left.
  const [offset] = useState(() => new Date(paper.now).getTime() - Date.now());
  const deadline = new Date(paper.deadline_at).getTime();
  const [left, setLeft] = useState(() => Math.max(0, Math.round((deadline - (Date.now() + offset)) / 1000)));
  const dirty = useRef(false);
  const latest = useRef({ answers, flags });
  useEffect(() => {
    latest.current = { answers, flags };
  }, [answers, flags]);
  const total = paper.questions.length;
  const answered = paper.questions.filter((q) => answers[q.id] !== undefined).length;
  const q = paper.questions[cur];
  const heading = useRef<HTMLHeadingElement>(null);

  const push = useCallback(async () => {
    if (!dirty.current) return;
    if (!navigator.onLine) return setSave("offline");
    setSave("saving");
    const r = await saveAnswers(paper.attempt, latest.current.answers, latest.current.flags).catch(() => ({ error: "offline" }));
    if ("error" in r) return setSave("offline");
    dirty.current = false;
    setSave("saved");
  }, [paper.attempt]);

  // Keep a copy on the device and upload a moment after each change.
  useEffect(() => {
    try {
      localStorage.setItem(KEY(paper.attempt), JSON.stringify({ answers, flags }));
    } catch {}
    const t = setTimeout(push, 1200);
    return () => clearTimeout(t);
  }, [answers, flags, paper.attempt, push]);

  useEffect(() => {
    const on = () => push();
    window.addEventListener("online", on);
    return () => window.removeEventListener("online", on);
  }, [push]);

  const handIn = useCallback(async () => {
    setBusy(true);
    const r = await handInTest(paper.attempt, latest.current.answers).catch(() => ({ error: "We couldn't hand in. Check your connection and try again. Your answers are saved on this device." }));
    setBusy(false);
    setConfirm(false);
    if (!("error" in r)) {
      try {
        localStorage.removeItem(KEY(paper.attempt));
      } catch {}
    }
    setResult(r);
  }, [paper.attempt]);

  // Countdown; hand in automatically when time is up.
  useEffect(() => {
    if (result && !("error" in result)) return;
    const t = setInterval(() => {
      const s = Math.max(0, Math.round((deadline - (Date.now() + offset)) / 1000));
      setLeft(s);
      if (s === 0) {
        clearInterval(t);
        handIn();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [deadline, handIn, result, offset]);

  const go = (i: number) => {
    setCur(i);
    requestAnimationFrame(() => heading.current?.focus());
  };
  const choose = (opt: number) => {
    dirty.current = true;
    setAnswers((a) => ({ ...a, [q.id]: opt }));
  };
  const flag = () => {
    dirty.current = true;
    setFlags((f) => (f.includes(q.id) ? f.filter((x) => x !== q.id) : [...f, q.id]));
  };

  if (result && !("error" in result)) {
    return (
      <section aria-labelledby="done-h" className="mx-auto flex w-full max-w-[560px] flex-col items-center gap-3 rounded-[22px] bg-white p-6 text-center">
        <h1 id="done-h" tabIndex={-1} className="text-2xl !text-c1">
          Handed in
        </h1>
        {result.score !== null ? (
          <>
            <p className="text-sm text-[#4A5A70]">You scored</p>
            <p className="font-heading text-5xl font-black text-c1">
              {result.score} <span className="text-2xl text-[#4A5A70]">out of {result.total}</span>
            </p>
          </>
        ) : (
          <p className="text-brand-slate">Your teacher will release the scores.</p>
        )}
        <p className="text-sm text-brand-slate">{result.practice ? "This was practice, so it doesn't count. Go through the answers to see what to work on." : `You answered ${result.answered} of ${result.questions} questions.`}</p>
        <div className="flex flex-wrap justify-center gap-2">
          {result.practice && (
            <Link className="s-btn" href={`/student/cbt/${testId}?review=1`}>
              See the answers
            </Link>
          )}
          <Link className="s-btn2" href="/student/cbt">
            Back to tests
          </Link>
        </div>
      </section>
    );
  }

  const low = left <= 120;
  return (
    <div className="flex flex-col gap-3">
      <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 rounded-b-[18px] bg-c1 px-4 py-3 text-white">
        <div className="min-w-0">
          <p className="truncate font-bold">
            {paper.title} · {paper.subject}
          </p>
          <p className="text-xs">
            {who} · <span role="status">{save === "saved" ? "Answers saved" : save === "saving" ? "Saving…" : "Offline: answers kept on this phone"}</span>
          </p>
        </div>
        <p className={`rounded-xl px-3 py-1.5 font-heading text-xl font-black ${low ? "bg-[#FEF3F2] text-[#912018]" : "bg-white/15 text-white"}`} aria-label={`Time left: ${fmt(left)}`}>
          {fmt(left)}
        </p>
      </header>
      {low && left > 0 && (
        <p role="alert" className="rounded-xl bg-[#FEF3F2] px-4 py-2 text-sm font-semibold text-[#912018]">
          Less than {Math.ceil(left / 60)} minute{Math.ceil(left / 60) === 1 ? "" : "s"} left.
        </p>
      )}
      {result && "error" in result && (
        <p role="alert" className="rounded-xl bg-[#FEF3F2] px-4 py-2 text-sm font-semibold text-[#912018]">
          {result.error}
        </p>
      )}

      <section aria-labelledby="q-h" className="flex flex-col gap-3 rounded-[18px] border border-[#E3EAF3] bg-white p-[18px]">
        <div className="flex items-center justify-between gap-2">
          <h1 id="q-h" ref={heading} tabIndex={-1} className="text-sm font-bold !text-[#4A5A70]">
            Question {cur + 1} of {total}
          </h1>
          {flags.includes(q.id) && <span className="rounded-full bg-[#FFF6E3] px-2.5 py-1 text-xs font-extrabold text-[#7A5300]">Flagged to review</span>}
        </div>
        <p className="whitespace-pre-line text-lg font-semibold text-brand-slate">{q.body}</p>
        <fieldset className="flex flex-col gap-2">
          <legend className="sr-only">Choose an answer</legend>
          {q.options.map((o, k) => (
            <label key={o.i} className="flex min-h-[52px] cursor-pointer items-center gap-3 rounded-xl border-[1.5px] border-[#DCE5F0] px-3 py-2 text-[15px] text-brand-slate has-[:checked]:border-c1 has-[:checked]:bg-[#EEF3F9] has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-c2">
              <input type="radio" name={`q-${q.id}`} checked={answers[q.id] === o.i} onChange={() => choose(o.i)} className="h-5 w-5 flex-none" />
              <span className="w-5 flex-none font-extrabold text-c1">{"ABCDE"[k]}</span>
              <span>{o.t}</span>
            </label>
          ))}
        </fieldset>
        <div className="flex flex-wrap justify-between gap-2">
          <button type="button" className="s-btn2" disabled={cur === 0} onClick={() => go(cur - 1)}>
            ← Previous
          </button>
          <button type="button" className="s-btn2" onClick={flag} aria-pressed={flags.includes(q.id)}>
            {flags.includes(q.id) ? "Unflag" : "Flag to review"}
          </button>
          {cur < total - 1 ? (
            <button type="button" className="s-btn" onClick={() => go(cur + 1)}>
              Next →
            </button>
          ) : (
            <button type="button" className="s-btn" onClick={() => setConfirm(true)}>
              Finish
            </button>
          )}
        </div>
      </section>

      <nav aria-label="Questions" className="flex flex-col gap-2 rounded-[18px] border border-[#E3EAF3] bg-white p-[18px]">
        <p className="text-sm font-bold text-brand-slate">
          Answered ({answered}) · Not answered ({total - answered})
        </p>
        <ol className="grid grid-cols-6 gap-1.5 sm:grid-cols-10">
          {paper.questions.map((x, i) => {
            const a = answers[x.id] !== undefined;
            const f = flags.includes(x.id);
            return (
              <li key={x.id}>
                <button
                  type="button"
                  onClick={() => go(i)}
                  aria-current={i === cur ? "true" : undefined}
                  aria-label={`Question ${i + 1}${a ? ", answered" : ", not answered"}${f ? ", flagged" : ""}`}
                  className={`relative flex h-11 w-full items-center justify-center rounded-lg border-[1.5px] text-sm font-bold ${i === cur ? "border-c1" : "border-[#DCE5F0]"} ${a ? "bg-c1 text-white" : "bg-white text-brand-slate"}`}
                >
                  {i + 1}
                  {f && <span aria-hidden="true" className="absolute -right-1 -top-1 rounded-full bg-[#F2A93B] px-1 text-[10px] font-black text-[#3B2A00]">F</span>}
                </button>
              </li>
            );
          })}
        </ol>
        <button type="button" className="s-btn mt-1 self-start" onClick={() => setConfirm(true)}>
          Hand in test
        </button>
      </nav>

      {confirm && (
        <div role="dialog" aria-modal="true" aria-labelledby="c-h" className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="flex w-full max-w-[420px] flex-col gap-3 rounded-[22px] bg-white p-5">
            <h2 id="c-h" className="text-lg !text-c1">
              Hand in your test?
            </h2>
            <p className="text-sm text-brand-slate">
              You&apos;ve answered {answered} of {total} questions.{answered < total ? ` ${total - answered} ${total - answered === 1 ? "is" : "are"} not answered.` : ""} You can&apos;t change answers after handing in.
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" className="s-btn2" onClick={() => setConfirm(false)} autoFocus>
                Keep working
              </button>
              <button type="button" className="s-btn" onClick={handIn} disabled={busy}>
                {busy ? "Handing in…" : "Hand in"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
