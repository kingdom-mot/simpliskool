import Link from "next/link";
import { PageHero } from "@/components/admin";
import { Flash } from "@/components/Flash";
import { PortalShell } from "@/components/PortalShell";
import { Empty, Pill } from "@/components/ui";
import { requireSchool } from "@/lib/auth";
import { loadTerms, termLabel } from "@/lib/fees";
import { TEACHER_NAV } from "@/lib/nav";
import { asParts } from "@/lib/results";
import { dayLabel, lagosParts, myClassSubjects, num } from "@/lib/teaching";
import { NewHomework } from "./NewHomework";

export const metadata = { title: "Homework and assignments" };

type Hw = { id: string; class_subject_id: string; kind: string; title: string; due_at: string; max_marks: number; submit_modes: string[]; homework_submissions: { status: string }[] };
const weekAhead = () => lagosParts(new Date(Date.now() + 3 * 86400000)).date;
const nowMs = () => Date.now();

export default async function TeacherHomework(props: { searchParams: Promise<{ tab?: string; new?: string; cs?: string }> }) {
  const sp = await props.searchParams;
  const { supabase, school, user, fullName } = await requireSchool(["teacher"]);
  const [mine, { term }, { data: partsRaw }] = await Promise.all([myClassSubjects(supabase, school.id, user.id), loadTerms(supabase, school.id), supabase.rpc("assessment_parts", { p_school: school.id })]);
  const csIds = mine.map((m) => m.id);
  const { data: rows } = csIds.length && term
    ? await supabase.from("homework").select("id, class_subject_id, kind, title, due_at, max_marks, submit_modes, homework_submissions(status)").in("class_subject_id", csIds).eq("term_id", term.id).order("due_at").returns<Hw[]>()
    : { data: [] as Hw[] };
  const { data: studs } = csIds.length ? await supabase.from("students").select("class_id").in("class_id", [...new Set(mine.map((m) => m.class_id))]).eq("status", "active").returns<{ class_id: string }[]>() : { data: [] };
  const size = new Map<string, number>();
  for (const s of studs ?? []) size.set(s.class_id, (size.get(s.class_id) ?? 0) + 1);
  const csOf = new Map(mine.map((m) => [m.id, m]));
  const now = nowMs();
  const open = (rows ?? []).filter((h) => Date.parse(h.due_at) >= now || h.homework_submissions.some((s) => s.status === "submitted"));
  const past = (rows ?? []).filter((h) => !open.includes(h)).reverse();
  const tab = sp.tab === "past" ? "past" : "open";
  const list = tab === "past" ? past : open;
  const pre = mine.some((m) => m.id === sp.cs) ? sp.cs! : null;

  return (
    <PortalShell school={school} schoolId={school.id} role="teacher" roleLabel="Teacher" fullName={fullName} groups={TEACHER_NAV} active="homework">
      <div className="flex flex-col gap-5">
        <PageHero title="Homework and assignments" sub={term ? termLabel(term) : undefined} actions={mine.length ? <a className="s-btn" href="#new-h">+ New</a> : undefined} />
        <Flash />
        {!term ? (
          <Empty>The school hasn&apos;t set up this term yet.</Empty>
        ) : !mine.length ? (
          <Empty>You don&apos;t have any subjects yet. The school admin gives teachers their subjects under Classes and subjects.</Empty>
        ) : (
          <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 xl:grid-cols-[1.2fr_1fr]">
            <section aria-labelledby="list-h" className="flex flex-col gap-3 rounded-[18px] border border-t-[5px] border-[#E3EAF3] border-t-c2 bg-white p-[22px]">
              <h2 id="list-h" className="sr-only">
                Homework list
              </h2>
              <nav aria-label="Homework lists" className="flex flex-wrap gap-2">
                {[
                  ["open", `Open (${open.length})`],
                  ["past", `Past (${past.length})`],
                ].map(([k, l]) => (
                  <Link key={k} href={`/teacher/homework?tab=${k}`} aria-current={tab === k ? "page" : undefined} className={`flex min-h-[44px] items-center rounded-xl border-[1.5px] px-4 text-sm font-bold ${tab === k ? "border-c1 bg-c1 text-white" : "border-[#DCE5F0] bg-white text-brand-slate"}`}>
                    {l}
                  </Link>
                ))}
              </nav>
              {list.length ? (
                <ul className="flex flex-col gap-2">
                  {list.map((h) => {
                    const cs = csOf.get(h.class_subject_id);
                    const of = size.get(cs?.class_id ?? "") ?? 0;
                    const handed = h.homework_submissions.filter((s) => s.status !== "draft").length;
                    const marked = h.homework_submissions.filter((s) => s.status === "marked").length;
                    const paper = h.submit_modes.join() === "paper";
                    return (
                      <li key={h.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-[#E3EAF3] p-3">
                        <div className="min-w-[200px] flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-brand-slate">{h.title}</span>
                            <Pill kind={h.kind === "assignment" ? "warn" : "info"}>{h.kind === "assignment" ? "Assignment" : "Homework"}</Pill>
                          </div>
                          <div className="text-xs text-[#4A5A70]">
                            {cs?.label} · Due {dayLabel(h.due_at)} · {num(h.max_marks)} marks
                          </div>
                        </div>
                        <div className="text-right text-sm">
                          <strong className="text-brand-slate">{paper ? `${marked} of ${of}` : `${handed} of ${of}`}</strong>
                          <span className="block text-xs text-[#4A5A70]">{paper ? "marked (on paper)" : `handed in · ${marked} marked`}</span>
                        </div>
                        <Link className="s-btn2" href={`/teacher/homework/${h.id}`}>
                          Mark<span className="sr-only"> {h.title}, {cs?.className}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <Empty>{tab === "open" ? "No open homework. Set some with the form." : "Nothing here yet."}</Empty>
              )}
            </section>
            <section aria-labelledby="new-h" className="flex flex-col gap-4 rounded-[18px] border border-t-[5px] border-[#E3EAF3] border-t-c1 bg-white p-[22px]">
              <h2 id="new-h" className="text-lg !text-c1">
                New homework or assignment
              </h2>
              <NewHomework classes={mine.map((m) => ({ id: m.id, label: m.label, subject: m.subject }))} parts={asParts(partsRaw)} preselect={pre} defaultDate={weekAhead()} />
            </section>
          </div>
        )}
      </div>
    </PortalShell>
  );
}
