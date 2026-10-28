import Link from "next/link";
import { AdminPage, Panel, SETUP_ROLES, classLabel, requireAdminPage } from "@/components/admin";
import { Flash } from "@/components/Flash";
import { NoteView } from "@/components/NoteView";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Empty, Pill } from "@/components/ui";
import { emailReady } from "@/lib/email";
import { loadTerms, termLabel } from "@/lib/fees";
import { NOTE_FIELDS, NOTE_STATUS, weekOfTerm, type Note } from "@/lib/lesson-notes";
import { remindNoteTeachers, reviewNote } from "./actions";

export const metadata = { title: "Lesson note review" };

type Row = Note & { class_subjects: { teacher_id: string | null; classes: { name: string; arm: string } | null; subjects: { name: string } | null } | null; profiles: { full_name: string | null } | null };
const TABS = [
  ["pending", "Waiting", ["submitted"]],
  ["returned", "Returned", ["returned"]],
  ["approved", "Approved", ["approved", "shared"]],
] as const;
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Africa/Lagos" });

export default async function LessonNotesReview(props: { searchParams: Promise<{ tab?: string; note?: string }> }) {
  const sp = await props.searchParams;
  const ctx = await requireAdminPage(SETUP_ROLES);
  const { supabase, school } = ctx;
  const { term } = await loadTerms(supabase, school.id);
  if (!term) {
    return (
      <AdminPage ctx={ctx} active="lessonnotes" crumb={[{ label: "Academics" }]} title="Lesson note review">
        <Empty>Set up the session and terms first.</Empty>
      </AdminPage>
    );
  }
  const [{ data: t }, { data: rows }, { data: cs }] = await Promise.all([
    supabase.from("terms").select("starts_on").eq("id", term.id).single<{ starts_on: string | null }>(),
    supabase.from("lesson_notes").select(`${NOTE_FIELDS}, class_subjects(teacher_id, classes(name, arm), subjects(name)), profiles:teacher_id(full_name)`).eq("school_id", school.id).eq("term_id", term.id).neq("status", "draft").order("submitted_at", { ascending: false }).returns<Row[]>(),
    supabase.from("class_subjects").select("id, teacher_id, subjects(name), classes(name, arm), profiles:teacher_id(full_name, email)").eq("school_id", school.id).not("teacher_id", "is", null).returns<{ id: string; teacher_id: string; subjects: { name: string } | null; classes: { name: string; arm: string } | null; profiles: { full_name: string | null; email: string | null } | null }[]>(),
  ]);
  const notes = rows ?? [];
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date());
  const week = weekOfTerm(t?.starts_on ?? null, today);
  const thisWeek = new Set(notes.filter((n) => n.week === week).map((n) => n.class_subject_id));
  // Teachers still to submit this week (for the count; the reminder works it out again on the server).
  const missing = (cs ?? []).filter((c) => !thisWeek.has(c.id));
  const byTeacher = new Map<string, { email: string | null; name: string; subjects: string[] }>();
  for (const c of missing) {
    const e = byTeacher.get(c.teacher_id) ?? { email: c.profiles?.email ?? null, name: c.profiles?.full_name?.trim() || "Teacher", subjects: [] };
    e.subjects.push(`${c.subjects?.name} ${classLabel(c.classes?.name ?? "", c.classes?.arm ?? "")}`);
    byTeacher.set(c.teacher_id, e);
  }
  const tab = TABS.find(([k]) => k === sp.tab) ?? TABS[0];
  const list = notes.filter((n) => (tab[2] as readonly string[]).includes(n.status));
  const sel = notes.find((n) => n.id === sp.note) ?? list[0];
  const label = (n: Row) => `${n.class_subjects?.subjects?.name ?? ""} · ${classLabel(n.class_subjects?.classes?.name ?? "", n.class_subjects?.classes?.arm ?? "")}`;

  return (
    <AdminPage
      ctx={ctx}
      active="lessonnotes"
      crumb={[{ label: "Academics" }]}
      title="Lesson note review"
      actions={
        <Link className="s-btn2" href="/admin/lesson-notes/archive">
          Open archive
        </Link>
      }
    >
      <Flash />
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-[#E3EAF3] bg-white p-4">
        <p className="text-sm text-brand-slate">
          <strong>Week {week}</strong> · {termLabel(term)} · {(cs ?? []).length - missing.length} of {(cs ?? []).length} notes submitted
          {byTeacher.size ? ` · ${byTeacher.size} teacher${byTeacher.size === 1 ? "" : "s"} not yet submitted` : ""}
        </p>
        {byTeacher.size > 0 && emailReady() && (
          <ActionForm action={remindNoteTeachers}>
            <input type="hidden" name="week" value={week} />
            <input type="hidden" name="term" value={term.id} />
            <SubmitButton pending="Sending…">
              Remind {byTeacher.size} teacher{byTeacher.size === 1 ? "" : "s"}
            </SubmitButton>
          </ActionForm>
        )}
      </div>
      <nav aria-label="Note status" className="flex flex-wrap gap-2">
        {TABS.map(([k, l, sts]) => {
          const n = notes.filter((x) => (sts as readonly string[]).includes(x.status)).length;
          return (
            <Link key={k} href={`/admin/lesson-notes?tab=${k}`} aria-current={tab[0] === k ? "page" : undefined} className={`flex min-h-[44px] items-center gap-2 rounded-xl border-[1.5px] px-4 text-sm font-bold ${tab[0] === k ? "border-c1 bg-c1 text-white" : "border-[#DCE5F0] bg-white text-brand-slate"}`}>
              {l}
              <span className={`rounded-full px-2 py-0.5 text-xs ${tab[0] === k ? "bg-white/20" : "bg-brand-cloud"}`}>{n}</span>
            </Link>
          );
        })}
      </nav>
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <nav aria-label="Lesson notes" className="flex flex-col gap-1 rounded-[18px] border border-[#E3EAF3] bg-white p-2">
          {list.length ? (
            list.map((n) => (
              <Link key={n.id} href={`/admin/lesson-notes?tab=${tab[0]}&note=${n.id}`} aria-current={sel?.id === n.id ? "page" : undefined} className={`flex flex-col rounded-xl px-3 py-2.5 ${sel?.id === n.id ? "bg-brand-cloud" : ""}`}>
                <span className="flex items-center justify-between gap-2">
                  <span className={`font-bold ${sel?.id === n.id ? "text-c1" : "text-brand-slate"}`}>{label(n)}</span>
                  <Pill kind={NOTE_STATUS[n.status][1]}>{NOTE_STATUS[n.status][0]}</Pill>
                </span>
                <span className="text-xs text-[#4A5A70]">
                  {n.profiles?.full_name ?? "Teacher"} · Week {n.week}
                  {n.submitted_at ? ` · sent ${day(n.submitted_at)}` : ""}
                </span>
              </Link>
            ))
          ) : (
            <p className="p-3 text-sm text-[#4A5A70]">Nothing here.</p>
          )}
        </nav>
        {sel ? (
          <Panel id="rv-h" title={`${label(sel)} · Week ${sel.week}`} actions={<Pill kind={NOTE_STATUS[sel.status][1]}>{NOTE_STATUS[sel.status][0]}</Pill>}>
            <p className="-mt-2 text-sm text-[#4A5A70]">{sel.profiles?.full_name ?? "Teacher"}</p>
            <NoteView note={sel} />
            {sel.status === "submitted" || sel.status === "returned" ? (
              <ActionForm action={reviewNote} key={sel.id} className="flex flex-col gap-3 rounded-xl bg-brand-cloud p-4">
                <input type="hidden" name="id" value={sel.id} />
                <div className="max-w-[200px]">
                  <label className="label" htmlFor="rv-score">
                    Score
                  </label>
                  <select id="rv-score" name="score" className="sk-input sk-select" defaultValue={sel.score ?? 8}>
                    {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((s) => (
                      <option key={s} value={s}>
                        {s} / 10
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="rv-comment">
                    Comment to the teacher
                  </label>
                  <textarea id="rv-comment" name="comment" rows={3} maxLength={1000} className="sk-input py-3" defaultValue={sel.review_comment ?? ""} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button name="decision" value="return" className="s-btn2">
                    Return for changes
                  </button>
                  <button name="decision" value="approve" className="s-btn">
                    Approve and archive
                  </button>
                </div>
              </ActionForm>
            ) : (
              <p className="rounded-xl bg-[#E7F6F2] px-4 py-3 text-sm text-[#0B6B5A]">
                Approved{sel.score ? ` · ${sel.score}/10` : ""}
                {sel.reviewed_at ? ` on ${day(sel.reviewed_at)}` : ""}
                {sel.review_comment ? ` · "${sel.review_comment}"` : ""}
                {sel.status === "shared" ? " · shared with the class" : ""}
              </p>
            )}
          </Panel>
        ) : (
          <Empty>No lesson note selected.</Empty>
        )}
      </div>
    </AdminPage>
  );
}
