import Link from "next/link";
import { OfflineReady } from "@/components/OfflineReady";
import { PortalShell } from "@/components/PortalShell";
import { PageHero, classLabel } from "@/components/admin";
import { ScoreSheet } from "@/components/ScoreSheet";
import { Empty, Pill } from "@/components/ui";
import { requireSchool } from "@/lib/auth";
import { loadTerms, termLabel } from "@/lib/fees";
import { TEACHER_NAV } from "@/lib/nav";
import { levelOrder } from "@/lib/nigeria";
import { loadSheet } from "@/lib/score-sheet";

export const metadata = { title: "Score entry" };

type CS = { id: string; class_id: string; classes: { name: string; arm: string } | null; subjects: { name: string } | null };

export default async function TeacherScores(props: { searchParams: Promise<{ cs?: string; term?: string }> }) {
  const sp = await props.searchParams;
  const { supabase, school, user, fullName } = await requireSchool(["teacher"]);
  const [{ data: mine }, { terms, term }] = await Promise.all([
    supabase.from("class_subjects").select("id, class_id, classes(name, arm), subjects(name)").eq("school_id", school.id).eq("teacher_id", user.id).returns<CS[]>(),
    loadTerms(supabase, school.id, sp.term),
  ]);
  const list = (mine ?? []).sort(
    (a, b) => levelOrder(a.classes?.name ?? "") - levelOrder(b.classes?.name ?? "") || classLabel(a.classes?.name ?? "", a.classes?.arm ?? "").localeCompare(classLabel(b.classes?.name ?? "", b.classes?.arm ?? "")) || (a.subjects?.name ?? "").localeCompare(b.subjects?.name ?? ""),
  );
  const cs = list.find((c) => c.id === sp.cs) ?? list[0];
  const label = (c: CS) => `${classLabel(c.classes?.name ?? "", c.classes?.arm ?? "")} · ${c.subjects?.name ?? ""}`;

  let body: React.ReactNode;
  if (!term) body = <Empty>The school hasn&apos;t set up this term yet. Ask the school admin to add the session and terms.</Empty>;
  else if (!cs) body = <Empty>You don&apos;t have any subjects yet. The school admin gives teachers their subjects under Classes and subjects.</Empty>;
  else {
    const sheet = await loadSheet(supabase, school.id, cs.id, cs.class_id, term.id);
    body = (
      <>
        <form method="get" className="flex flex-wrap items-end gap-3 rounded-[18px] border border-[#E3EAF3] bg-white p-4">
          <div className="min-w-[220px] flex-1">
            <label className="label" htmlFor="s-cs">
              Class and subject
            </label>
            <select className="sk-input" id="s-cs" name="cs" defaultValue={cs.id}>
              {list.map((c) => (
                <option key={c.id} value={c.id}>
                  {label(c)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="s-term">
              Term
            </label>
            <select className="sk-input" id="s-term" name="term" defaultValue={term.id}>
              {terms.map((t) => (
                <option key={t.id} value={t.id}>
                  {termLabel(t)}
                  {t.is_current ? " (current)" : ""}
                </option>
              ))}
            </select>
          </div>
          <button className="s-btn2">Open</button>
        </form>
        <section aria-labelledby="sheet-h" className="flex flex-col gap-3 rounded-[18px] border border-[#E3EAF3] bg-white p-[22px]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="sheet-h" className="text-lg !text-c1">
              {label(cs)} scores
            </h2>
            {sheet.submittedAt ? <Pill kind="good">Submitted</Pill> : <Pill kind="warn">Not submitted</Pill>}
          </div>
          {sheet.students.length ? (
            <ScoreSheet key={`${cs.id}-${term.id}`} csId={cs.id} termId={term.id} title={`${label(cs)} scores, ${termLabel(term)}`} students={sheet.students} parts={sheet.parts} scale={sheet.scale} submittedAt={sheet.submittedAt} />
          ) : (
            <Empty>No students in this class yet.</Empty>
          )}
        </section>
      </>
    );
  }

  return (
    <PortalShell school={school} schoolId={school.id} role="teacher" roleLabel="Teacher" fullName={fullName} groups={TEACHER_NAV} active="scores">
      <OfflineReady />
      <div className="flex flex-col gap-5">
        <PageHero sub={term ? termLabel(term) : undefined} title="Score entry" />
        {body}
        <p className="text-sm text-[#4A5A70]">
          Once the school releases a student&apos;s report card, their scores are locked. Scores you type without internet are kept on this device and sent when you&apos;re back online.{" "}
          <Link className="s-link" href="/teacher/broadsheet">
            Class broadsheet and comments
          </Link>
        </p>
      </div>
    </PortalShell>
  );
}
