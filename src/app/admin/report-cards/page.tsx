import Link from "next/link";
import { AdminPage, Panel, classLabel, requireAdminPage } from "@/components/admin";
import { CommentBox } from "@/components/CommentBox";
import { ActionForm, SubmitButton } from "@/components/forms";
import { ReportCard } from "@/components/ReportCard";
import { Empty, Pill } from "@/components/ui";
import { emailReady } from "@/lib/email";
import { aiReady } from "@/lib/ai";
import { loadTerms, termLabel } from "@/lib/fees";
import { approveResults, releaseResults, savePrincipalComment } from "@/lib/results-actions";
import { RESULTS_ADMIN, suggestComment, type ClassResults, type StudentResult } from "@/lib/results";
import { loadClasses } from "@/lib/results-load";
import { ReleaseButton } from "./ReleaseButton";

export const metadata = { title: "Report cards" };

export default async function ReportCardsPage(props: { searchParams: Promise<{ class?: string; term?: string; student?: string; done?: string; n?: string; sent?: string; failed?: string; skipped?: string; noemail?: string }> }) {
  const sp = await props.searchParams;
  const ctx = await requireAdminPage(RESULTS_ADMIN);
  const { supabase, school } = ctx;
  const [classes, { terms, term }] = await Promise.all([loadClasses(supabase, school.id), loadTerms(supabase, school.id, sp.term)]);
  const cls = classes.find((c) => c.id === sp.class) ?? classes[0];
  if (!cls || !term) {
    return (
      <AdminPage ctx={ctx} active="reportcards" crumb={[{ label: "Results", href: "/admin/results" }]} title="Report cards">
        <Empty>{!term ? "Add the session and terms first." : "Add classes first."}</Empty>
      </AdminPage>
    );
  }

  // Status of every class for the list.
  const [{ data: cs }, { data: sheets }, { data: cards }, { data: approvals }] = await Promise.all([
    supabase.from("class_subjects").select("id, class_id").eq("school_id", school.id).returns<{ id: string; class_id: string }[]>(),
    supabase.from("score_sheets").select("class_subject_id").eq("term_id", term.id).not("submitted_at", "is", null).returns<{ class_subject_id: string }[]>(),
    supabase.from("report_cards").select("class_id").eq("term_id", term.id).not("released_at", "is", null).returns<{ class_id: string | null }[]>(),
    supabase.from("result_approvals").select("class_id").eq("term_id", term.id).returns<{ class_id: string }[]>(),
  ]);
  const approvedSet = new Set((approvals ?? []).map((a) => a.class_id));
  const submitted = new Set((sheets ?? []).map((s) => s.class_subject_id));
  const statusOf = (classId: string) => {
    const mine = (cs ?? []).filter((c) => c.class_id === classId);
    const rel = (cards ?? []).filter((c) => c.class_id === classId).length;
    if (rel) return { text: "Released", kind: "good" as const };
    if (approvedSet.has(classId)) return { text: "Approved", kind: "good" as const };
    if (!mine.length) return { text: "No subjects", kind: "info" as const };
    const done = mine.filter((c) => submitted.has(c.id)).length;
    return done === mine.length ? { text: "Ready to release", kind: "warn" as const } : { text: `Scores ${done} of ${mine.length}`, kind: "info" as const };
  };

  const { data } = await supabase.rpc("class_results", { p_class: cls.id, p_term: term.id });
  const r = data as ClassResults | null;
  const name = classLabel(cls.name, cls.arm);
  const students = [...(r?.students ?? [])].sort((a, b) => a.name.localeCompare(b.name));
  const withScores = students.filter((s) => s.subjects_scored > 0);
  const released = students.filter((s) => s.released_at).length;
  const comments = students.filter((s) => s.comment).length;
  const principal = students.filter((s) => s.principal_comment).length;
  const approved = !!r?.approved_at;
  const cur = students.find((s) => s.id === sp.student) ?? withScores[0] ?? students[0];
  const i = cur ? students.indexOf(cur) : -1;
  const q = (o: Record<string, string>) => `/admin/report-cards?${new URLSearchParams({ class: cls.id, term: term.id, ...o })}`;
  const num = (v?: string) => Math.max(0, Number(v) || 0);
  const notice = (() => {
    const n = num(sp.n);
    if (sp.done === "approved") return "Report cards approved. You can now release them to parents.";
    if (sp.done === "unapproved") return "Approval taken off. Make your changes, then approve again.";
    if (sp.done === "withdrawn") return `${n} report card${n === 1 ? "" : "s"} taken back. Parents can't see them until you release them again.`;
    if (sp.done !== "released") return null;
    let m = `${n} report card${n === 1 ? "" : "s"} released. Parents and students can see them now.`;
    if (sp.sent !== undefined) {
      const [sent, failed, skipped, noEmail] = [num(sp.sent), num(sp.failed), num(sp.skipped), num(sp.noemail)];
      m += sent || failed ? ` Emails: ${sent} sent${failed ? `, ${failed} failed` : ""}.` : skipped ? " Emails weren't sent: email isn't set up yet." : " No new emails to send.";
      if (noEmail) m += ` ${noEmail} student${noEmail === 1 ? " has" : "s have"} no parent email.`;
    }
    return m;
  })();
  const preview = cur ? ((await supabase.rpc("student_result", { p_student: cur.id, p_term: term.id })).data as StudentResult | null) : null;

  return (
    <AdminPage
      ctx={ctx}
      active="reportcards"
      crumb={[{ label: "Results", href: `/admin/results?class=${cls.id}&term=${term.id}` }]}
      title="Report cards"
      actions={
        <form method="get" className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="class" value={cls.id} />
          <div>
            <label className="label" htmlFor="rc-term">
              Term
            </label>
            <select className="sk-input py-2" id="rc-term" name="term" defaultValue={term.id}>
              {terms.map((t) => (
                <option key={t.id} value={t.id}>
                  {termLabel(t)}
                  {t.is_current ? " (current)" : ""}
                </option>
              ))}
            </select>
          </div>
          <button className="s-btn2">Show</button>
        </form>
      }
    >
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <nav aria-label="Classes" className="flex flex-col gap-1 rounded-[18px] border border-[#E3EAF3] bg-white p-2">
          {classes.map((c) => {
            const st = statusOf(c.id);
            const on = c.id === cls.id;
            return (
              <Link
                key={c.id}
                href={`/admin/report-cards?${new URLSearchParams({ class: c.id, term: term.id })}`}
                aria-current={on ? "page" : undefined}
                className={`flex min-h-[48px] items-center justify-between gap-2 rounded-xl px-3 text-sm ${on ? "bg-brand-cloud font-extrabold text-c1" : "font-semibold text-brand-slate"}`}
              >
                {classLabel(c.name, c.arm)}
                <Pill kind={st.kind}>{st.text}</Pill>
              </Link>
            );
          })}
        </nav>

        <div className="flex min-w-0 flex-col gap-4">
          <Panel id="cls-h" title={`${name} · ${termLabel(term)}`}>
            {notice && (
              <p role="status" className="rounded-xl bg-[#E7F6F2] px-4 py-3 text-sm font-semibold text-[#0B6B5A]">
                {notice}
              </p>
            )}
            <p className="text-sm text-brand-slate">
              {withScores.length} of {students.length} students have scores · {comments} class teacher comment{comments === 1 ? "" : "s"} · {principal} principal comment{principal === 1 ? "" : "s"}
              {released ? ` · ${released} released` : ""}
            </p>
            <ol className="flex flex-wrap gap-2 text-sm" aria-label="Steps">
              {[
                ["1", "Scores and comments", withScores.length > 0],
                ["2", "Approve", approved],
                ["3", "Release to parents", released > 0],
              ].map(([n, label, done]) => (
                <li key={String(n)} className={`flex items-center gap-2 rounded-full px-3 py-1.5 font-bold ${done ? "bg-[#E7F6F2] text-[#0B6B5A]" : "bg-brand-cloud text-[#4A5A70]"}`}>
                  <span aria-hidden="true" className={`flex h-6 w-6 items-center justify-center rounded-full text-xs text-white ${done ? "bg-[#0B7D6E]" : "bg-[#7A8BA3]"}`}>
                    {done ? "✓" : n}
                  </span>
                  {label}
                  <span className="sr-only">{done ? " (done)" : " (not done)"}</span>
                </li>
              ))}
            </ol>
            <div className="flex flex-wrap items-start gap-3">
              {!approved && released === 0 && (
                <ActionForm action={approveResults}>
                  <input type="hidden" name="class" value={cls.id} />
                  <input type="hidden" name="term" value={term.id} />
                  <input type="hidden" name="approve" value="1" />
                  {withScores.length ? (
                    <SubmitButton pending="Approving…">
                      Approve {withScores.length} report card{withScores.length === 1 ? "" : "s"}
                    </SubmitButton>
                  ) : (
                    <p className="text-sm text-[#4A5A70]">Approve once subject teachers have entered scores.</p>
                  )}
                </ActionForm>
              )}
              {(approved || released > 0) && (
                <ReleaseButton classId={cls.id} termId={term.id} className={name} count={withScores.length} released={released > 0} emailReady={emailReady()} />
              )}
              {approved && released === 0 && (
                <ActionForm action={approveResults}>
                  <input type="hidden" name="class" value={cls.id} />
                  <input type="hidden" name="term" value={term.id} />
                  <input type="hidden" name="approve" value="0" />
                  <SubmitButton className="s-btn2" pending="Undoing…">
                    Undo approval
                  </SubmitButton>
                </ActionForm>
              )}
              {released > 0 && (
                <ActionForm action={releaseResults}>
                  <input type="hidden" name="class" value={cls.id} />
                  <input type="hidden" name="term" value={term.id} />
                  <input type="hidden" name="release" value="0" />
                  <SubmitButton className="s-btn-danger" pending="Taking back…">
                    Take back from parents
                  </SubmitButton>
                </ActionForm>
              )}
            </div>
            {!approved && released === 0 && withScores.length > 0 && (
              <p className="text-[13px] text-[#4A5A70]">Check the report cards below, then approve them. If a teacher changes a score after approval, you&apos;ll need to approve again.</p>
            )}
          </Panel>

          {cur && preview ? (
            <Panel
              id="pv-h"
              title={`Previewing ${i + 1} of ${students.length}`}
              actions={
                <div className="flex flex-wrap gap-2">
                  {i > 0 && (
                    <Link className="s-btn2" href={q({ student: students[i - 1].id })}>
                      Previous<span className="sr-only"> student</span>
                    </Link>
                  )}
                  {i < students.length - 1 && (
                    <Link className="s-btn2" href={q({ student: students[i + 1].id })}>
                      Next<span className="sr-only"> student</span>
                    </Link>
                  )}
                  <Link className="s-btn2" href={`/report/${cur.id}/${term.id}`}>
                    Print view
                  </Link>
                </div>
              }
            >
              <ActionForm action={savePrincipalComment} key={cur.id} className="flex flex-col gap-2 rounded-xl bg-brand-cloud p-4">
                <input type="hidden" name="student" value={cur.id} />
                <input type="hidden" name="term" value={term.id} />
                <CommentBox
                  id="pr-comment"
                  name="comment"
                  label={`Principal's comment for ${cur.name}`}
                  initial={cur.principal_comment ?? ""}
                  ai={aiReady() ? { student: cur.id, term: term.id, who: "principal" } : null}
                  suggestion={suggestComment(cur.first_name, preview.subjects.map((s) => ({ name: s.name, total: Number(s.total) })), preview.average, "principal")}
                />
                <div>
                  <SubmitButton>Save comment</SubmitButton>
                </div>
              </ActionForm>
              <ReportCard r={preview} />
            </Panel>
          ) : (
            <Empty>No students in {name} yet.</Empty>
          )}
        </div>
      </div>
    </AdminPage>
  );
}
