import Link from "next/link";
import { PortalShell } from "@/components/PortalShell";
import { PageHero, classLabel } from "@/components/admin";
import { Broadsheet } from "@/components/Broadsheet";
import { CommentBox } from "@/components/CommentBox";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Empty, Pill } from "@/components/ui";
import { requireSchool } from "@/lib/auth";
import { loadTerms, termLabel } from "@/lib/fees";
import { TEACHER_NAV } from "@/lib/nav";
import { saveClassComment } from "@/lib/results-actions";
import { aiReady } from "@/lib/ai";
import { DEFAULT_SCALE, RATINGS, fmtScore, ordinal, suggestComment, type ClassResults, type ScaleRow } from "@/lib/results";

export const metadata = { title: "Class broadsheet and comments" };

export default async function TeacherBroadsheet(props: { searchParams: Promise<{ class?: string; term?: string; student?: string; view?: string; saved?: string }> }) {
  const sp = await props.searchParams;
  const { supabase, school, user, fullName } = await requireSchool(["teacher"]);
  const [{ data: classes }, { terms, term }, { data: scaleRows }] = await Promise.all([
    supabase.from("classes").select("id, name, arm").eq("school_id", school.id).eq("class_teacher_id", user.id).order("level_order").order("name").order("arm").returns<{ id: string; name: string; arm: string }[]>(),
    loadTerms(supabase, school.id, sp.term),
    supabase.from("grading_scales").select("grade, min_score, max_score, remark").eq("school_id", school.id).returns<{ grade: string; min_score: number; max_score: number; remark: string | null }[]>(),
  ]);
  const scale: ScaleRow[] = scaleRows?.length ? scaleRows.map((g) => ({ grade: g.grade, min: Number(g.min_score), max: Number(g.max_score), remark: g.remark })) : DEFAULT_SCALE;
  const cls = classes?.find((c) => c.id === sp.class) ?? classes?.[0];
  const view = sp.view === "sheet" ? "sheet" : "comments";

  let body: React.ReactNode;
  if (!cls) body = <Empty>You aren&apos;t the class teacher of any class. Class teachers write report card comments here. To enter scores, use Score entry.</Empty>;
  else if (!term) body = <Empty>The school hasn&apos;t set up this term yet.</Empty>;
  else {
    const { data } = await supabase.rpc("class_results", { p_class: cls.id, p_term: term.id });
    const r = data as ClassResults | null;
    const name = classLabel(cls.name, cls.arm);
    const qs = (o: Record<string, string>) => `/teacher/broadsheet?${new URLSearchParams({ class: cls.id, term: term.id, ...o })}`;
    const students = r?.students ?? [];
    const sorted = [...students].sort((a, b) => a.name.localeCompare(b.name));
    const cur = sorted.find((s) => s.id === sp.student) ?? sorted.find((s) => !s.comment) ?? sorted[0];
    const idx = cur ? sorted.indexOf(cur) : -1;
    const next = idx >= 0 ? sorted[idx + 1] : undefined;
    const done = students.filter((s) => s.comment).length;
    const subjName = new Map((r?.subjects ?? []).map((s) => [s.id, s.name]));

    body = (
      <>
        <form method="get" className="flex flex-wrap items-end gap-3 rounded-[18px] border border-[#E3EAF3] bg-white p-4">
          <input type="hidden" name="view" value={view} />
          {(classes?.length ?? 0) > 1 && (
            <div>
              <label className="label" htmlFor="b-class">
                Class
              </label>
              <select className="sk-input" id="b-class" name="class" defaultValue={cls.id}>
                {classes!.map((c) => (
                  <option key={c.id} value={c.id}>
                    {classLabel(c.name, c.arm)}
                  </option>
                ))}
              </select>
            </div>
          )}
          {(classes?.length ?? 0) <= 1 && <input type="hidden" name="class" value={cls.id} />}
          <div>
            <label className="label" htmlFor="b-term">
              Term
            </label>
            <select className="sk-input" id="b-term" name="term" defaultValue={term.id}>
              {terms.map((t) => (
                <option key={t.id} value={t.id}>
                  {termLabel(t)}
                  {t.is_current ? " (current)" : ""}
                </option>
              ))}
            </select>
          </div>
          <button className="s-btn2">Open</button>
          <p className="ml-auto text-sm font-semibold text-brand-slate">
            {done} of {students.length} comments written
          </p>
        </form>

        <nav aria-label="Views" className="flex flex-wrap gap-2">
          {[
            ["comments", "Report comments"],
            ["sheet", "Full broadsheet"],
          ].map(([k, l]) => (
            <Link key={k} href={qs({ view: k })} aria-current={view === k ? "page" : undefined} className={`flex min-h-[44px] items-center rounded-xl border-[1.5px] px-4 text-sm font-bold ${view === k ? "border-c1 bg-c1 text-white" : "border-[#DCE5F0] bg-white text-brand-slate"}`}>
              {l}
            </Link>
          ))}
        </nav>

        {!students.length ? (
          <Empty>No students in {name} yet.</Empty>
        ) : view === "sheet" ? (
          <section aria-labelledby="bs-h" className="flex flex-col gap-3 rounded-[18px] border border-[#E3EAF3] bg-white p-[22px]">
            <h2 id="bs-h" className="text-lg !text-c1">
              {name} broadsheet
            </h2>
            <Broadsheet r={r!} scale={scale} caption={`${name} broadsheet: total per subject out of 100, with average and position`} />
            <p className="text-[13px] text-[#4A5A70]">&quot;Missing&quot; means the subject teacher hasn&apos;t entered a score yet; &quot;part&quot; means some of CA 1, CA 2 or the exam is still empty.</p>
          </section>
        ) : (
          <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
            <nav aria-label="Students" className="flex max-h-[70vh] flex-col overflow-y-auto rounded-[18px] border border-[#E3EAF3] bg-white p-2">
              {sorted.map((s) => (
                <Link
                  key={s.id}
                  href={qs({ student: s.id })}
                  aria-current={s.id === cur?.id ? "page" : undefined}
                  className={`flex min-h-[44px] items-center justify-between gap-2 rounded-xl px-3 text-sm ${s.id === cur?.id ? "bg-brand-cloud font-extrabold text-c1" : "font-semibold text-brand-slate"}`}
                >
                  {s.name}
                  {s.comment ? <Pill kind="good">Done</Pill> : null}
                  {s.comment && <span className="sr-only">, comment written</span>}
                </Link>
              ))}
            </nav>
            {cur && (
              <section aria-labelledby="cur-h" className="flex flex-col gap-4 rounded-[18px] border border-[#E3EAF3] bg-white p-[22px]">
                {sp.saved && <p role="status" className="rounded-xl bg-[#E7F6F2] px-4 py-3 text-sm font-semibold text-[#0B6B5A]">Comment saved.</p>}
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 id="cur-h" className="text-xl !text-c1">
                    {cur.name}
                  </h2>
                  <p className="text-sm text-brand-slate">
                    Average <strong>{cur.average === null ? "—" : fmtScore(cur.average)}</strong> · Position <strong>{ordinal(cur.position)}</strong> · Attendance{" "}
                    <strong>{cur.days ? `${cur.present}/${cur.days}` : "—"}</strong>
                  </p>
                </div>
                <ul className="flex flex-wrap gap-2" aria-label="Subject totals">
                  {Object.entries(cur.scores).map(([id, x]) => (
                    <li key={id} className="rounded-xl bg-brand-cloud px-3 py-2 text-sm">
                      {subjName.get(id)} <strong>{fmtScore(x.total)}</strong>
                    </li>
                  ))}
                  {!Object.keys(cur.scores).length && <li className="text-sm text-[#4A5A70]">No scores entered yet.</li>}
                </ul>
                <ActionForm action={saveClassComment} key={cur.id} className="flex flex-col gap-4">
                  <input type="hidden" name="student" value={cur.id} />
                  <input type="hidden" name="term" value={term.id} />
                  <input type="hidden" name="class" value={cls.id} />
                  {next && <input type="hidden" name="next" value={next.id} />}
                  <CommentBox
                    id="ct-comment"
                    name="comment"
                    label="Class teacher's comment"
                    initial={cur.comment ?? ""}
                    ai={aiReady() ? { student: cur.id, term: term.id, who: "teacher" } : null}
                    suggestion={suggestComment(cur.first_name, Object.entries(cur.scores).map(([id, x]) => ({ name: subjName.get(id) ?? "", total: Number(x.total) })), cur.average)}
                  />
                  <fieldset className="flex flex-col gap-2">
                    <legend className="label">Behaviour and skills (1 = poor, 5 = excellent)</legend>
                    {RATINGS.map((k) => (
                      <div key={k} role="radiogroup" aria-label={k} className="flex flex-wrap items-center gap-2">
                        <span className="w-32 text-sm font-semibold text-brand-slate" aria-hidden="true">
                          {k}
                        </span>
                        {[5, 4, 3, 2, 1].map((n) => (
                          <label key={n} className="flex min-h-[44px] min-w-[44px] items-center justify-center gap-1 rounded-xl border-[1.5px] border-[#DCE5F0] px-2 text-sm font-bold has-[:checked]:border-c1 has-[:checked]:bg-c1 has-[:checked]:text-white has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-c2">
                            <input type="radio" name={`r_${k}`} value={n} defaultChecked={cur.ratings?.[k] === n} className="sr-only" />
                            {n}
                            <span className="sr-only"> for {k}</span>
                          </label>
                        ))}
                      </div>
                    ))}
                  </fieldset>
                  <div className="flex flex-wrap gap-2">
                    {next && <input type="hidden" name="go" value="next" />}
                    {next && <SubmitButton>Save and next student</SubmitButton>}
                    {!next && <SubmitButton>Save</SubmitButton>}
                  </div>
                </ActionForm>
              </section>
            )}
          </div>
        )}
      </>
    );
  }

  return (
    <PortalShell school={school} schoolId={school.id} role="teacher" roleLabel="Teacher" fullName={fullName} groups={TEACHER_NAV} active="broadsheet">
      <div className="flex flex-col gap-5">
        <PageHero sub={term ? termLabel(term) : undefined} title={cls ? `${classLabel(cls.name, cls.arm)} report comments` : "Class broadsheet"} />
        {body}
      </div>
    </PortalShell>
  );
}
