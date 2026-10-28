import Link from "next/link";
import { PageHero } from "@/components/admin";
import { PortalShell } from "@/components/PortalShell";
import { Empty, Pill } from "@/components/ui";
import { requireSchool } from "@/lib/auth";
import { loadTerms, termLabel } from "@/lib/fees";
import { TEACHER_NAV } from "@/lib/nav";
import { classLabel, myClassSubjects, num } from "@/lib/teaching";
import { levelOrder } from "@/lib/nigeria";

export const metadata = { title: "My classes" };

type Card = { key: string; class_id: string; cs: string | null; name: string; subject: string | null; form: boolean; students: number; periods: number; scores: number; hw: { n: number; of: number } | null };
type Row = { id: string; name: string; present: number; marked: number; absent: number; hw_set: number; hw_in: number; last_test: { score: number; total: number; title: string } | null };

export default async function MyClasses(props: { searchParams: Promise<{ c?: string }> }) {
  const sp = await props.searchParams;
  const { supabase, school, user, fullName } = await requireSchool(["teacher"]);
  const [mine, { term }, { data: formRows }] = await Promise.all([
    myClassSubjects(supabase, school.id, user.id),
    loadTerms(supabase, school.id),
    supabase.from("classes").select("id, name, arm, level_order").eq("school_id", school.id).eq("class_teacher_id", user.id).returns<{ id: string; name: string; arm: string; level_order: number }[]>(),
  ]);
  const formIds = new Set((formRows ?? []).map((c) => c.id));
  const classIds = [...new Set([...mine.map((m) => m.class_id), ...formIds])];
  const csIds = mine.map((m) => m.id);

  const [{ data: studs }, { data: periods }, { data: scoreRows }, { data: hwRows }] = await Promise.all([
    classIds.length ? supabase.from("students").select("class_id").in("class_id", classIds).eq("status", "active").returns<{ class_id: string }[]>() : Promise.resolve({ data: [] as { class_id: string }[] }),
    csIds.length ? supabase.from("timetable_periods").select("class_subject_id").in("class_subject_id", csIds).returns<{ class_subject_id: string }[]>() : Promise.resolve({ data: [] as { class_subject_id: string }[] }),
    csIds.length && term ? supabase.from("scores").select("class_subject_id").in("class_subject_id", csIds).eq("term_id", term.id).returns<{ class_subject_id: string }[]>() : Promise.resolve({ data: [] as { class_subject_id: string }[] }),
    csIds.length && term
      ? supabase.from("homework").select("id, class_subject_id, due_at, submit_modes, homework_submissions(status)").in("class_subject_id", csIds).eq("term_id", term.id).order("due_at", { ascending: false }).returns<{ id: string; class_subject_id: string; due_at: string; submit_modes: string[]; homework_submissions: { status: string }[] }[]>()
      : Promise.resolve({ data: [] as { id: string; class_subject_id: string; due_at: string; submit_modes: string[]; homework_submissions: { status: string }[] }[] }),
  ]);
  const count = <T,>(rows: T[] | null, key: (r: T) => string) => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) m.set(key(r), (m.get(key(r)) ?? 0) + 1);
    return m;
  };
  const nStud = count(studs, (r) => r.class_id);
  const nPer = count(periods, (r) => r.class_subject_id);
  const nScore = count(scoreRows, (r) => r.class_subject_id);
  const latestHw = new Map<string, { n: number }>();
  for (const h of hwRows ?? []) {
    if (latestHw.has(h.class_subject_id) || h.submit_modes.join() === "paper") continue;
    latestHw.set(h.class_subject_id, { n: h.homework_submissions.filter((s) => s.status !== "draft").length });
  }

  const cards: Card[] = mine.map((m) => ({
    key: m.id,
    class_id: m.class_id,
    cs: m.id,
    name: m.className,
    subject: m.subject,
    form: formIds.has(m.class_id),
    students: nStud.get(m.class_id) ?? 0,
    periods: nPer.get(m.id) ?? 0,
    scores: nScore.get(m.id) ?? 0,
    hw: latestHw.has(m.id) ? { n: latestHw.get(m.id)!.n, of: nStud.get(m.class_id) ?? 0 } : null,
  }));
  for (const c of formRows ?? []) {
    if (cards.some((k) => k.class_id === c.id)) continue;
    cards.push({ key: c.id, class_id: c.id, cs: null, name: classLabel(c.name, c.arm), subject: null, form: true, students: nStud.get(c.id) ?? 0, periods: 0, scores: 0, hw: null });
  }
  cards.sort((a, b) => levelOrder(a.name) - levelOrder(b.name) || a.name.localeCompare(b.name) || (a.subject ?? "").localeCompare(b.subject ?? ""));
  const sel = cards.find((c) => c.key === sp.c) ?? cards[0];
  const formNames = cards.filter((c) => c.form).map((c) => c.name).filter((v, i, a) => a.indexOf(v) === i);
  const subjNames = [...new Set(mine.map((m) => m.subject))];

  let roster: Row[] = [];
  if (sel && term) {
    const { data } = await supabase.rpc("class_roster", { p_class: sel.class_id, p_class_subject: sel.cs, p_term: term.id });
    roster = (data as Row[] | null) ?? [];
  }
  const pctOf = (a: number, b: number) => (b ? Math.round((a / b) * 100) : null);
  const ratio = (a: number, b: number) => (b ? a / b : 1);
  const tone = (a: number, b: number) => (b === 0 ? "info" : a >= b ? "good" : a / b >= 0.6 ? "warn" : "bad");

  return (
    <PortalShell school={school} roleLabel="Teacher" fullName={fullName} groups={TEACHER_NAV} active="classes">
      <div className="flex flex-col gap-5">
        <PageHero title="My classes" sub={term ? termLabel(term) : undefined} />
        {!cards.length ? (
          <Empty>You don&apos;t have any classes yet. The school admin gives teachers their classes and subjects under Classes and subjects.</Empty>
        ) : (
          <>
            <p className="-mt-2 text-sm text-[#4A5A70]">
              {formNames.length ? `You're the class teacher of ${formNames.join(" and ")}` : "You're not a class teacher this term"}
              {subjNames.length ? `${formNames.length ? ", and you" : ". You"} teach ${subjNames.join(", ")}.` : "."} The register and report comments are only for your own class.
            </p>
            <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {cards.map((c) => {
                const on = c.key === sel?.key;
                return (
                  <li key={c.key}>
                    <Link
                      href={`/teacher/classes?c=${c.key}`}
                      aria-current={on ? "true" : undefined}
                      className={`flex h-full flex-col gap-2 rounded-[18px] border-2 bg-white p-4 hover:border-c2 ${on ? "border-c1 shadow-sm" : "border-[#E3EAF3]"}`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-heading text-xl font-extrabold text-c1">{c.name}</span>
                        <Pill kind={c.form ? "good" : "info"}>{c.form && c.subject ? "Class teacher + subject" : c.form ? "Class teacher" : "Subject teacher"}</Pill>
                      </div>
                      <span className="text-sm text-brand-slate">
                        {[c.subject, `${c.students} student${c.students === 1 ? "" : "s"}`, c.subject ? `${c.periods} period${c.periods === 1 ? "" : "s"} a week` : null].filter(Boolean).join(" · ")}
                      </span>
                      {c.subject && (
                        <span className="flex flex-wrap gap-2">
                          <Pill kind={tone(c.scores, c.students)}>
                            Scores {c.scores}/{c.students}
                          </Pill>
                          <Pill kind={c.hw ? tone(c.hw.n, c.hw.of) : "info"}>{c.hw ? `Homework ${c.hw.n}/${c.hw.of}` : "No homework set"}</Pill>
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>

            {sel && (
              <section aria-labelledby="sel-h" className="flex flex-col gap-4 rounded-[18px] border border-t-[5px] border-[#E3EAF3] border-t-c2 bg-white p-[22px]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 id="sel-h" className="text-lg !text-c1">
                    {sel.name}
                    {sel.subject ? ` · ${sel.subject}` : ""}
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {sel.form && (
                      <Link className="s-btn2" href={`/teacher/register?class=${sel.class_id}`}>
                        Register
                      </Link>
                    )}
                    {sel.cs && (
                      <>
                        <Link className="s-btn2" href={`/teacher/scores?cs=${sel.cs}`}>
                          Enter scores
                        </Link>
                        <Link className="s-btn2" href={`/teacher/notes?cs=${sel.cs}`}>
                          Lesson notes
                        </Link>
                        <Link className="s-btn" href={`/teacher/homework?new=1&cs=${sel.cs}#new-h`}>
                          Set homework
                        </Link>
                      </>
                    )}
                  </div>
                </div>
                {!term ? (
                  <Empty>The school hasn&apos;t set up this term yet.</Empty>
                ) : roster.length ? (
                  <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={`Students in ${sel.name}: scroll sideways to see more`}>
                    <table className="tbl min-w-[640px]">
                      <caption className="sr-only">Students in {sel.name}</caption>
                      <thead>
                        <tr>
                          <th scope="col">Student</th>
                          <th scope="col">Attendance</th>
                          <th scope="col">Last test</th>
                          {sel.cs && <th scope="col">Homework handed in</th>}
                          <th scope="col">Note</th>
                        </tr>
                      </thead>
                      <tbody>
                        {roster.map((s) => {
                          const att = pctOf(s.present, s.marked);
                          const test = s.last_test ? ratio(s.last_test.score, s.last_test.total) : null;
                          const hw = s.hw_set ? ratio(s.hw_in, s.hw_set) : null;
                          const flags: { t: string; k: "warn" | "bad" }[] = [];
                          if (s.absent >= 3) flags.push({ t: `${s.absent} absences`, k: "warn" });
                          if ((test !== null && test < 0.5) || (hw !== null && hw < 0.5)) flags.push({ t: "Falling behind", k: "bad" });
                          return (
                            <tr key={s.id}>
                              <th scope="row">{s.name}</th>
                              <td>{att === null ? "No register yet" : `${att}%`}</td>
                              <td>{s.last_test ? `${num(s.last_test.score)} / ${num(s.last_test.total)}` : "—"}</td>
                              {sel.cs && <td>{s.hw_set ? `${s.hw_in} of ${s.hw_set}` : "—"}</td>}
                              <td>
                                <span className="flex flex-wrap gap-1">
                                  {flags.map((f) => (
                                    <Pill key={f.t} kind={f.k}>
                                      {f.t}
                                    </Pill>
                                  ))}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <Empty>No students in {sel.name} yet.</Empty>
                )}
                <p className="text-[13px] text-[#4A5A70]">Attendance is for this term. &quot;Falling behind&quot; means under half marks on the last test, or fewer than half of the homework handed in.</p>
              </section>
            )}
          </>
        )}
      </div>
    </PortalShell>
  );
}
