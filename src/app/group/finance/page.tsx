import Link from "next/link";
import { GroupShell } from "@/components/GroupShell";
import { Bar, Empty, Pill } from "@/components/ui";
import { METHOD_LABEL } from "@/lib/fees";
import { naira, pct } from "@/lib/format";
import { requireGroup } from "@/lib/group";
import { groupMoney } from "@/lib/group-finance";
import { branchStats } from "@/lib/group-stats";

export const metadata = { title: "Fees and payouts" };

const TARGET = 70;
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Africa/Lagos" });

export default async function GroupFinance(props: { searchParams: Promise<{ tab?: string; branch?: string }> }) {
  const sp = await props.searchParams;
  const ctx = await requireGroup("finance");
  const branch = ctx.ids.includes(sp.branch ?? "") ? sp.branch! : null;
  const tab = sp.tab === "debt" || sp.tab === "pay" ? sp.tab : "sum";
  const stats = (await branchStats(ctx)).filter((b) => !branch || b.id === branch);
  const { debtors, payments } = tab === "sum" ? { debtors: [], payments: [] } : await groupMoney(ctx, branch ? [branch] : ctx.ids);
  const billed = stats.reduce((a, b) => a + b.billed, 0);
  const collected = stats.reduce((a, b) => a + b.collected, 0);
  const owing = stats.reduce((a, b) => a + b.owing, 0);
  const q = (o: Record<string, string>) => `/group/finance?${new URLSearchParams({ tab, ...(branch ? { branch } : {}), ...o })}`;

  return (
    <GroupShell ctx={ctx} active="finance" title="Fees and payouts" sub="Parents pay each branch; every payment goes to that branch's payout account." actions={<a className="s-btn2" href={`/group/finance/export${branch ? `?branch=${branch}` : ""}`} download>Export to Excel (CSV)</a>}>
      <form method="get" className="flex flex-wrap items-end gap-3 rounded-[18px] border border-[#E3EAF3] bg-white p-4">
        <input type="hidden" name="tab" value={tab} />
        <div className="min-w-[200px]">
          <label className="label" htmlFor="gf-branch">
            Branch
          </label>
          <select id="gf-branch" name="branch" defaultValue={branch ?? ""} className="sk-input sk-select">
            <option value="">All branches</option>
            {ctx.branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <button className="s-btn2">Show</button>
      </form>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-3">
        {[
          ["Billed this term", naira(billed), ""],
          ["Collected", naira(collected), `${pct(collected, billed)}%`],
          ["Outstanding", naira(billed - collected), `from ${owing} student${owing === 1 ? "" : "s"}`],
        ].map(([l, v, s]) => (
          <div key={l} className="flex flex-col gap-1 rounded-[18px] border border-[#E3EAF3] bg-white p-4">
            <span className="text-xs font-bold uppercase tracking-[0.05em] text-[#4A5A70]">{l}</span>
            <span className="font-heading text-2xl font-black text-c1">{v}</span>
            {s && <span className="text-sm text-[#4A5A70]">{s}</span>}
          </div>
        ))}
      </div>
      <nav aria-label="Finance views" className="flex flex-wrap gap-2">
        {[
          ["sum", "By branch"],
          ["debt", "Who owes"],
          ["pay", "Latest payments"],
        ].map(([k, l]) => (
          <Link key={k} href={q({ tab: k })} aria-current={tab === k ? "page" : undefined} className={`flex min-h-[44px] items-center rounded-xl border-[1.5px] px-4 text-sm font-bold ${tab === k ? "border-c1 bg-c1 text-white" : "border-[#DCE5F0] bg-white text-brand-slate"}`}>
            {l}
          </Link>
        ))}
      </nav>
      <section aria-label="Details" className="flex flex-col gap-3 rounded-[18px] border border-t-[5px] border-[#E3EAF3] border-t-c2 bg-white p-[22px]">
        {tab === "sum" && (
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Fees by branch: scroll sideways to see more">
            <table className="tbl min-w-[760px]">
              <caption className="sr-only">Fees by branch this term</caption>
              <thead>
                <tr>
                  <th scope="col">Branch</th>
                  <th scope="col">Billed</th>
                  <th scope="col">Collected</th>
                  <th scope="col">Outstanding</th>
                  <th scope="col">Progress vs {TARGET}% target</th>
                  <th scope="col">Students owing</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((b) => {
                  const p = pct(b.collected, b.billed);
                  return (
                    <tr key={b.id}>
                      <th scope="row">
                        {b.name}
                        <span className="block text-xs font-normal text-[#4A5A70]">{b.term ?? "No current term"}</span>
                      </th>
                      <td>{naira(b.billed)}</td>
                      <td>{naira(b.collected)}</td>
                      <td>{naira(b.billed - b.collected)}</td>
                      <td className="min-w-[200px]">
                        <div className="flex items-center gap-2">
                          <Bar value={p} fill={p >= TARGET ? "#0B7D6E" : p >= TARGET - 10 ? "#B7791F" : "#B42318"} label={`${b.name}: ${p}% collected`} height={6} />
                          <Pill kind={!b.billed ? "info" : p >= TARGET ? "good" : p >= TARGET - 10 ? "warn" : "bad"}>{!b.billed ? "Not billed" : `${p}%`}</Pill>
                        </div>
                      </td>
                      <td>{b.owing}</td>
                    </tr>
                  );
                })}
                <tr>
                  <th scope="row">All branches</th>
                  <td className="font-bold">{naira(billed)}</td>
                  <td className="font-bold">{naira(collected)}</td>
                  <td className="font-bold">{naira(billed - collected)}</td>
                  <td className="font-bold">{pct(collected, billed)}%</td>
                  <td className="font-bold">{owing}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
        {tab === "debt" &&
          (debtors.length ? (
            <>
              <p className="text-sm text-brand-slate">Largest balances this term. Reminders go out from each branch&apos;s Payments page, under the branch&apos;s name.</p>
              <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Largest balances: scroll sideways to see more">
                <table className="tbl min-w-[640px]">
                  <caption className="sr-only">Largest outstanding balances</caption>
                  <thead>
                    <tr>
                      <th scope="col">Student</th>
                      <th scope="col">Branch</th>
                      <th scope="col">Class</th>
                      <th scope="col">Owing</th>
                      <th scope="col">Last paid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {debtors.slice(0, 50).map((d, i) => (
                      <tr key={i}>
                        <th scope="row">{d.name}</th>
                        <td>{d.branch}</td>
                        <td>{d.cls}</td>
                        <td className="font-bold text-[#912018]">{naira(d.owing)}</td>
                        <td>{d.lastPaid ? day(d.lastPaid) : "Never this term"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <Empty>No one owes this term.</Empty>
          ))}
        {tab === "pay" &&
          (payments.length ? (
            <ul className="flex flex-col">
              {payments.map((p, i) => (
                <li key={i} className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EEF3F9] py-2 text-sm last:border-0">
                  <span>
                    <strong className="text-brand-slate">{naira(p.amount)}</strong> · {p.name} · {p.branch}
                  </span>
                  <span className="text-[#4A5A70]">
                    {METHOD_LABEL[p.method] ?? p.method} · {day(p.at)} · {p.receipt}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No payments yet.</Empty>
          ))}
      </section>
      <p className="text-[13px] text-[#4A5A70]">Online payments go straight into each branch&apos;s payout account (set by the owner in that branch&apos;s Settings), usually the next working day.</p>
    </GroupShell>
  );
}
