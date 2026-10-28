import { Pill } from "@/components/ui";
import { TERM_NAME } from "@/lib/format";
import { fmtScore, gradeKind, ordinal, RATINGS, type StudentResult } from "@/lib/results";
import { initials, schoolThemeStyle } from "@/lib/theme";

/** The printable report card. Uses the school's colours and logo. */
export function ReportCard({ r }: { r: StudentResult }) {
  const term = `${TERM_NAME[r.term.term_no]} Report · ${r.term.session} session`;
  const ratings = r.ratings ?? {};
  return (
    <article style={schoolThemeStyle(r.school.primary_color, r.school.secondary_color)} className="print-area flex flex-col gap-4 rounded-[18px] border border-[#E3EAF3] bg-white p-6 text-brand-slate">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b-4 border-c1 pb-4">
        <div className="flex items-center gap-3">
          {r.school.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={r.school.logo_url} alt="" width={60} height={60} className="h-[60px] w-[60px] rounded-xl object-contain" />
          ) : (
            <span aria-hidden="true" className="flex h-[60px] w-[60px] items-center justify-center rounded-xl bg-c1 text-xl font-extrabold text-white">
              {initials(r.school.name)}
            </span>
          )}
          <div>
            <h2 className="font-heading text-xl font-extrabold !text-c1">{r.school.name}</h2>
            <div className="text-xs text-[#4A5A70]">{[r.school.address, r.school.phone, r.school.email].filter(Boolean).join(" · ")}</div>
            <div className="text-sm font-bold">{term}</div>
          </div>
        </div>
        {!r.released_at && <Pill kind="warn">Preview: not released</Pill>}
      </header>

      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        {[
          ["Name", r.student.name],
          ["Admission no.", r.student.admission_no],
          ["Class", r.student.class],
          ["Position", r.position ? `${ordinal(r.position)} of ${r.class_size}` : "—"],
          ["Average", r.average === null ? "—" : fmtScore(r.average)],
          ["Attendance", r.days ? `${r.present} of ${r.days} days` : "Not recorded"],
        ].map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs font-bold uppercase tracking-[0.05em] text-[#4A5A70]">{k}</dt>
            <dd className="font-bold">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Subjects table: scroll sideways to see more">
        <table className="tbl min-w-[620px]">
          <caption className="sr-only">Scores for each subject</caption>
          <thead>
            <tr>
              <th scope="col">Subject</th>
              <th scope="col">CA 1 (20)</th>
              <th scope="col">CA 2 (20)</th>
              <th scope="col">Exam (60)</th>
              <th scope="col">Total</th>
              <th scope="col">Grade</th>
              <th scope="col">Position</th>
              <th scope="col">Remark</th>
            </tr>
          </thead>
          <tbody>
            {r.subjects.map((s) => (
              <tr key={s.name}>
                <th scope="row">{s.name}</th>
                <td>{fmtScore(s.ca1) || "—"}</td>
                <td>{fmtScore(s.ca2) || "—"}</td>
                <td>{fmtScore(s.exam) || "—"}</td>
                <td className="font-extrabold">{fmtScore(s.total)}</td>
                <td>{s.grade ? <Pill kind={gradeKind(s.grade, r.scale)}>{s.grade}</Pill> : "—"}</td>
                <td>{ordinal(s.position)}</td>
                <td>{s.remark ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {Object.keys(ratings).length > 0 && (
        <section aria-labelledby="rt-h" className="flex flex-col gap-2">
          <h3 id="rt-h" className="text-sm font-extrabold !text-c1">
            Behaviour and skills (1 = poor, 5 = excellent)
          </h3>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
            {RATINGS.filter((k) => ratings[k]).map((k) => (
              <div key={k} className="flex justify-between border-b border-[#EEF3F9] py-1">
                <dt>{k}</dt>
                <dd className="font-bold">{ratings[k]}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-brand-cloud p-3 text-sm">
          <div className="text-xs font-bold uppercase tracking-[0.05em] text-[#4A5A70]">Class teacher{r.class_teacher ? ` · ${r.class_teacher}` : ""}</div>
          <p className="mt-1">{r.comment || "No comment yet."}</p>
        </div>
        <div className="rounded-xl bg-brand-cloud p-3 text-sm">
          <div className="text-xs font-bold uppercase tracking-[0.05em] text-[#4A5A70]">Principal</div>
          <p className="mt-1">{r.principal_comment || "No comment yet."}</p>
        </div>
      </div>

      <footer className="flex flex-wrap gap-x-3 gap-y-1 border-t border-[#E3EAF3] pt-3 text-xs text-[#4A5A70]">
        <span className="font-bold">Grades:</span>
        {r.scale.map((g) => (
          <span key={g.grade}>
            {g.grade} {fmtScore(g.min)}–{Math.floor(g.max)} {g.remark ? `(${g.remark})` : ""}
          </span>
        ))}
      </footer>
    </article>
  );
}
