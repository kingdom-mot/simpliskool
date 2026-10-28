"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { addQuizToBank, ask, saveNoteDraft, type NoteDraft, type Reply, type Task } from "./actions";
import type { Mcq } from "@/lib/ai-teach";

const TASKS: { key: Task; l: string; d: string; example: string }[] = [
  { key: "note", l: "Lesson note", d: "A full plan for one lesson", example: "Simple equations: forming and solving equations like x + 4 = 10" },
  { key: "quiz", l: "Quiz questions", d: "Multiple choice for the question bank", example: "5 medium questions on simple equations" },
  { key: "simpler", l: "Explain it simply", d: "Re-explain a topic for weaker students", example: "Explain solving equations to a student who finds it hard" },
  { key: "homework", l: "Homework ideas", d: "Tasks to set, with what a good answer has", example: "Homework on fractions for the weekend" },
];

type Turn = { role: "user" | "assistant"; text: string; reply?: Reply };

export function Assistant({ classes, used: used0, limit, start }: { classes: { id: string; label: string }[]; used: number; limit: number; start: { task: Task; topic: string } }) {
  const [task, setTask] = useState<Task>(start.task);
  const [cs, setCs] = useState(classes[0]?.id ?? "");
  const [minutes, setMinutes] = useState(40);
  const [text, setText] = useState(start.topic ? (start.task === "simpler" ? `Explain ${start.topic} simply for students who got it wrong in the test` : start.topic) : "");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [used, setUsed] = useState(used0);
  const [saved, setSaved] = useState<{ msg: string; href?: string; error?: boolean } | null>(null);
  const out = useRef<HTMLDivElement>(null);
  const t = TASKS.find((x) => x.key === task)!;

  async function send(again?: string) {
    const req = (again ?? text).trim();
    if (!req || busy) return;
    setBusy(true);
    setSaved(null);
    const history = turns.filter((x) => x.role === "user" || x.reply?.hasOwnProperty("kind")).map((x) => ({ role: x.role, text: x.role === "user" ? x.text : x.reply && "kind" in x.reply && x.reply.kind === "text" ? x.reply.text : "(draft given)" }));
    const reply = await ask(task, cs, req, history, minutes).catch(() => ({ error: "Couldn't reach the server. Check your connection." }) as Reply);
    setBusy(false);
    if (!("error" in reply)) setUsed((u) => u + 1);
    setTurns((cur) => [...cur, { role: "user", text: req }, { role: "assistant", text: "", reply }]);
    if (!again) setText("");
    requestAnimationFrame(() => out.current?.lastElementChild?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  }
  const pickTask = (k: Task) => {
    setTask(k);
    setTurns([]);
    setSaved(null);
  };
  const done = (r: { ok: string } | { error: string }) => {
    if ("error" in r) return setSaved({ msg: r.error, error: true });
    const [msg, href] = r.ok.split("|");
    setSaved({ msg, href });
  };
  const copy = (s: string) => navigator.clipboard?.writeText(s).then(() => setSaved({ msg: "Copied." }));

  const noteText = (n: NoteDraft) => `Topic: ${n.topic}\n\nObjectives:\n${n.objectives}\n\nMaterials: ${n.materials}\n\nSteps:\n${n.content}\n\nEvaluation:\n${n.evaluation}`;
  const quizText = (qs: Mcq[]) => qs.map((q, i) => `${i + 1}. ${q.body}\n${q.options.map((o, k) => `   ${"ABCDE"[k]}) ${o}${k === q.answer ? " ✓" : ""}`).join("\n")}`).join("\n\n");
  const asText = (r: Exclude<Reply, { error: string }>) => (r.kind === "text" ? r.text : r.kind === "note" ? noteText(r.note) : quizText(r.questions));
  const lastUser = [...turns].reverse().find((x) => x.role === "user")?.text;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
      <nav aria-label="What do you need?" className="flex flex-col gap-2">
        {TASKS.map((x) => (
          <button key={x.key} type="button" onClick={() => pickTask(x.key)} aria-pressed={task === x.key} className={`flex flex-col items-start rounded-[16px] border-2 bg-white p-3 text-left ${task === x.key ? "border-c1" : "border-[#E3EAF3] hover:border-c2"}`}>
            <span className="font-bold text-c1">{x.l}</span>
            <span className="text-[13px] text-[#4A5A70]">{x.d}</span>
          </button>
        ))}
        <p className="text-[13px] text-[#4A5A70]">
          This month: {used} of {limit} requests used
        </p>
      </nav>

      <section aria-labelledby="conv-h" className="flex flex-col gap-4 rounded-[18px] border border-t-[5px] border-[#E3EAF3] border-t-c2 bg-white p-[22px]">
        <h2 id="conv-h" className="text-lg !text-c1">
          {t.l}
        </h2>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="ai-cs">
              Class and subject
            </label>
            <select id="ai-cs" value={cs} onChange={(e) => setCs(e.target.value)} className="sk-input sk-select">
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          {task === "note" && (
            <div>
              <label className="label" htmlFor="ai-len">
                Length
              </label>
              <select id="ai-len" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className="sk-input sk-select">
                <option value={40}>40-minute lesson</option>
                <option value={80}>80-minute double</option>
              </select>
            </div>
          )}
        </div>

        <div ref={out} className="flex flex-col gap-3" aria-live="polite">
          {turns.map((x, i) =>
            x.role === "user" ? (
              <p key={i} className="self-end rounded-[16px] bg-[#EEF3F9] px-4 py-2 text-sm text-brand-slate">
                {x.text}
              </p>
            ) : x.reply && "error" in x.reply ? (
              <p key={i} role="alert" className="rounded-xl bg-[#FEF3F2] px-4 py-3 text-sm font-semibold text-[#912018]">
                {x.reply.error}
              </p>
            ) : x.reply ? (
              <div key={i} className="flex flex-col gap-2 rounded-[16px] border border-[#F2D99B] bg-[#FFFBF0] p-4">
                <span className="text-xs font-extrabold tracking-[0.06em] text-[#7A5300]">DRAFT · CHECK BEFORE USING</span>
                {x.reply.kind === "text" && <p className="whitespace-pre-line text-sm text-brand-slate">{x.reply.text}</p>}
                {x.reply.kind === "note" && <p className="whitespace-pre-line text-sm text-brand-slate">{noteText(x.reply.note)}</p>}
                {x.reply.kind === "quiz" && <p className="whitespace-pre-line text-sm text-brand-slate">{quizText(x.reply.questions)}</p>}
                <div className="flex flex-wrap gap-2">
                  {x.reply.kind === "note" && (
                    <button type="button" className="s-btn" onClick={async () => done(await saveNoteDraft(cs, (x.reply as { note: NoteDraft }).note, minutes))}>
                      Save to lesson notes
                    </button>
                  )}
                  {x.reply.kind === "quiz" && (
                    <button type="button" className="s-btn" onClick={async () => done(await addQuizToBank(cs, (x.reply as { topic: string }).topic, (x.reply as { questions: Mcq[] }).questions))}>
                      Add {x.reply.questions.length} to question bank
                    </button>
                  )}
                  <button type="button" className="s-btn2" onClick={() => copy(asText(x.reply as Exclude<Reply, { error: string }>))}>
                    Copy
                  </button>
                  {i === turns.length - 1 && lastUser && (
                    <button type="button" className="s-btn2" onClick={() => send(lastUser)} disabled={busy}>
                      Try again
                    </button>
                  )}
                </div>
              </div>
            ) : null,
          )}
          {busy && <p className="text-sm text-[#4A5A70]">Writing a draft…</p>}
        </div>
        {saved && (
          <p role={saved.error ? "alert" : "status"} className={`rounded-xl px-4 py-3 text-sm font-semibold ${saved.error ? "bg-[#FEF3F2] text-[#912018]" : "bg-[#E7F6F2] text-[#0B6B5A]"}`}>
            {saved.msg}{" "}
            {saved.href && (
              <Link href={saved.href} className="underline">
                Open it
              </Link>
            )}
          </p>
        )}

        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <label className="label" htmlFor="ai-ask">
            {turns.length ? "Ask a follow-up" : "Ask the assistant"}
          </label>
          <textarea id="ai-ask" rows={3} value={text} onChange={(e) => setText(e.target.value)} maxLength={1500} className="sk-input min-h-[80px] py-3" placeholder={t.example} />
          <div>
            <button className="s-btn" disabled={busy || !text.trim() || !cs}>
              {busy ? "Writing…" : "Send"}
            </button>
          </div>
        </form>
        <p className="text-[13px] text-[#4A5A70]">Drafts you check and edit. Nothing is shared with students until you save it. Only the class level, subject and your request are sent, never students&apos; details.</p>
      </section>
    </div>
  );
}
