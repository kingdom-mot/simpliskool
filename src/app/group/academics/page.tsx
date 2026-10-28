import Link from "next/link";
import { GroupShell } from "@/components/GroupShell";
import { Empty, Pill } from "@/components/ui";
import { currentTerms, requireGroup } from "@/lib/group";
import { levelOrder } from "@/lib/nigeria";

export const metadata = { title: "Results and standards" };

type Score = { total: number; school_id: string; class_subjects: { classes: { name: string } | null; subjects: { name: string } | null } | null };
const tone = (v: number) => (v >= 70 ? { bg: "#E7F6F2", fg: "#0B6B5A" } : v >= 60 ? { bg: "#FFF6E3", fg: "#7A5300" } : { bg: "#FEF3F2", fg: "#912018" });

export default async function GroupAcademics(props: { searchParams: Promise<{ tab?: string; subject?: string }> }) {
  const sp = await props.searchParams;
  const ctx = await requireGroup("academics");
  const tab = sp.tab === "rc" || sp.tab === "ln" ? sp.tab : "res";
  const terms = await currentTerms(ctx);
  const termIds = [...terms.values()].map((t) => t.id);
  const { admin } = ctx;
  let body: React.ReactNode = null;

  if (tab === "res") {
    const { data } = termIds.length ? await admin.from("scores").select("total, school_id, class_subjects(classes(name), subjects(name))").in("term_id", termIds).returns<Score[]>() : { data: [] as Score[] };
    const rows = data ?? [];
    const subjects = [...new Set(rows.map((r) => r.class_subjects?.subjects?.name ?? ""))].filter(Boolean).sort();
    const subject = subjects.includes(sp.subject ?? "") ? sp.subject! : null;
    const use = rows.filter((r) => !subject || r.class_subjects?.subjects?.name === subject);
    const levels = [...new Set(use.map((r) => r.class_subjects?.classes?.name ?? ""))].filter(Boolean).sort((a, b) => levelOrder(a) - levelOrder(b) || a.localeCompare(b));
    const avg = (f: (r: Score) => boolean) => {
      const xs = use.filter(f);
      return xs.length ? Math.round((xs.reduce((a, r) => a + Number(r.total), 0) / xs.length) * 10) / 10 : null;
    };
    body = (
      <>
        <form method="get" className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="tab" value="res" />
          <div className="min-w-[200px]">
            <label className="label" htmlFor="ga-subj">
              Subject
            </label>
            <select id="ga-subj" name="subject" defaultValue={subject ?? ""} className="sk-input sk-select">
              <option value="">All subjects</option>
              {subjects.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <button className="s-btn2">Show</button>
        </form>
        {levels.length ? (
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Average scores: scroll sideways to see more">
            <table className="tbl min-w-[600px]">
              <caption className="sr-only">Average total score by class level and branch, this term</caption>
              <thead>
                <tr>
                  <th scope="col">Class level</th>
                  {ctx.branches.map((b) => (
                    <th key={b.id} scope="col">
                      {b.name}
                    </th>
                  ))}
                  <th scope="col">Group average</th>
                </tr>
              </thead>
              <tbody>
                {levels.map((l) => {
                  const g = avg((r) => r.class_subjects?.classes?.name === l);
                  return (
                    <tr key={l}>
                      <th scope="row">{l}</th>
                      {ctx.branches.map((b) => {
                        const v = avg((r) => r.school_id === b.id && r.class_subjects?.classes?.name === l);
                        return (
                          <td key={b.id}>
                            {v === null ? (
                              "—"
                            ) : (
                              <span className="rounded-full px-2.5 py-1 text-sm font-extrabold" style={{ background: tone(v).bg, color: tone(v).fg }}>
                                {v.toFixed(1)}
                              </span>
                            )}
                          </td>
                        );
                      })}
                      <td className="font-bold">{g === null ? "—" : g.toFixed(1)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>No scores entered this term yet.</Empty>
        )}
        <p className="text-[13px] text-[#4A5A70]">Average total score out of 100. Green is 70 and above, amber 60 to 69, red below 60. Copy one grading scale and mark split to every branch under Shared settings so scores compare fairly.</p>
      </>
    );
  } else if (tab === "rc") {
    const stats = await Promise.all(
      ctx.branches.map(async (b) => {
        const t = terms.get(b.id);
        if (!t) return { b, classes: 0, sheets: 0, cs: 0, approved: 0, released: 0 };
        const [{ data: cls }, { count: cs }, { count: sheets }, { count: approved }, { data: rel }] = await Promise.all([
          admin.from("classes").select("id, students!inner(id)").eq("school_id", b.id).eq("students.status", "active").returns<{ id: string }[]>(),
          admin.from("class_subjects").select("id", { count: "exact", head: true }).eq("school_id", b.id),
          admin.from("score_sheets").select("class_subject_id", { count: "exact", head: true }).eq("school_id", b.id).eq("term_id", t.id).not("submitted_at", "is", null),
          admin.from("result_approvals").select("class_id", { count: "exact", head: true }).eq("term_id", t.id),
          admin.from("report_cards").select("class_id").eq("school_id", b.id).eq("term_id", t.id).not("released_at", "is", null).returns<{ class_id: string | null }[]>(),
        ]);
        return { b, classes: (cls ?? []).length, sheets: sheets ?? 0, cs: cs ?? 0, approved: approved ?? 0, released: new Set((rel ?? []).map((r) => r.class_id)).size };
      }),
    );
    body = (
      <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Report cards: scroll sideways to see more">
        <table className="tbl min-w-[700px]">
          <caption className="sr-only">Report card progress by branch, this term</caption>
          <thead>
            <tr>
              <th scope="col">Branch</th>
              <th scope="col">Score sheets handed in</th>
              <th scope="col">Principal approved</th>
              <th scope="col">Released to parents</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s) => {
              const st = s.classes && s.released >= s.classes ? { k: "good" as const, t: "Released" } : s.approved > 0 ? { k: "warn" as const, t: "Waiting to release" } : s.sheets > 0 ? { k: "warn" as const, t: "Scores coming in" } : { k: "info" as const, t: "Not started" };
              return (
                <tr key={s.b.id}>
                  <th scope="row">{s.b.name}</th>
                  <td>{s.cs ? `${Math.round((s.sheets / s.cs) * 100)}% (${s.sheets} of ${s.cs})` : "—"}</td>
                  <td>
                    {s.approved} of {s.classes} classes
                  </td>
                  <td>
                    {s.released} of {s.classes}
                  </td>
                  <td>
                    <Pill kind={st.k}>{st.t}</Pill>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  } else {
    const stats = await Promise.all(
      ctx.branches.map(async (b) => {
        const t = terms.get(b.id);
        const { data } = t ? await admin.from("lesson_notes").select("status").eq("school_id", b.id).eq("term_id", t.id).returns<{ status: string }[]>() : { data: [] as { status: string }[] };
        const n = (s: string) => (data ?? []).filter((x) => x.status === s).length;
        return { b, submitted: n("submitted"), approved: n("approved") + n("shared"), returned: n("returned"), drafts: n("draft") };
      }),
    );
    body = (
      <>
        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Lesson notes: scroll sideways to see more">
          <table className="tbl min-w-[600px]">
            <caption className="sr-only">Lesson notes this term by branch</caption>
            <thead>
              <tr>
                <th scope="col">Branch</th>
                <th scope="col">Waiting for the principal</th>
                <th scope="col">Approved</th>
                <th scope="col">Returned</th>
                <th scope="col">Drafts</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => (
                <tr key={s.b.id}>
                  <th scope="row">{s.b.name}</th>
                  <td className={s.submitted >= 5 ? "font-bold text-[#912018]" : ""}>{s.submitted}</td>
                  <td>{s.approved}</td>
                  <td>{s.returned}</td>
                  <td>{s.drafts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[13px] text-[#4A5A70]">Each principal reviews and approves their own branch&apos;s notes. You see the numbers here; the notes stay in each branch&apos;s archive for inspectors.</p>
      </>
    );
  }

  return (
    <GroupShell ctx={ctx} active="academics" title="Results and standards" sub="Compare how branches are doing this term, class level by class level.">
      <nav aria-label="Academic views" className="flex flex-wrap gap-2">
        {[
          ["res", "Results by class level"],
          ["rc", "Report cards"],
          ["ln", "Lesson notes"],
        ].map(([k, l]) => (
          <Link key={k} href={`/group/academics?tab=${k}`} aria-current={tab === k ? "page" : undefined} className={`flex min-h-[44px] items-center rounded-xl border-[1.5px] px-4 text-sm font-bold ${tab === k ? "border-c1 bg-c1 text-white" : "border-[#DCE5F0] bg-white text-brand-slate"}`}>
            {l}
          </Link>
        ))}
      </nav>
      <section aria-label="Details" className="flex flex-col gap-3 rounded-[18px] border border-t-[5px] border-[#E3EAF3] border-t-c2 bg-white p-[22px]">
        {body}
      </section>
    </GroupShell>
  );
}
