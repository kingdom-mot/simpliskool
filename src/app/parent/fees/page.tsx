import Link from "next/link";
import { MobileShell } from "@/components/MobileShell";
import { classLabel } from "@/components/admin";
import { Bar, Empty, Pill } from "@/components/ui";
import { requireSchool } from "@/lib/auth";
import { METHOD_LABEL } from "@/lib/fees";
import { naira, pct, TERM_NAME } from "@/lib/format";
import { PARENT_TABS } from "@/lib/nav";

export const metadata = { title: "Fees" };

type Invoice = {
  id: string;
  term_id: string;
  total_kobo: number;
  paid_kobo: number;
  balance_kobo: number;
  terms: { term_no: number; is_current: boolean; academic_sessions: { name: string } | null } | null;
  invoice_lines: { name: string; amount_kobo: number; position: number }[];
  payments: { id: string; amount_kobo: number; method: string; receipt_no: string | null; paid_at: string | null; created_at: string; status: string }[];
};
type Kid = { id: string; first_name: string; last_name: string; classes: { name: string; arm: string } | null; invoices: Invoice[] };

const TZ = "Africa/Lagos";
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: TZ });
const termName = (i: Invoice) => (i.terms ? `${TERM_NAME[i.terms.term_no]} ${i.terms.academic_sessions?.name ?? ""}`.trim() : "Fees");
const termKey = (i: Invoice) => `${i.terms?.academic_sessions?.name ?? ""}-${i.terms?.term_no ?? 0}`;

export default async function ParentFees(props: { searchParams: Promise<{ child?: string }> }) {
  const sp = await props.searchParams;
  const { supabase, school, user } = await requireSchool(["parent"]);
  const [{ data: rows }, { data: s }] = await Promise.all([
    supabase
      .from("guardians")
      .select("students(id, first_name, last_name, classes(name, arm), invoices(id, term_id, total_kobo, paid_kobo, balance_kobo, terms(term_no, is_current, academic_sessions(name)), invoice_lines(name, amount_kobo, position), payments(id, amount_kobo, method, receipt_no, paid_at, created_at, status)))")
      .eq("school_id", school.id)
      .eq("user_id", user.id)
      .returns<{ students: Kid | null }[]>(),
    supabase.from("schools").select("payment_instructions, phone, email").eq("id", school.id).maybeSingle<{ payment_instructions: string | null; phone: string | null; email: string | null }>(),
  ]);
  const kids = (rows ?? []).map((r) => r.students).filter((k): k is Kid => !!k).sort((a, b) => a.first_name.localeCompare(b.first_name));
  const kid = kids.find((k) => k.id === sp.child) ?? null;
  const shown = kid ? [kid] : kids;
  const all = shown.flatMap((k) => k.invoices.map((i) => ({ k, i })));
  const current = all.filter(({ i }) => i.terms?.is_current);
  const curTermIds = [...new Set(current.map(({ i }) => i.term_id))];
  const { data: dues } = curTermIds.length ? await supabase.from("fee_terms").select("term_id, due_on, allow_part").in("term_id", curTermIds) : { data: [] };
  const due = (dues ?? [])[0] as { due_on: string | null; allow_part: boolean } | undefined;
  const curKey = current[0] ? termKey(current[0].i) : null;
  const left = current.reduce((a, { i }) => a + Math.max(i.balance_kobo, 0), 0);
  const earlier = all.filter(({ i }) => !i.terms?.is_current && i.balance_kobo > 0 && (!curKey || termKey(i) < curKey));
  const earlierOwed = earlier.reduce((a, { i }) => a + i.balance_kobo, 0);
  const payments = all
    .flatMap(({ k, i }) => i.payments.filter((p) => p.status === "success").map((p) => ({ p, k, i })))
    .sort((a, b) => (b.p.paid_at ?? b.p.created_at).localeCompare(a.p.paid_at ?? a.p.created_at));
  const contact = [s?.phone, s?.email].filter(Boolean).join(" or ");
  const overdue = due?.due_on && left > 0 && due.due_on < new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());

  return (
    <MobileShell school={school} title="Fees" tabs={PARENT_TABS} active="fees">
      {kids.length === 0 ? (
        <Empty>No children are linked to your account yet. Please contact the school.</Empty>
      ) : (
        <>
          {kids.length > 1 && (
            <div role="group" aria-label="Choose a child" className="flex gap-2 overflow-x-auto pb-0.5">
              {[{ id: "", first_name: "All children" }, ...kids].map((k) => {
                const on = (kid?.id ?? "") === k.id;
                return (
                  <Link
                    key={k.id || "all"}
                    href={k.id ? `/parent/fees?child=${k.id}` : "/parent/fees"}
                    aria-current={on ? "true" : undefined}
                    className={`flex min-h-[44px] flex-none items-center rounded-full border-[1.5px] px-4 text-sm ${on ? "border-c1 bg-c1 font-extrabold text-white" : "border-[#DCE5F0] bg-white font-semibold text-brand-slate"}`}
                  >
                    {k.first_name}
                  </Link>
                );
              })}
            </div>
          )}

          <section aria-labelledby="left-h" className="flex flex-col gap-2 rounded-[18px] bg-c1 p-[18px] text-white">
            <h2 id="left-h" className="text-sm font-bold !text-white">
              {current.length ? `Total left to pay for ${termName(current[0].i)}` : "This term"}
            </h2>
            {current.length ? (
              <>
                <div className="font-heading text-[34px] font-black leading-none">{naira(left)}</div>
                <p className="text-sm text-white">
                  {left <= 0 ? "All paid. Thank you!" : [due?.due_on ? `${overdue ? "Was due" : "Due"} ${day(due.due_on)}` : null, due?.allow_part === false ? "please pay in full" : "part payments are fine"].filter(Boolean).join(" · ")}
                </p>
                {earlierOwed > 0 && <p className="text-sm font-bold text-white">Plus {naira(earlierOwed)} from earlier terms.</p>}
              </>
            ) : (
              <p className="text-sm text-white">The school hasn&apos;t sent this term&apos;s fees yet.</p>
            )}
          </section>

          {(left > 0 || earlierOwed > 0) && (
            <section aria-labelledby="how-h" className="flex flex-col gap-2 rounded-[18px] border border-[#E3EAF3] bg-white p-[18px]">
              <h2 id="how-h" className="text-base !text-c1">
                How to pay
              </h2>
              {s?.payment_instructions ? <p className="whitespace-pre-line text-sm text-brand-slate">{s.payment_instructions}</p> : <p className="text-sm text-brand-slate">Pay the school directly{contact ? ` (contact ${contact})` : ""}.</p>}
              <p className="text-[13px] text-[#4A5A70]">The school records your payment and you get a receipt here{contact ? "" : ""}. Paying online with a card is coming soon.</p>
            </section>
          )}

          {current.map(({ k, i }) => {
            const p = pct(i.paid_kobo, i.total_kobo);
            return (
              <section key={i.id} aria-labelledby={`k-${i.id}`} className="flex flex-col gap-3 rounded-[18px] border border-[#E3EAF3] bg-white p-[18px]">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 id={`k-${i.id}`} className="text-base !text-c1">
                      {k.first_name} {k.last_name}
                      {k.classes ? ` · ${classLabel(k.classes.name, k.classes.arm)}` : ""}
                    </h2>
                    <p className="text-sm text-[#4A5A70]">
                      {naira(i.paid_kobo)} of {naira(i.total_kobo)} paid
                    </p>
                  </div>
                  {i.balance_kobo <= 0 ? <Pill kind="good">Paid</Pill> : <Pill kind={i.paid_kobo > 0 ? "warn" : "bad"}>{i.paid_kobo > 0 ? "Part paid" : "Unpaid"}</Pill>}
                </div>
                <Bar value={p} fill="var(--c2,#0B7D6E)" label={`${k.first_name}'s fees paid`} />
                <table className="tbl">
                  <caption className="sr-only">
                    {k.first_name}&apos;s bill for {termName(i)}
                  </caption>
                  <tbody>
                    {[...i.invoice_lines]
                      .sort((a, b) => a.position - b.position)
                      .map((l, n) => (
                        <tr key={n}>
                          <th scope="row" className="font-normal">
                            {l.name}
                          </th>
                          <td className="text-right">{naira(l.amount_kobo)}</td>
                        </tr>
                      ))}
                    <tr>
                      <th scope="row">Balance</th>
                      <td className="text-right font-extrabold">{i.balance_kobo > 0 ? naira(i.balance_kobo) : i.balance_kobo < 0 ? `${naira(-i.balance_kobo)} credit` : "₦0"}</td>
                    </tr>
                  </tbody>
                </table>
              </section>
            );
          })}

          {earlier.length > 0 && (
            <section aria-labelledby="old-h" className="flex flex-col gap-2 rounded-[18px] border border-[#E3EAF3] bg-white p-[18px]">
              <h2 id="old-h" className="text-base !text-c1">
                Still owed from earlier terms
              </h2>
              <ul className="flex flex-col">
                {earlier.map(({ k, i }) => (
                  <li key={i.id} className="flex min-h-[44px] items-center justify-between gap-2 border-b border-[#EEF3F9] text-sm last:border-0">
                    <span>
                      {k.first_name} · {termName(i)}
                    </span>
                    <strong className="text-[#912018]">{naira(i.balance_kobo)}</strong>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="pay-h" className="flex flex-col gap-2 rounded-[18px] border border-[#E3EAF3] bg-white p-[18px]">
            <h2 id="pay-h" className="text-base !text-c1">
              Payments made
            </h2>
            {payments.length ? (
              <ul className="flex flex-col">
                {payments.map(({ p, k, i }) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 border-b border-[#EEF3F9] py-2.5 last:border-0">
                    <div className="min-w-0">
                      <div className="font-heading text-lg font-extrabold text-brand-slate">{naira(p.amount_kobo)}</div>
                      <div className="text-[13px] text-[#4A5A70]">
                        {k.first_name} · {termName(i)} · {METHOD_LABEL[p.method] ?? p.method} · {day(p.paid_at ?? p.created_at)}
                      </div>
                    </div>
                    <Link className="s-btn2 flex-none" href={`/receipt/${p.id}`}>
                      Receipt<span className="sr-only"> {p.receipt_no}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[#4A5A70]">No payments recorded yet.</p>
            )}
          </section>
        </>
      )}
    </MobileShell>
  );
}
