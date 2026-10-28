import Link from "next/link";
import { ReportCard } from "@/components/ReportCard";
import { Panel } from "@/components/admin";
import { Empty, Pill } from "@/components/ui";
import { METHOD_LABEL, loadTerms, termLabel } from "@/lib/fees";
import { naira, pct } from "@/lib/format";
import type { StudentResult } from "@/lib/results";

type DB = Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>;
const TZ = "Africa/Lagos";
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: TZ });

/** Results, attendance, fees and report cards for one student (admin profile tabs). */
export async function ProfileTab({ tab, db, schoolId, studentId, firstName, termWanted, canRecord }: { tab: string; db: DB; schoolId: string; studentId: string; firstName: string; termWanted?: string; canRecord: boolean }) {
  const { terms, term } = await loadTerms(db, schoolId, termWanted);

  if (tab === "results") {
    if (!term) return <Empty>No terms set up yet.</Empty>;
    const { data } = await db.rpc("student_result", { p_student: studentId, p_term: term.id });
    const r = data as StudentResult | null;
    return (
      <Panel id="res-h" title={`Results · ${termLabel(term)}`}>
        <form method="get" className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="tab" value="results" />
          <div>
            <label className="label" htmlFor="pr-term">
              Term
            </label>
            <select id="pr-term" name="term" className="sk-input sk-select py-2" defaultValue={term.id}>
              {terms.map((t) => (
                <option key={t.id} value={t.id}>
                  {termLabel(t)}
                </option>
              ))}
            </select>
          </div>
          <button className="s-btn2">Show</button>
        </form>
        {r && r.subjects.length ? <ReportCard r={r} /> : <Empty>No scores for {firstName} this term yet.</Empty>}
      </Panel>
    );
  }

  if (tab === "attendance") {
    if (!term) return <Empty>No terms set up yet.</Empty>;
    const { data: t } = await db.from("terms").select("starts_on, ends_on").eq("id", term.id).single<{ starts_on: string | null; ends_on: string | null }>();
    let q = db.from("attendance").select("date, status").eq("student_id", studentId).order("date");
    if (t?.starts_on) q = q.gte("date", t.starts_on);
    if (t?.ends_on) q = q.lte("date", t.ends_on);
    const { data: rows } = await q.returns<{ date: string; status: "present" | "absent" | "late" }[]>();
    const list = rows ?? [];
    const n = (s: string) => list.filter((x) => x.status === s).length;
    const COLOR = { present: "var(--c2,#0B7D6E)", late: "#F4B740", absent: "#B42318" };
    const LABEL = { present: "Present", late: "Late", absent: "Absent" };
    return (
      <Panel id="att-h" title={`${termLabel(term)} attendance`}>
        <div className="flex flex-wrap gap-2">
          <Pill kind="good">Present {n("present")} days</Pill>
          <Pill kind="bad">Absent {n("absent")} day{n("absent") === 1 ? "" : "s"}</Pill>
          <Pill kind="warn">Late {n("late")} day{n("late") === 1 ? "" : "s"}</Pill>
          {list.length > 0 && <Pill kind="info">{pct(n("present") + n("late"), list.length)}% attendance</Pill>}
        </div>
        {list.length ? (
          <>
            <ul className="flex flex-wrap gap-1.5" aria-label="Day by day">
              {list.map((x) => (
                <li key={x.date} title={`${day(x.date)}: ${LABEL[x.status]}`} className="flex h-9 w-9 items-center justify-center rounded-lg text-[11px] font-bold text-white" style={{ background: COLOR[x.status], color: x.status === "late" ? "#1B2433" : "#fff" }}>
                  <span aria-hidden="true">{new Date(`${x.date}T12:00:00Z`).getUTCDate()}</span>
                  <span className="sr-only">
                    {day(x.date)}: {LABEL[x.status]}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-[13px] text-[#4A5A70]">Teal is present, amber is late, red is absent. Hover or tap a day for the date.</p>
          </>
        ) : (
          <Empty>No registers recorded for {firstName} this term.</Empty>
        )}
      </Panel>
    );
  }

  if (tab === "fees") {
    const { data: invs } = await db
      .from("invoices")
      .select("id, term_id, total_kobo, paid_kobo, balance_kobo, invoice_lines(name, amount_kobo, position), payments(id, amount_kobo, method, receipt_no, paid_at, created_at, status)")
      .eq("student_id", studentId)
      .returns<{ id: string; term_id: string; total_kobo: number; paid_kobo: number; balance_kobo: number; invoice_lines: { name: string; amount_kobo: number; position: number }[]; payments: { id: string; amount_kobo: number; method: string; receipt_no: string | null; paid_at: string | null; created_at: string; status: string }[] }[]>();
    const byTerm = new Map(terms.map((t) => [t.id, t]));
    const list = (invs ?? []).sort((a, b) => terms.findIndex((t) => t.id === a.term_id) - terms.findIndex((t) => t.id === b.term_id));
    if (!list.length) return <Empty>No invoices for {firstName} yet.</Empty>;
    return (
      <div className="flex flex-col gap-4">
        {list.map((inv) => {
          const t = byTerm.get(inv.term_id);
          const paid = inv.payments.filter((p) => p.status === "success");
          return (
            <Panel key={inv.id} id={`fee-${inv.id.slice(0, 8)}`} title={`${t ? termLabel(t) : "Term"} invoice · ${naira(inv.total_kobo)}`} actions={inv.balance_kobo > 0 ? <Pill kind="bad">Owes {naira(inv.balance_kobo)}</Pill> : <Pill kind="good">Paid in full</Pill>}>
              <ul className="flex flex-wrap gap-2 text-sm">
                {[...inv.invoice_lines].sort((a, b) => a.position - b.position).map((l, i) => (
                  <li key={i} className="rounded-lg bg-brand-cloud px-2.5 py-1">
                    {l.name} {naira(l.amount_kobo)}
                  </li>
                ))}
              </ul>
              {paid.length ? (
                <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Payments: scroll sideways to see more">
                  <table className="tbl min-w-[520px]">
                    <caption className="sr-only">Payments</caption>
                    <thead>
                      <tr>
                        <th scope="col">Date</th>
                        <th scope="col">Receipt</th>
                        <th scope="col">Method</th>
                        <th scope="col">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paid.map((p) => (
                        <tr key={p.id}>
                          <td>{day(p.paid_at ?? p.created_at)}</td>
                          <td>
                            <Link className="s-link" href={`/receipt/${p.id}`}>
                              {p.receipt_no}
                            </Link>
                          </td>
                          <td>{METHOD_LABEL[p.method] ?? p.method}</td>
                          <td className="font-bold">{naira(p.amount_kobo)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-[#4A5A70]">No payments yet.</p>
              )}
              {canRecord && inv.balance_kobo > 0 && (
                <Link className="s-btn2 self-start" href={`/admin/payments?term=${inv.term_id}&invoice=${inv.id}#record`}>
                  Record payment
                </Link>
              )}
            </Panel>
          );
        })}
      </div>
    );
  }

  // Report cards
  const { data: cards } = await db.from("report_cards").select("term_id, released_at").eq("student_id", studentId).not("released_at", "is", null).returns<{ term_id: string; released_at: string }[]>();
  const released = terms.filter((t) => (cards ?? []).some((c) => c.term_id === t.id));
  return (
    <Panel id="rc-h" title="Report cards">
      {released.length ? (
        <ul className="flex flex-col gap-2">
          {released.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#E3EAF3] p-3">
              <span className="font-bold text-brand-slate">{termLabel(t)}</span>
              <Link className="s-btn2" href={`/report/${studentId}/${t.id}`}>
                View or print<span className="sr-only"> {termLabel(t)} report card</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>No report cards released for {firstName} yet.</Empty>
      )}
    </Panel>
  );
}
