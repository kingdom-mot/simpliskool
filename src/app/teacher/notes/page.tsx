import Link from "next/link";
import { PageHero, classLabel } from "@/components/admin";
import { PortalShell } from "@/components/PortalShell";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Empty, Pill } from "@/components/ui";
import { aiReady } from "@/lib/ai";
import { requireSchool } from "@/lib/auth";
import { loadTerms, termLabel } from "@/lib/fees";
import { NOTE_FIELDS, NOTE_STATUS, termWeeks, weekOfTerm, type Note } from "@/lib/lesson-notes";
import { TEACHER_NAV } from "@/lib/nav";
import { levelOrder } from "@/lib/nigeria";
import { NoteEditor } from "./NoteEditor";
import { shareNote } from "./actions";

export const metadata = { title: "Lesson notes" };

type CS = { id: string; classes: { name: string; arm: string } | null; subjects: { name: string } | null };

export default async function TeacherNotes(props: { searchParams: Promise<{ cs?: string; week?: string }> }) {
  const sp = await props.searchParams;
  const { supabase, school, user, fullName } = await requireSchool(["teacher"]);
  const [{ data: mine }, { term }] = await Promise.all([
    supabase.from("class_subjects").select("id, classes(name, arm), subjects(name)").eq("school_id", school.id).eq("teacher_id", user.id).returns<CS[]>(),
    loadTerms(supabase, school.id),
  ]);
  const list = (mine ?? []).sort((a, b) => levelOrder(a.classes?.name ?? "") - levelOrder(b.classes?.name ?? "") || (a.subjects?.name ?? "").localeCompare(b.subjects?.name ?? ""));
  const cs = list.find((c) => c.id === sp.cs) ?? list[0];
  const label = (c: CS) => `${classLabel(c.classes?.name ?? "", c.classes?.arm ?? "")} · ${c.subjects?.name ?? ""}`;

  let body: React.ReactNode;
  if (!term) body = <Empty>The school hasn&apos;t set up this term yet.</Empty>;
  else if (!cs) body = <Empty>You don&apos;t have any subjects yet. The school admin gives teachers their subjects under Classes and subjects.</Empty>;
  else {
    const { data: t } = await supabase.from("terms").select("starts_on, ends_on").eq("id", term.id).single<{ starts_on: string | null; ends_on: string | null }>();
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date());
    const nowWeek = weekOfTerm(t?.starts_on ?? null, today);
    const weeks = termWeeks(t?.starts_on ?? null, t?.ends_on ?? null);
    const { data: noteRows } = await supabase.from("lesson_notes").select(NOTE_FIELDS).eq("class_subject_id", cs.id).eq("term_id", term.id).returns<Note[]>();
    const notes = new Map((noteRows ?? []).map((n) => [n.week, n]));
    const week = Math.min(weeks, Math.max(1, Number(sp.week) || nowWeek));
    const cur = notes.get(week) ?? null;
    const st = NOTE_STATUS[cur?.status ?? "none"];
    const q = (o: Record<string, string>) => `/teacher/notes?${new URLSearchParams({ cs: cs.id, ...o })}`;

    body = (
      <>
        <form method="get" className="flex flex-wrap items-end gap-3 rounded-[18px] border border-[#E3EAF3] bg-white p-4">
          <div className="min-w-[220px] flex-1">
            <label className="label" htmlFor="ln-cs">
              Class and subject
            </label>
            <select className="sk-input sk-select" id="ln-cs" name="cs" defaultValue={cs.id}>
              {list.map((c) => (
                <option key={c.id} value={c.id}>
                  {label(c)}
                </option>
              ))}
            </select>
          </div>
          <button className="s-btn2">Open</button>
        </form>
        <ol className="flex flex-wrap items-center gap-2 text-sm font-bold text-brand-slate" aria-label="How lesson notes work">
          {["1. Write", "2. Submit to principal", "3. Approved (or returned with comments)", "4. Share with students on the day"].map((s, i) => (
            <li key={s} className="flex items-center gap-2">
              <span className="rounded-full bg-white px-3 py-1.5 shadow-sm">{s}</span>
              {i < 3 && <span aria-hidden="true">→</span>}
            </li>
          ))}
        </ol>
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
          <nav aria-label="Weeks" className="grid grid-cols-2 gap-1.5 rounded-[18px] border border-[#E3EAF3] bg-white p-2 sm:grid-cols-4 lg:grid-cols-1">
            {Array.from({ length: weeks }, (_, i) => i + 1).map((w) => {
              const n = notes.get(w);
              const [l, kind] = NOTE_STATUS[n?.status ?? (w > nowWeek ? "none" : "none")];
              const on = w === week;
              return (
                <Link key={w} href={q({ week: String(w) })} aria-current={on ? "page" : undefined} className={`flex min-h-[44px] items-center justify-between gap-2 rounded-xl px-3 text-sm ${on ? "bg-brand-cloud font-extrabold text-c1" : "font-semibold text-brand-slate"}`}>
                  Week {w}
                  {w > nowWeek && !n ? <span className="text-xs text-[#4A5A70]">Upcoming</span> : <Pill kind={kind}>{l}</Pill>}
                </Link>
              );
            })}
          </nav>
          <section aria-labelledby="note-h" className="flex flex-col gap-4 rounded-[18px] border border-t-[5px] border-[#E3EAF3] border-t-c2 bg-white p-[22px]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="note-h" className="text-lg !text-c1">
                Week {week}
                {cur ? ` · ${cur.topic}` : ""}
              </h2>
              <Pill kind={st[1]}>{st[0]}</Pill>
            </div>
            {cur?.status === "returned" && (
              <div role="status" className="rounded-xl bg-[#FEF3F2] px-4 py-3 text-sm text-[#912018]">
                <strong>Returned by the principal{cur.score ? ` · Score ${cur.score}/10` : ""}.</strong> {cur.review_comment && `"${cur.review_comment}"`}
              </div>
            )}
            {(cur?.status === "approved" || cur?.status === "shared") && (
              <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#E7F6F2] px-4 py-3 text-sm text-[#0B6B5A]">
                <span>
                  <strong>Approved by the principal{cur.score ? ` · Score ${cur.score}/10` : ""}.</strong> {cur.review_comment && `"${cur.review_comment}"`}
                  {cur.status === "shared" && " Shared with the class."}
                </span>
                {cur.status === "approved" && (
                  <ActionForm action={shareNote}>
                    <input type="hidden" name="id" value={cur.id} />
                    <SubmitButton pending="Sharing…">Share with {classLabel(cs.classes?.name ?? "", cs.classes?.arm ?? "")}</SubmitButton>
                  </ActionForm>
                )}
              </div>
            )}
            <NoteEditor key={`${cs.id}-${week}`} note={cur} csId={cs.id} termId={term.id} week={week} subject={cs.subjects?.name ?? ""} level={cs.classes?.name ?? ""} ai={aiReady()} locked={cur?.status === "approved" || cur?.status === "shared"} />
          </section>
        </div>
      </>
    );
  }

  return (
    <PortalShell school={school} schoolId={school.id} role="teacher" roleLabel="Teacher" fullName={fullName} groups={TEACHER_NAV} active="notes">
      <div className="flex flex-col gap-5">
        <PageHero sub={term ? termLabel(term) : undefined} title="Lesson notes" />
        <p className="-mt-2 text-sm text-[#4A5A70]">Write, send to the principal for approval, then share with your class on the day.</p>
        {body}
      </div>
    </PortalShell>
  );
}
