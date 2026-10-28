import { asParts, fmtScore, gradeOf, ordinal, shortSubject, type ClassResults, type ScaleRow } from "@/lib/results";

/** Class broadsheet: each subject's total out of 100, then average and position. */
export function Broadsheet({ r, scale, caption }: { r: ClassResults; scale: ScaleRow[]; caption: string }) {
  const failMark = [...scale].sort((a, b) => a.min - b.min)[0];
  const parts = asParts(r.parts);
  return (
    <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={`${caption}: scroll sideways to see more`}>
      <table className="tbl" style={{ minWidth: Math.max(640, 280 + r.subjects.length * 92) }}>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Student</th>
            {r.subjects.map((s) => (
              <th key={s.id} scope="col" className="whitespace-nowrap">
                <abbr title={s.name} className="no-underline">
                  {shortSubject(s.name)}
                </abbr>
              </th>
            ))}
            <th scope="col">Average</th>
            <th scope="col">Position</th>
          </tr>
        </thead>
        <tbody>
          {r.students.map((st) => (
            <tr key={st.id}>
              <th scope="row" className="whitespace-nowrap">
                {st.name}
              </th>
              {r.subjects.map((s) => {
                const x = st.scores[s.id];
                if (!x) return <td key={s.id} className="font-bold text-[#7A5300]">Missing</td>;
                const g = gradeOf(x.total, scale);
                const fail = g && failMark && g.grade === failMark.grade;
                return (
                  <td key={s.id} className={fail ? "font-extrabold text-[#B42318]" : ""}>
                    {fmtScore(x.total)}
                    {fail ? ` ${g!.grade}` : ""}
                    {parts.some((p) => x[p.key] === null || x[p.key] === undefined) && <span className="block text-[11px] font-semibold text-[#7A5300]">part</span>}
                  </td>
                );
              })}
              <td className="font-extrabold">{st.average === null ? "—" : fmtScore(st.average)}</td>
              <td className="font-extrabold">{ordinal(st.position)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
