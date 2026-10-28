import { Flash } from "@/components/Flash";
import { GroupShell } from "@/components/GroupShell";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Pill } from "@/components/ui";
import { naira } from "@/lib/format";
import { lagosToday, requireGroup } from "@/lib/group";
import { approveBranchPayroll } from "../actions";

export const metadata = { title: "Group payroll" };

type Run = { id: string; school_id: string; status: string; created_at: string; approved_at: string | null; paid_at: string | null; payslips: { gross_kobo: number; net_kobo: number; pension_kobo: number; paye_kobo: number }[] };

export default async function GroupPayroll(props: { searchParams: Promise<{ month?: string }> }) {
  const sp = await props.searchParams;
  const ctx = await requireGroup("payroll");
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : lagosToday().slice(0, 7);
  const { data } = ctx.ids.length
    ? await ctx.admin.from("payroll_runs").select("id, school_id, status, created_at, approved_at, paid_at, payslips(gross_kobo, net_kobo, pension_kobo, paye_kobo)").in("school_id", ctx.ids).eq("month", `${month}-01`).returns<Run[]>()
    : { data: [] as Run[] };
  const runs = new Map((data ?? []).map((r) => [r.school_id, r]));
  const sum = (r: Run | undefined, k: keyof Run["payslips"][number]) => (r ? r.payslips.reduce((a, p) => a + Number(p[k]), 0) : 0);
  const ready = (data ?? []).filter((r) => r.status === "draft" && r.payslips.length);
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(`${lagosToday().slice(0, 7)}-15T12:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() - i);
    return d.toISOString().slice(0, 7);
  });
  const label = (m: string) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  const all = (k: keyof Run["payslips"][number]) => (data ?? []).reduce((a, r) => a + sum(r, k), 0);
  const staff = (data ?? []).reduce((a, r) => a + r.payslips.length, 0);

  return (
    <GroupShell ctx={ctx} active="payroll" title={`Payroll · ${label(month)}`} sub="Each branch bursar prepares their run. The proprietor approves, then staff are paid.">
      <form method="get" className="flex flex-wrap items-end gap-3 rounded-[18px] border border-[#E3EAF3] bg-white p-4">
        <div>
          <label className="label" htmlFor="gp-month">
            Month
          </label>
          <select id="gp-month" name="month" defaultValue={month} className="sk-input sk-select">
            {months.map((m) => (
              <option key={m} value={m}>
                {label(m)}
              </option>
            ))}
          </select>
        </div>
        <button className="s-btn2">Show</button>
      </form>
      <Flash />
      <p className="text-sm text-[#4A5A70]">Only the proprietor and group finance can see this page. Principals and branch admins can&apos;t.</p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Staff paid", String(staff)],
          ["Gross pay", naira(all("gross_kobo"))],
          ["Pension and PAYE", naira(all("pension_kobo") + all("paye_kobo"))],
          ["Net pay", naira(all("net_kobo"))],
        ].map(([l, v]) => (
          <div key={l} className="flex flex-col gap-1 rounded-[18px] border border-[#E3EAF3] bg-white p-4">
            <span className="text-xs font-bold uppercase tracking-[0.05em] text-[#4A5A70]">{l}</span>
            <span className="font-heading text-2xl font-black text-c1">{v}</span>
          </div>
        ))}
      </div>
      <section aria-labelledby="pr-h" className="flex flex-col gap-3 rounded-[18px] border border-t-[5px] border-[#E3EAF3] border-t-c2 bg-white p-[22px]">
        <h2 id="pr-h" className="text-lg !text-c1">
          {label(month)} payroll by branch
        </h2>
        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Payroll by branch: scroll sideways to see more">
          <table className="tbl min-w-[760px]">
            <caption className="sr-only">Payroll by branch</caption>
            <thead>
              <tr>
                <th scope="col">Branch</th>
                <th scope="col">Staff</th>
                <th scope="col">Gross</th>
                <th scope="col">Deductions</th>
                <th scope="col">Net</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {ctx.branches.map((b) => {
                const r = runs.get(b.id);
                const st = !r || !r.payslips.length ? { k: "info" as const, t: "Not prepared" } : r.status === "draft" ? { k: "warn" as const, t: "Waiting for approval" } : r.status === "approved" ? { k: "good" as const, t: "Approved" } : { k: "good" as const, t: "Paid" };
                return (
                  <tr key={b.id}>
                    <th scope="row">{b.name}</th>
                    <td>{r?.payslips.length ?? 0}</td>
                    <td>{naira(sum(r, "gross_kobo"))}</td>
                    <td>{naira(sum(r, "gross_kobo") - sum(r, "net_kobo"))}</td>
                    <td className="font-bold">{naira(sum(r, "net_kobo"))}</td>
                    <td>
                      <Pill kind={st.k}>{st.t}</Pill>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {ready.length > 0 &&
          (ctx.role === "proprietor" ? (
            <ActionForm action={approveBranchPayroll} className="flex flex-col gap-2">
              <input type="hidden" name="month" value={month} />
              <fieldset className="flex flex-wrap gap-2">
                <legend className="label">Approve</legend>
                {ready.map((r) => (
                  <label key={r.id} className="flex min-h-[44px] items-center gap-2 rounded-xl border-[1.5px] border-[#DCE5F0] px-3 text-sm font-bold has-[:checked]:border-c2 has-[:checked]:bg-[#F3FBF9]">
                    <input type="checkbox" name="run" value={r.id} defaultChecked className="h-4 w-4" />
                    {ctx.branches.find((b) => b.id === r.school_id)?.name} · {naira(sum(r, "net_kobo"))}
                  </label>
                ))}
              </fieldset>
              <div>
                <SubmitButton pending="Approving…">Approve ticked runs</SubmitButton>
              </div>
            </ActionForm>
          ) : (
            <p className="text-sm text-brand-slate">{ready.length} run{ready.length === 1 ? " is" : "s are"} waiting for the proprietor&apos;s approval.</p>
          ))}
      </section>
    </GroupShell>
  );
}
