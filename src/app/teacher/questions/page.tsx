import Link from "next/link";
import { PageHero } from "@/components/admin";
import { ActionForm, SubmitButton } from "@/components/forms";
import { PortalShell } from "@/components/PortalShell";
import { Empty, Pill } from "@/components/ui";
import { aiReady } from "@/lib/ai";
import { requireSchool } from "@/lib/auth";
import { TEACHER_NAV } from "@/lib/nav";
import { myClassSubjects } from "@/lib/teaching";
import { deleteQuestion, generateQuestions, markChecked } from "./actions";
import { ImportQuestions } from "./ImportQuestions";
import { QuestionForm, type Q } from "./QuestionForm";

export const metadata = { title: "Question bank" };

type Row = Q & { source: string; checked: boolean; created_by: string | null };
const DIFF: Record<string, string> = { easy: "Easy", medium: "Medium", hard: "Hard" };

export default async function QuestionBank(props: { searchParams: Promise<{ bank?: string; topic?: string; diff?: string }> }) {
  const sp = await props.searchParams;
  const { supabase, school, user, fullName } = await requireSchool(["teacher"]);
  const mine = await myClassSubjects(supabase, school.id, user.id);
  const banks = [...new Map(mine.map((m) => [`${m.subject_id}|${m.level}`, { key: `${m.subject_id}|${m.level}`, label: `${m.level} · ${m.subject}`, subject: m.subject_id, level: m.level }])).values()];
  const bank = banks.find((b) => b.key === sp.bank) ?? banks[0];

  let rows: Row[] = [];
  if (bank) {
    const { data } = await supabase.from("questions").select("id, body, options, answer, topic, difficulty, explanation, source, checked, created_by").eq("school_id", school.id).eq("subject_id", bank.subject).eq("level", bank.level).order("topic").order("created_at", { ascending: false }).returns<Row[]>();
    rows = data ?? [];
  }
  const topics = [...new Set(rows.map((r) => r.topic))].sort();
  const shown = rows.filter((r) => (!sp.topic || r.topic === sp.topic) && (!sp.diff || r.difficulty === sp.diff));
  const drafts = rows.filter((r) => !r.checked);
  const ai = aiReady();

  return (
    <PortalShell school={school} roleLabel="Teacher" fullName={fullName} groups={TEACHER_NAV} active="questions">
      <div className="flex flex-col gap-5">
        <PageHero title="Question bank" sub={bank ? `${bank.label} · ${rows.length} question${rows.length === 1 ? "" : "s"}` : undefined} />
        {!bank ? (
          <Empty>You don&apos;t have any subjects yet. The school admin gives teachers their subjects under Classes and subjects.</Empty>
        ) : (
          <>
            <form method="get" className="flex flex-wrap items-end gap-3 rounded-[18px] border border-[#E3EAF3] bg-white p-4">
              <div className="min-w-[200px] flex-1">
                <label className="label" htmlFor="qb-bank">
                  Class level and subject
                </label>
                <select id="qb-bank" name="bank" defaultValue={bank.key} className="sk-input sk-select">
                  {banks.map((b) => (
                    <option key={b.key} value={b.key}>
                      {b.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-w-[160px]">
                <label className="label" htmlFor="qb-topic">
                  Topic
                </label>
                <select id="qb-topic" name="topic" defaultValue={sp.topic ?? ""} className="sk-input sk-select">
                  <option value="">All topics</option>
                  {topics.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-w-[140px]">
                <label className="label" htmlFor="qb-diff">
                  Difficulty
                </label>
                <select id="qb-diff" name="diff" defaultValue={sp.diff ?? ""} className="sk-input sk-select">
                  <option value="">Any difficulty</option>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
              <button className="s-btn2">Show</button>
            </form>

            <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 xl:grid-cols-[1.3fr_1fr]">
              <section aria-labelledby="qs-h" className="flex flex-col gap-3 rounded-[18px] border border-t-[5px] border-[#E3EAF3] border-t-c2 bg-white p-[22px]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 id="qs-h" className="text-lg !text-c1">
                    Questions ({shown.length})
                  </h2>
                  {drafts.length > 1 && (
                    <ActionForm action={markChecked}>
                      {drafts.map((d) => (
                        <input key={d.id} type="hidden" name="id" value={d.id} />
                      ))}
                      <SubmitButton className="s-btn2" pending="Saving…">
                        Mark all {drafts.length} AI drafts as checked
                      </SubmitButton>
                    </ActionForm>
                  )}
                </div>
                {shown.length ? (
                  <ol className="flex flex-col gap-3">
                    {shown.map((q, n) => (
                      <li key={q.id} className={`flex flex-col gap-2 rounded-xl border p-3 ${q.checked ? "border-[#E3EAF3]" : "border-[#F2D99B] bg-[#FFFBF0]"}`}>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-extrabold text-[#4A5A70]">Q{n + 1}</span>
                          <Pill kind="info">{q.topic}</Pill>
                          <Pill kind={q.difficulty === "hard" ? "bad" : q.difficulty === "easy" ? "good" : "warn"}>{DIFF[q.difficulty]}</Pill>
                          {!q.checked && <Pill kind="warn">AI draft · check it</Pill>}
                        </div>
                        <p className="whitespace-pre-line font-semibold text-brand-slate">{q.body}</p>
                        <ul className="grid grid-cols-[minmax(0,1fr)] gap-1 sm:grid-cols-2">
                          {q.options.map((o, i) => (
                            <li key={i} className={`rounded-lg px-2 py-1 text-sm ${i === q.answer ? "bg-[#E7F6F2] font-bold text-[#0B6B5A]" : "text-brand-slate"}`}>
                              {"ABCDE"[i]}. {o}
                              {i === q.answer && <span className="sr-only"> (correct answer)</span>}
                            </li>
                          ))}
                        </ul>
                        {q.explanation && <p className="text-[13px] text-[#4A5A70]">Why: {q.explanation}</p>}
                        <div className="flex flex-wrap items-center gap-2">
                          {!q.checked && (
                            <ActionForm action={markChecked}>
                              <input type="hidden" name="id" value={q.id} />
                              <SubmitButton className="s-btn2" pending="Saving…">
                                Looks right<span className="sr-only">: question {n + 1}</span>
                              </SubmitButton>
                            </ActionForm>
                          )}
                          <details className="w-full">
                            <summary className="inline-flex min-h-[44px] cursor-pointer items-center text-sm font-bold text-c1 underline">Edit<span className="sr-only"> question {n + 1}</span></summary>
                            <div className="mt-2 rounded-xl bg-brand-cloud p-3">
                              <QuestionForm bank={bank.key} topics={topics} q={q} />
                              {(q.created_by === user.id || q.created_by === null) && (
                                <ActionForm action={deleteQuestion} className="mt-3">
                                  <input type="hidden" name="id" value={q.id} />
                                  <SubmitButton className="s-btn-danger" pending="Deleting…">
                                    Delete question
                                  </SubmitButton>
                                </ActionForm>
                              )}
                            </div>
                          </details>
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <Empty>{rows.length ? "No questions match these filters." : "No questions yet. Add one, import from Excel, or let AI draft some."}</Empty>
                )}
              </section>

              <div className="flex flex-col gap-5">
                <section aria-labelledby="add-h" className="flex flex-col gap-3 rounded-[18px] border border-t-[5px] border-[#E3EAF3] border-t-c1 bg-white p-[22px]">
                  <h2 id="add-h" className="text-lg !text-c1">
                    Add a question
                  </h2>
                  <QuestionForm bank={bank.key} topics={topics} />
                </section>
                {ai && (
                  <section aria-labelledby="gen-h" className="flex flex-col gap-3 rounded-[18px] border border-[#E3EAF3] bg-white p-[22px]">
                    <h2 id="gen-h" className="text-lg !text-c1">
                      Draft questions with AI
                    </h2>
                    <ActionForm action={generateQuestions} className="flex flex-col gap-3">
                      <input type="hidden" name="bank" value={bank.key} />
                      <div>
                        <label className="label" htmlFor="gen-topic">
                          Topic
                        </label>
                        <input id="gen-topic" name="topic" list="gen-topics" required maxLength={80} defaultValue={sp.topic ?? topics[0] ?? ""} className="sk-input" />
                        <datalist id="gen-topics">
                          {topics.map((t) => (
                            <option key={t} value={t} />
                          ))}
                        </datalist>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="label" htmlFor="gen-diff">
                            Difficulty
                          </label>
                          <select id="gen-diff" name="difficulty" defaultValue="medium" className="sk-input sk-select">
                            <option value="easy">Easy</option>
                            <option value="medium">Medium</option>
                            <option value="hard">Hard</option>
                          </select>
                        </div>
                        <div>
                          <label className="label" htmlFor="gen-n">
                            How many
                          </label>
                          <select id="gen-n" name="count" defaultValue="5" className="sk-input sk-select">
                            {[3, 5, 10].map((n) => (
                              <option key={n} value={n}>
                                {n}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <p className="text-[13px] text-[#4A5A70]">AI questions are saved as drafts. Check each one; drafts can&apos;t go into a test until you do.</p>
                      <div>
                        <SubmitButton pending="Drafting…">Draft with AI</SubmitButton>
                      </div>
                    </ActionForm>
                  </section>
                )}
                <section aria-labelledby="imp-h" className="flex flex-col gap-3 rounded-[18px] border border-[#E3EAF3] bg-white p-[22px]">
                  <h2 id="imp-h" className="text-lg !text-c1">
                    Import from Excel
                  </h2>
                  <ImportQuestions bank={bank.key} label={bank.label} />
                </section>
                <p className="text-[13px] text-[#4A5A70]">
                  The bank is shared with other teachers of {bank.label}. Use it in{" "}
                  <Link className="s-link" href="/teacher/cbt">
                    CBT tests
                  </Link>
                  .
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </PortalShell>
  );
}
