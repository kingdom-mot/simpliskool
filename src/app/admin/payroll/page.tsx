import { redirect } from "next/navigation";
import { featureOn } from "@/lib/platform-settings";
import Link from "next/link";
import { AdminPage, Panel, requireAdminPage } from "@/components/admin";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Flash } from "@/components/Flash";
import { Empty, ICONS, Pill, StatCard } from "@/components/ui";
import { koboInput } from "@/lib/fees";
import { naira } from "@/lib/format";
import { parseItems, type Settings } from "@/lib/payroll";
import { approvePayroll, deleteStructure, markPaid, preparePayroll, saveStaffPay, saveStructure, saveTaxSettings } from "./actions";

export const metadata = { title: "Payroll" };

type Structure = { id: string; name: string; basic_kobo: number; allowances: unknown; deductions: unknown };
type Slip = { id: string; user_id: string; name: string; job_title: string | null; basic_kobo: number; allowances: unknown; deductions: unknown; gross_kobo: number; pension_kobo: number; employer_pension_kobo: number; paye_kobo: number; net_kobo: number; account_no: string | null };
type Run = { id: string; month: string; status: "draft" | "approved" | "paid"; paid_at: string | null; payslips: { net_kobo: number }[] };
type Pay = { user_id: string; structure_id: string | null; job_title: string | null; bank_name: string | null; account_no: string | null; account_name: string | null; pfa: string | null; pension_pin: string | null; monthly_rent_kobo: number | null };
const BANKS = ["Access Bank", "Citibank", "Ecobank", "Fidelity Bank", "First Bank", "FCMB", "Globus Bank", "GTBank", "Jaiz Bank", "Keystone Bank", "Kuda", "Moniepoint", "OPay", "PalmPay", "Polaris Bank", "Providus Bank", "Stanbic IBTC", "Sterling Bank", "Union Bank", "UBA", "Unity Bank", "Wema Bank", "Zenith Bank"];
const STATES = ["Lagos (LIRS)", "Ogun (OGIRS)", "Oyo (OYIRS)", "FCT (FCT-IRS)", "Rivers (RIRS)", "Kano (KIRS)", "Other"];
const sum = (raw: unknown) => parseItems(raw).reduce((a, x) => a + x.kobo, 0);

export default async function PayrollPage(props: { searchParams: Promise<{ tab?: string; month?: string; slip?: string }> }) {
  const sp = await props.searchParams;
  const ctx = await requireAdminPage(["owner", "bursar"]);
  if (!(await featureOn(ctx.school.id, "payroll"))) redirect("/admin");
  const { supabase, school, membership } = ctx;
  const nowMonth = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date()).slice(0, 7);
  const month = sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : nowMonth;
  const tab = ["run", "structures", "tax", "past"].includes(sp.tab ?? "") ? sp.tab! : "run";
  const [{ data: structures }, { data: settings }, { data: runs }, { data: staff }, { data: pays }] = await Promise.all([
    supabase.from("pay_structures").select("id, name, basic_kobo, allowances, deductions").eq("school_id", school.id).order("name").returns<Structure[]>(),
    supabase.from("payroll_settings").select("*").eq("school_id", school.id).maybeSingle<Settings>(),
    supabase.from("payroll_runs").select("id, month, status, paid_at, payslips(net_kobo)").eq("school_id", school.id).order("month", { ascending: false }).returns<Run[]>(),
    supabase.rpc("staff_list", { p_school: school.id }),
    supabase.from("staff_pay").select("*").eq("school_id", school.id).returns<Pay[]>(),
  ]);
  const run = (runs ?? []).find((r) => r.month.slice(0, 7) === month);
  const { data: slips } = run ? await supabase.from("payslips").select("*").eq("run_id", run.id).order("name").returns<Slip[]>() : { data: [] as Slip[] };
  const staffList = ((staff as { user_id: string; full_name: string | null; email: string | null; roles: string[] }[] | null) ?? []);
  const payOf = new Map((pays ?? []).map((p) => [p.user_id, p]));
  const monthName = new Date(`${month}-15T12:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const tot = (k: keyof Slip) => (slips ?? []).reduce((a, s) => a + Number(s[k] ?? 0), 0);
  const deductionsTotal = tot("pension_kobo") + tot("paye_kobo") + (slips ?? []).reduce((a, s) => a + sum(s.deductions), 0);
  const cur = (slips ?? []).find((s) => s.user_id === sp.slip);
  const s = settings ?? { pension_on: false, pension_staff_pct: 8, pension_employer_pct: 10, paye_on: false, tax_state: null, tin: null };
  const STATUS = { draft: ["Draft: not approved", "warn"], approved: ["Approved: waiting to be paid", "info"], paid: ["Paid", "good"] } as const;
  const tabHref = (t: string) => `/admin/payroll?${new URLSearchParams({ tab: t, month })}`;

  return (
    <AdminPage ctx={ctx} active="payroll" crumb={[{ label: "Finance" }]} title="Payroll">
      <Flash />
      <p className="rounded-xl bg-[#EEF3F9] px-4 py-3 text-sm text-[#173B70]">Only the school owner and the bursar can see payroll. Staff see their own payslip once the month is paid.</p>
      <nav aria-label="Payroll" className="flex flex-wrap gap-2">
        {[
          ["run", `${monthName} run`],
          ["structures", "Salary structures"],
          ["tax", "Pension and tax"],
          ["past", "Past runs"],
        ].map(([k, l]) => (
          <Link key={k} href={tabHref(k)} aria-current={tab === k ? "page" : undefined} className={`flex min-h-[44px] items-center rounded-xl border-[1.5px] px-4 text-sm font-bold ${tab === k ? "border-c1 bg-c1 text-white" : "border-[#DCE5F0] bg-white text-brand-slate"}`}>
            {l}
          </Link>
        ))}
      </nav>

      {tab === "run" && (
        <>
          <form method="get" className="flex flex-wrap items-end gap-2">
            <div>
              <label className="label" htmlFor="pr-month">
                Month
              </label>
              <input id="pr-month" name="month" type="month" className="sk-input py-2" defaultValue={month} />
            </div>
            <button className="s-btn2">Show</button>
          </form>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard tone="blue" icon={ICONS.users} label="Staff" value={String(slips?.length ?? 0)} sub={`${staffList.length} staff in the school`} />
            <StatCard tone="teal" icon={ICONS.cash} label="Gross pay" value={naira(tot("gross_kobo"), true)} sub={monthName} />
            <StatCard tone="pink" icon={ICONS.chart} label="Deductions" value={naira(deductionsTotal, true)} sub={s.pension_on || s.paye_on ? `${s.pension_on ? "Pension" : ""}${s.pension_on && s.paye_on ? ", " : ""}${s.paye_on ? "PAYE" : ""} and others` : "Other deductions only"} />
            <StatCard tone="green" icon={ICONS.check} label="Net pay" value={naira(tot("net_kobo"), true)} sub={s.pension_on ? `Employer pension ${naira(tot("employer_pension_kobo"), true)}` : "To pay staff"} />
          </div>
          <Panel id="run-h" title={`${monthName} payroll`} actions={run ? <Pill kind={STATUS[run.status][1]}>{STATUS[run.status][0]}</Pill> : undefined}>
            <div className="flex flex-wrap gap-2">
              {(!run || run.status === "draft") && (
                <ActionForm action={preparePayroll}>
                  <input type="hidden" name="month" value={month} />
                  <SubmitButton className={run ? "s-btn2" : "s-btn"} pending="Working out…">
                    {run ? "Recalculate" : `Prepare ${monthName} payroll`}
                  </SubmitButton>
                </ActionForm>
              )}
              {run?.status === "draft" && slips?.length ? (
                membership.role === "owner" ? (
                  <ActionForm action={approvePayroll}>
                    <input type="hidden" name="id" value={run.id} />
                    <SubmitButton pending="Approving…">Approve payroll</SubmitButton>
                  </ActionForm>
                ) : (
                  <span className="self-center text-sm text-[#4A5A70]">Waiting for the owner to approve.</span>
                )
              ) : null}
              {run?.status === "approved" && (
                <ActionForm action={markPaid}>
                  <input type="hidden" name="id" value={run.id} />
                  <SubmitButton pending="Saving…">Mark as paid and send payslips</SubmitButton>
                </ActionForm>
              )}
              {run && run.status !== "draft" && (
                <a className="s-btn2" href={`/admin/payroll/schedule?run=${run.id}`} download>
                  Download bank schedule
                </a>
              )}
            </div>
            {slips?.length ? (
              <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Payroll table: scroll sideways to see more">
                <table className="tbl min-w-[980px]">
                  <caption className="sr-only">{monthName} payroll. Select a name to see the payslip.</caption>
                  <thead>
                    <tr>
                      <th scope="col">Staff</th>
                      <th scope="col">Role</th>
                      <th scope="col">Basic</th>
                      <th scope="col">Allowances</th>
                      <th scope="col">Other deductions</th>
                      <th scope="col">Pension ({s.pension_staff_pct}%)</th>
                      <th scope="col">PAYE tax</th>
                      <th scope="col">Net pay</th>
                    </tr>
                  </thead>
                  <tbody>
                    {slips.map((x) => (
                      <tr key={x.id} className={x.user_id === sp.slip ? "bg-brand-cloud" : ""}>
                        <th scope="row">
                          <Link className="s-link" href={`/admin/payroll?${new URLSearchParams({ month, slip: x.user_id })}#slip`}>
                            {x.name}
                          </Link>
                          {!x.account_no && <span className="block text-xs font-normal text-[#7A5300]">No bank account</span>}
                        </th>
                        <td>{x.job_title ?? "—"}</td>
                        <td>{naira(x.basic_kobo)}</td>
                        <td>{naira(sum(x.allowances))}</td>
                        <td>{sum(x.deductions) ? naira(sum(x.deductions)) : "—"}</td>
                        <td>{x.pension_kobo ? naira(x.pension_kobo) : "—"}</td>
                        <td>{x.paye_kobo ? naira(x.paye_kobo) : "—"}</td>
                        <td className="font-extrabold">{naira(x.net_kobo)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty>{structures?.length ? "Prepare the payroll to work out this month's pay." : "Start in Salary structures: add your pay structures and give each staff member one."}</Empty>
            )}
          </Panel>
          {cur && (
            <Panel id="slip" title={`Payslip · ${monthName}`}>
              <p className="-mt-2 font-bold text-brand-slate">
                {cur.name} · {cur.job_title}
              </p>
              <dl className="flex flex-col text-sm">
                {[
                  ["Basic salary", naira(cur.basic_kobo)],
                  ...parseItems(cur.allowances).map((a) => [a.name, naira(a.kobo)]),
                  ...parseItems(cur.deductions).map((d) => [d.name, `−${naira(d.kobo)}`]),
                  ...(cur.pension_kobo ? [[`Pension (${s.pension_staff_pct}%)`, `−${naira(cur.pension_kobo)}`]] : []),
                  ...(cur.paye_kobo ? [["PAYE tax", `−${naira(cur.paye_kobo)}`]] : []),
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between border-b border-[#EEF3F9] py-2">
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
                <div className="flex justify-between py-2 text-base font-extrabold text-c1">
                  <dt>Net pay</dt>
                  <dd>{naira(cur.net_kobo)}</dd>
                </div>
              </dl>
              <Link className="s-btn2 self-start" href={`/payslip/${cur.id}`}>
                Print or save as PDF
              </Link>
            </Panel>
          )}
        </>
      )}

      {tab === "structures" && (
        <>
          <Panel id="st-h" title="Salary structures">
            {(structures ?? []).length ? (
              <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Salary structures: scroll sideways to see more">
                <table className="tbl min-w-[760px]">
                  <caption className="sr-only">Salary structures</caption>
                  <thead>
                    <tr>
                      <th scope="col">Structure</th>
                      <th scope="col">Basic</th>
                      <th scope="col">Allowances</th>
                      <th scope="col">Deductions</th>
                      <th scope="col">Staff</th>
                      <th scope="col">
                        <span className="sr-only">Delete</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {structures!.map((x) => (
                      <tr key={x.id}>
                        <th scope="row">{x.name}</th>
                        <td>{naira(x.basic_kobo)}</td>
                        <td>{parseItems(x.allowances).map((a) => `${a.name} ${naira(a.kobo)}`).join(" · ") || "—"}</td>
                        <td>{parseItems(x.deductions).map((a) => `${a.name} ${naira(a.kobo)}`).join(" · ") || "—"}</td>
                        <td>{(pays ?? []).filter((p) => p.structure_id === x.id).length}</td>
                        <td>
                          <ActionForm action={deleteStructure}>
                            <input type="hidden" name="id" value={x.id} />
                            <SubmitButton className="s-btn-danger" pending="Deleting…">
                              Delete<span className="sr-only"> {x.name}</span>
                            </SubmitButton>
                          </ActionForm>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty>No salary structures yet. Add one below, like &quot;Graduate teacher&quot;.</Empty>
            )}
            <ActionForm action={saveStructure} resetOnSuccess className="flex flex-col gap-3 rounded-xl bg-brand-cloud p-4">
              <h3 className="text-base !text-c1">+ New structure</h3>
              <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="ps-name">
                    Name
                  </label>
                  <input id="ps-name" name="name" className="sk-input" required maxLength={60} placeholder="e.g. Graduate teacher" />
                </div>
                <div>
                  <label className="label" htmlFor="ps-basic">
                    Basic salary a month (₦)
                  </label>
                  <input id="ps-basic" name="basic" className="sk-input" inputMode="decimal" required placeholder="120000" />
                </div>
              </div>
              <fieldset className="grid grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-2">
                <legend className="label">Allowances a month (housing and transport count towards pension)</legend>
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-2">
                    <input aria-label={`Allowance ${i + 1} name`} name={`a_name_${i}`} className="sk-input" maxLength={40} placeholder={["Housing", "Transport", "Responsibility", "Other"][i]} />
                    <input aria-label={`Allowance ${i + 1} amount in naira`} name={`a_amt_${i}`} className="sk-input w-32" inputMode="decimal" placeholder="₦" />
                  </div>
                ))}
              </fieldset>
              <fieldset className="grid grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-2">
                <legend className="label">Other deductions a month</legend>
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex gap-2">
                    <input aria-label={`Deduction ${i + 1} name`} name={`d_name_${i}`} className="sk-input" maxLength={40} placeholder={["Cooperative", "Loan", "Other"][i]} />
                    <input aria-label={`Deduction ${i + 1} amount in naira`} name={`d_amt_${i}`} className="sk-input w-32" inputMode="decimal" placeholder="₦" />
                  </div>
                ))}
              </fieldset>
              <div>
                <SubmitButton>Save structure</SubmitButton>
              </div>
            </ActionForm>
          </Panel>

          <Panel id="sp-h" title="Staff pay details">
            <p className="text-sm text-[#4A5A70]">Give each staff member a structure and their bank details. Pension details (PFA and PIN) appear on the remittance schedule.</p>
            {staffList.length ? (
              <ul className="flex flex-col gap-3">
                {staffList.map((m) => {
                  const p = payOf.get(m.user_id);
                  const nm = m.full_name?.trim() || m.email || "Staff member";
                  const id = m.user_id.slice(0, 8);
                  return (
                    <li key={m.user_id} className="rounded-xl border border-[#E3EAF3] p-3">
                      <ActionForm action={saveStaffPay} className="grid grid-cols-[minmax(0,1fr)] items-end gap-2 sm:grid-cols-2 xl:grid-cols-5">
                        <input type="hidden" name="user_id" value={m.user_id} />
                        <div className="sm:col-span-2 xl:col-span-5">
                          <span className="font-bold text-brand-slate">{nm}</span> <span className="text-xs text-[#4A5A70]">{m.roles.join(", ")}</span>
                        </div>
                        <div>
                          <label className="label" htmlFor={`st-${id}`}>
                            Structure
                          </label>
                          <select id={`st-${id}`} name="structure_id" className="sk-input sk-select" defaultValue={p?.structure_id ?? ""}>
                            <option value="">Not on payroll</option>
                            {(structures ?? []).map((x) => (
                              <option key={x.id} value={x.id}>
                                {x.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="label" htmlFor={`jt-${id}`}>
                            Job title
                          </label>
                          <input id={`jt-${id}`} name="job_title" className="sk-input" maxLength={60} defaultValue={p?.job_title ?? ""} />
                        </div>
                        <div>
                          <label className="label" htmlFor={`bk-${id}`}>
                            Bank
                          </label>
                          <input id={`bk-${id}`} name="bank_name" className="sk-input" list="banks" maxLength={60} defaultValue={p?.bank_name ?? ""} />
                        </div>
                        <div>
                          <label className="label" htmlFor={`an-${id}`}>
                            Account number
                          </label>
                          <input id={`an-${id}`} name="account_no" className="sk-input" inputMode="numeric" maxLength={10} defaultValue={p?.account_no ?? ""} />
                        </div>
                        <div>
                          <label className="label" htmlFor={`am-${id}`}>
                            Account name
                          </label>
                          <input id={`am-${id}`} name="account_name" className="sk-input" maxLength={120} defaultValue={p?.account_name ?? ""} />
                        </div>
                        <div>
                          <label className="label" htmlFor={`pf-${id}`}>
                            Pension provider (PFA)
                          </label>
                          <input id={`pf-${id}`} name="pfa" className="sk-input" maxLength={80} defaultValue={p?.pfa ?? ""} />
                        </div>
                        <div>
                          <label className="label" htmlFor={`pp-${id}`}>
                            Pension PIN
                          </label>
                          <input id={`pp-${id}`} name="pension_pin" className="sk-input" maxLength={30} defaultValue={p?.pension_pin ?? ""} />
                        </div>
                        <div>
                          <label className="label" htmlFor={`rt-${id}`}>
                            Monthly rent (₦, for tax relief)
                          </label>
                          <input id={`rt-${id}`} name="rent" className="sk-input" inputMode="decimal" defaultValue={p?.monthly_rent_kobo ? koboInput(p.monthly_rent_kobo) : ""} />
                        </div>
                        <div>
                          <SubmitButton className="s-btn2">
                            Save<span className="sr-only"> pay details for {nm}</span>
                          </SubmitButton>
                        </div>
                      </ActionForm>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <Empty>No staff yet.</Empty>
            )}
            <datalist id="banks">
              {BANKS.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
          </Panel>
        </>
      )}

      {tab === "tax" && (
        <Panel id="tx-h" title="Pension and tax">
          <p className="text-sm text-brand-slate">Not every school deducts pension or tax. Turn on only what your school does. Once on, it&apos;s worked out for every payslip automatically.</p>
          <ActionForm action={saveTaxSettings} className="flex flex-col gap-4">
            <fieldset className="flex flex-col gap-2 rounded-xl border border-[#E3EAF3] p-4">
              <legend className="label">Pension contributions</legend>
              <label className="flex min-h-[44px] items-center gap-2 text-sm font-semibold">
                <input type="checkbox" name="pension_on" value="1" defaultChecked={s.pension_on} className="h-5 w-5" /> Contributory pension (of basic, housing and transport)
              </label>
              <div className="grid grid-cols-2 gap-3 sm:max-w-md">
                <div>
                  <label className="label" htmlFor="pen-s">
                    Staff contribution (%)
                  </label>
                  <input id="pen-s" name="pension_staff_pct" className="sk-input" inputMode="decimal" defaultValue={String(s.pension_staff_pct)} />
                </div>
                <div>
                  <label className="label" htmlFor="pen-e">
                    School contribution (%)
                  </label>
                  <input id="pen-e" name="pension_employer_pct" className="sk-input" inputMode="decimal" defaultValue={String(s.pension_employer_pct)} />
                </div>
              </div>
            </fieldset>
            <fieldset className="flex flex-col gap-2 rounded-xl border border-[#E3EAF3] p-4">
              <legend className="label">PAYE income tax</legend>
              <label className="flex min-h-[44px] items-center gap-2 text-sm font-semibold">
                <input type="checkbox" name="paye_on" value="1" defaultChecked={s.paye_on} className="h-5 w-5" /> Deduct staff income tax
              </label>
              <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:max-w-xl sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="tx-state">
                    State tax office
                  </label>
                  <select id="tx-state" name="tax_state" className="sk-input sk-select" defaultValue={s.tax_state ?? STATES[0]}>
                    {STATES.map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="tx-tin">
                    School tax ID (TIN)
                  </label>
                  <input id="tx-tin" name="tin" className="sk-input" maxLength={30} defaultValue={s.tin ?? ""} />
                </div>
              </div>
              <p className="text-[13px] text-[#4A5A70]">
                Tax is estimated with the Nigeria Tax Act 2025 bands (first ₦800,000 a year tax-free, then 15% to 25%), after pension and rent relief. Please confirm the figures with your tax adviser before paying them over.
              </p>
            </fieldset>
            <div>
              <SubmitButton>Save and view payroll</SubmitButton>
            </div>
          </ActionForm>
        </Panel>
      )}

      {tab === "past" && (
        <Panel id="past-h" title="Past runs">
          {(runs ?? []).length ? (
            <ul className="flex flex-col gap-2">
              {runs!.map((r) => {
                const net = r.payslips.reduce((a, x) => a + Number(x.net_kobo), 0);
                const m = new Date(`${r.month}T12:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
                return (
                  <li key={r.id}>
                    <Link href={`/admin/payroll?month=${r.month.slice(0, 7)}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#E3EAF3] p-3">
                      <span className="font-bold text-brand-slate">
                        {m} · {naira(net, true)} net
                      </span>
                      <Pill kind={STATUS[r.status][1]}>{r.status === "paid" && r.paid_at ? `Paid ${new Date(r.paid_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : STATUS[r.status][0]}</Pill>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <Empty>No payroll runs yet.</Empty>
          )}
        </Panel>
      )}
    </AdminPage>
  );
}
