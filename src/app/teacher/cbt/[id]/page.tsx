import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHero } from "@/components/admin";
import { Flash } from "@/components/Flash";
import { ActionForm, SubmitButton } from "@/components/forms";
import { PortalShell } from "@/components/PortalShell";
import { Bar, Empty, Pill } from "@/components/ui";
import { requireSchool } from "@/lib/auth";
import { TEACHER_NAV } from "@/lib/nav";
import { asParts } from "@/lib/results";
import { dayTime, num } from "@/lib/teaching";
import { allowStudent, deleteTest, sendTestToCa } from "../actions";

export const metadata = { title: "CBT results" };

type T = { id: string; title: string; practice: boolean; opens_at: string; closes_at: string; duration_min: number; question_ids: string[]; marks_each: number; ca_part: string | null; ca_sent_at: string | null; show_score: boolean; subjects: { name: string } | null };
type S = { id: string; name: string; class: string; started_at: string | null; submitted_at: string | null; score: number | null; total: number | null; minutes: number | null; timed_out: boolean; in_progress: boolean; extra_min: number | null; until: string | null };
type R = { students: S[]; missed: { body: string; topic: string; wrong: number; of: number }[] };
const nowMs = () => Date.now();
const at = (iso: string) => Date.parse(iso);

export default async function CbtResults(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const { supabase, school, fullName } = await requireSchool(["teacher"]);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { data: t } = await supabase.from("cbt_tests").select("id, title, practice, opens_at, closes_at, duration_min, question_ids, marks_each, ca_part, ca_sent_at, show_score, subjects(name)").eq("id", id).maybeSingle<T>();
  if (!t) notFound();
  const [{ data: res, error }, { data: partsRaw }] = await Promise.all([supabase.rpc("cbt_results", { p_test: id }), supabase.rpc("assessment_parts", { p_school: school.id })]);
  if (error) notFound();
  const r = res as R;
  const done = r.students.filter((s) => s.submitted_at);
  const total = Number(t.question_ids.length) * Number(t.marks_each);
  const avg = done.length ? done.reduce((a, s) => a + Number(s.score), 0) / done.length : null;
  const now = nowMs();
  const closed = now > at(t.closes_at);
  const open = now >= at(t.opens_at) && !closed;
  const part = t.ca_part ? asParts(partsRaw).find((p) => p.key === t.ca_part) : null;
  // Score bands for a quick picture of the class.
  const bands = [
    { l: "70% and above", n: done.filter((s) => Number(s.score) / total >= 0.7).length, c: "#0B7D6E" },
    { l: "50–69%", n: done.filter((s) => Number(s.score) / total >= 0.5 && Number(s.score) / total < 0.7).length, c: "#B7791F" },
    { l: "Under 50%", n: done.filter((s) => Number(s.score) / total < 0.5).length, c: "#B42318" },
  ];

  return (
    <PortalShell school={school} roleLabel="Teacher" fullName={fullName} groups={TEACHER_NAV} active="cbt">
      <div className="flex flex-col gap-5">
        <PageHero
          title={t.title}
          sub={
            <>
              <Link href="/teacher/cbt" className="font-semibold text-white underline underline-offset-2">
                CBT tests
              </Link>{" "}
              / {t.subjects?.name} · {t.question_ids.length} questions · {t.duration_min} min · {dayTime(t.opens_at)} to {dayTime(t.closes_at)}
            </>
          }
        />
        <Flash />
        <div className="flex flex-wrap gap-2">
          <Pill kind={closed ? "good" : open ? "warn" : "info"}>{closed ? "Finished" : open ? "Open now" : "Scheduled"}</Pill>
          {t.practice && <Pill kind="info">Practice: doesn&apos;t count</Pill>}
          {part && <Pill kind="info">Counts toward {part.label}</Pill>}
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-3">
          <section aria-labelledby="how-h" className="flex flex-col gap-3 rounded-[18px] border border-t-[5px] border-[#E3EAF3] border-t-c2 bg-white p-[22px]">
            <h2 id="how-h" className="text-lg !text-c1">
              How the class did
            </h2>
            <dl className="grid grid-cols-2 gap-3">
              <div>
                <dt className="text-xs font-bold uppercase tracking-[0.05em] text-[#4A5A70]">Average</dt>
                <dd className="font-heading text-2xl font-black text-c1">{avg === null ? "—" : `${num(Math.round(avg * 10) / 10)} / ${num(total)}`}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-[0.05em] text-[#4A5A70]">Took the test</dt>
                <dd className="font-heading text-2xl font-black text-c1">
                  {done.length} of {r.students.length}
                </dd>
              </div>
            </dl>
            {done.length > 0 && (
              <ul className="flex flex-col gap-2">
                {bands.map((b) => (
                  <li key={b.l} className="text-sm">
                    <div className="mb-1 flex justify-between font-bold text-brand-slate">
                      <span>{b.l}</span>
                      <span>{b.n}</span>
                    </div>
                    <Bar value={Math.round((b.n / done.length) * 100)} fill={b.c} label={`${b.l}: ${b.n} students`} height={6} />
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section aria-labelledby="miss-h" className="flex flex-col gap-3 rounded-[18px] border border-[#E3EAF3] bg-white p-[22px] lg:col-span-2">
            <h2 id="miss-h" className="text-lg !text-c1">
              Questions most got wrong
            </h2>
            {r.missed.filter((m) => m.wrong > 0).length ? (
              <ol className="flex flex-col gap-2">
                {r.missed
                  .filter((m) => m.wrong > 0)
                  .map((m, i) => (
                    <li key={i} className="flex items-start justify-between gap-3 border-b border-[#EEF3F9] pb-2 text-sm last:border-0">
                      <span>
                        <span className="text-brand-slate">{m.body}</span>
                        <span className="block text-xs text-[#4A5A70]">{m.topic}</span>
                      </span>
                      <Pill kind={m.wrong / m.of >= 0.5 ? "bad" : "warn"}>
                        {Math.round((m.wrong / m.of) * 100)}% wrong
                      </Pill>
                    </li>
                  ))}
              </ol>
            ) : (
              <Empty>{done.length ? "Everyone got every question right." : "Shows once students hand in."}</Empty>
            )}
            {r.missed.some((m) => m.wrong / m.of >= 0.5) && (
              <Link className="s-btn2 self-start" href={`/teacher/ai?task=simpler&topic=${encodeURIComponent(r.missed[0].topic)}`}>
                Plan a revision lesson with AI
              </Link>
            )}
          </section>
        </div>

        <section aria-labelledby="st-h" className="flex flex-col gap-3 rounded-[18px] border border-[#E3EAF3] bg-white p-[22px]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="st-h" className="text-lg !text-c1">
              Students
            </h2>
            {part && done.length > 0 && (
              <ActionForm action={sendTestToCa} className="flex flex-col items-end gap-2">
                <input type="hidden" name="id" value={t.id} />
                <SubmitButton pending="Sending…">{t.ca_sent_at ? `Send to ${part.label} again` : `Send scores to ${part.label}`}</SubmitButton>
                {t.ca_sent_at && <span className="text-xs text-[#4A5A70]">Sent {dayTime(t.ca_sent_at)}</span>}
              </ActionForm>
            )}
          </div>
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Students' results: scroll sideways to see more">
            <table className="tbl min-w-[760px]">
              <caption className="sr-only">Results for {t.title}</caption>
              <thead>
                <tr>
                  <th scope="col">Student</th>
                  <th scope="col">Class</th>
                  <th scope="col">Score</th>
                  <th scope="col">Time taken</th>
                  <th scope="col">Note</th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {r.students.map((s) => {
                  const note = s.submitted_at ? (s.timed_out ? "Ran out of time" : "") : s.in_progress ? "Taking it now" : closed ? "Didn't take it" : "Not started";
                  const act = (what: string, label: string) => (
                    <ActionForm action={allowStudent}>
                      <input type="hidden" name="test" value={t.id} />
                      <input type="hidden" name="student" value={s.id} />
                      <input type="hidden" name="what" value={what} />
                      <SubmitButton className="s-btn2" pending="Saving…">
                        {label}
                        <span className="sr-only"> for {s.name}</span>
                      </SubmitButton>
                    </ActionForm>
                  );
                  return (
                    <tr key={s.id}>
                      <th scope="row">{s.name}</th>
                      <td>{s.class}</td>
                      <td className="font-bold">{s.submitted_at ? `${num(s.score)} / ${num(s.total)}` : "—"}</td>
                      <td>{s.minutes !== null ? `${s.minutes} min` : "—"}</td>
                      <td>
                        {note}
                        {s.extra_min ? ` · +${s.extra_min} min allowed` : ""}
                        {s.until && at(s.until) > now ? ` · open for them until ${dayTime(s.until)}` : ""}
                      </td>
                      <td>
                        <div className="flex flex-wrap justify-end gap-1">
                          {!s.submitted_at && !s.in_progress && closed && act("reopen", "Reopen for them")}
                          {!s.submitted_at && act("extra", "+10 min")}
                          {s.submitted_at && act("retake", "Let them retake")}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!r.students.length && <Empty>No students in these classes.</Empty>}
        </section>

        {!done.length && (
          <ActionForm action={deleteTest}>
            <input type="hidden" name="id" value={t.id} />
            <SubmitButton className="s-btn-danger" pending="Deleting…">
              Delete this test
            </SubmitButton>
          </ActionForm>
        )}
      </div>
    </PortalShell>
  );
}
