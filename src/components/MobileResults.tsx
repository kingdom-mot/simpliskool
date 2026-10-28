import Link from "next/link";
import { Bar, Pill } from "@/components/ui";
import { TERM_NAME } from "@/lib/format";
import { fmtScore, gradeKind, ordinal, type StudentResult } from "@/lib/results";

export type ReleasedTerm = { id: string; term_no: number; session: string; average: number | null };

/** Results for one student and term, phone layout (parent and student portals). */
export function MobileResults({ r, terms, termId, termHref, studentId }: { r: StudentResult | null; terms: ReleasedTerm[]; termId: string | null; termHref: (id: string) => string; studentId: string }) {
  if (!terms.length || !r || !termId) {
    return (
      <section aria-labelledby="nr-h" className="flex flex-col gap-2 rounded-[18px] border border-[#E3EAF3] bg-white p-[18px]">
        <h2 id="nr-h" className="text-base !text-c1">
          Not released yet
        </h2>
        <p className="text-sm text-brand-slate">Results appear here when the school releases report cards, usually after exams. You&apos;ll get an email when they&apos;re ready.</p>
      </section>
    );
  }
  const counts = new Map<string, number>();
  for (const s of r.subjects) if (s.grade) counts.set(s.grade, (counts.get(s.grade) ?? 0) + 1);
  const grades = r.scale.filter((g) => counts.get(g.grade)).map((g) => `${counts.get(g.grade)} ${g.grade}`);
  const progress = [...terms].reverse().filter((t) => t.session === r.term.session);
  return (
    <>
      {terms.length > 1 && (
        <nav aria-label="Term" className="flex gap-2 overflow-x-auto pb-0.5">
          {terms.map((t) => (
            <Link
              key={t.id}
              href={termHref(t.id)}
              aria-current={t.id === termId ? "true" : undefined}
              className={`flex min-h-[44px] flex-none items-center rounded-full border-[1.5px] px-4 text-sm ${t.id === termId ? "border-c1 bg-c1 font-extrabold text-white" : "border-[#DCE5F0] bg-white font-semibold text-brand-slate"}`}
            >
              {TERM_NAME[t.term_no]} {t.session}
            </Link>
          ))}
        </nav>
      )}

      <section aria-labelledby="sum-h" className="grid grid-cols-3 gap-2 rounded-[18px] bg-c1 p-[18px] text-white">
        <h2 id="sum-h" className="sr-only">
          Summary for {TERM_NAME[r.term.term_no]} {r.term.session}
        </h2>
        <div>
          <div className="text-xs font-bold text-white">Average</div>
          <div className="font-heading text-[28px] font-black leading-tight">{r.average === null ? "—" : fmtScore(r.average)}</div>
        </div>
        <div>
          <div className="text-xs font-bold text-white">Position</div>
          <div className="font-heading text-[28px] font-black leading-tight">{ordinal(r.position)}</div>
          <div className="text-xs text-white">of {r.class_size}</div>
        </div>
        <div>
          <div className="text-xs font-bold text-white">Grades</div>
          <div className="text-sm font-bold leading-snug">{grades.join(" · ") || "—"}</div>
        </div>
      </section>

      <Link className="s-btn justify-center" href={`/report/${studentId}/${termId}`}>
        Download or print report card
      </Link>

      <section aria-labelledby="subj-h" className="flex flex-col gap-3 rounded-[18px] border border-[#E3EAF3] bg-white p-[18px]">
        <h2 id="subj-h" className="text-base !text-c1">
          Subjects
        </h2>
        <ul className="flex flex-col gap-3">
          {r.subjects.map((s) => (
            <li key={s.name} className="flex flex-col gap-1.5 border-b border-[#EEF3F9] pb-3 last:border-0 last:pb-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-brand-slate">{s.name}</span>
                <span className="flex items-center gap-2">
                  <strong className="text-brand-slate">{fmtScore(s.total)}</strong>
                  {s.grade && <Pill kind={gradeKind(s.grade, r.scale)}>{s.grade}</Pill>}
                </span>
              </div>
              <Bar value={Math.min(100, Number(s.total))} fill="var(--c2,#0B7D6E)" label={`${s.name} total`} height={6} />
              <span className="text-xs text-[#4A5A70]">
                CA {fmtScore(Number(s.ca1 ?? 0) + Number(s.ca2 ?? 0))} / 40 · Exam {fmtScore(s.exam) || "—"} / 60 · {ordinal(s.position)} in class
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="com-h" className="flex flex-col gap-2 rounded-[18px] border border-[#E3EAF3] bg-white p-[18px] text-sm">
        <h2 id="com-h" className="text-base !text-c1">
          Comments
        </h2>
        <p>
          <strong>Class teacher:</strong> {r.comment || "No comment."}
        </p>
        <p>
          <strong>Principal:</strong> {r.principal_comment || "No comment."}
        </p>
        <p className="text-[#4A5A70]">Attendance: {r.days ? `${r.present} of ${r.days} days` : "not recorded"}</p>
      </section>

      {progress.length > 1 && (
        <section aria-labelledby="pr-h" className="flex flex-col gap-2 rounded-[18px] border border-[#E3EAF3] bg-white p-[18px]">
          <h2 id="pr-h" className="text-base !text-c1">
            Progress over the session
          </h2>
          <ul className="grid grid-cols-3 gap-2">
            {progress.map((t) => (
              <li key={t.id} className="rounded-xl bg-brand-cloud p-3 text-center">
                <div className="text-xs font-bold text-[#4A5A70]">{TERM_NAME[t.term_no]}</div>
                <div className="font-heading text-xl font-black text-c1">{t.average === null ? "—" : fmtScore(t.average)}</div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

