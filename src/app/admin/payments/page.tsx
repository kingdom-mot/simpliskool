import Link from "next/link";
import { AdminPage, Panel, classLabel, requireAdminPage } from "@/components/admin";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Empty, ICONS, Pill, StatCard } from "@/components/ui";
import { emailReady } from "@/lib/email";
import { FINANCE_ROLES, METHOD_LABEL, loadTerms, termLabel } from "@/lib/fees";
import { naira, pct } from "@/lib/format";
import { levelOrder } from "@/lib/nigeria";
import { recordPayment, resendReceipt, sendReminders, voidPayment } from "./actions";
import { parentPhones, smsReady, smsSettings } from "@/lib/sms";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Payments and defaulters" };

type Overview = {
  expected: number;
  received: number;
  outstanding: number;
  invoices: number;
  paid_in_full: number;
  owing: number;
  earlier: number;
  earlier_students: number;
  payments: { id: string; at: string; name: string; student_id: string; class: string | null; method: string; receipt: string | null; reference: string | null; amount: number; voided: boolean; void_reason: string | null; by: string | null }[];
  defaulters: { id: string; name: string; admission_no: string; class: string | null; cur: number; prev: number; total: number; invoice_id: string | null; last_reminder: string | null; parents_with_email: number }[];
  invoice_list: { id: string; student_id: string; name: string; admission_no: string; class: string | null; total: number; paid: number; balance: number }[];
};

const TZ = "Africa/Lagos";
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: TZ });
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());

export default async function PaymentsPage(props: { searchParams: Promise<{ term?: string; class?: string; tab?: string; invoice?: string }> }) {
  const sp = await props.searchParams;
  const ctx = await requireAdminPage(FINANCE_ROLES);
  const { supabase, school, membership } = ctx;
  const { terms, term } = await loadTerms(supabase, school.id, sp.term);
  const { data: classRows } = await supabase.from("classes").select("id, name, arm").eq("school_id", school.id).returns<{ id: string; name: string; arm: string }[]>();
  const classes = (classRows ?? []).sort((a, b) => levelOrder(a.name) - levelOrder(b.name) || classLabel(a.name, a.arm).localeCompare(classLabel(b.name, b.arm)));
  const classId = classes.some((c) => c.id === sp.class) ? sp.class! : null;
  const tab = sp.tab === "defaulters" || sp.tab === "invoices" ? sp.tab : "payments";

  if (!term) {
    return (
      <AdminPage ctx={ctx} active="payments" crumb={[{ label: "Finance" }]} title="Payments and defaulters">
        <Empty>
          Add a session and its terms on the{" "}
          <Link className="s-link" href="/admin/sessions">
            Sessions and terms
          </Link>{" "}
          page, then set the fees.
        </Empty>
      </AdminPage>
    );
  }

  const { data } = await supabase.rpc("fee_overview", { p_school: school.id, p_term: term.id, p_class: classId });
  const o = data as Overview | null;
  const owingInvoices = (o?.invoice_list ?? []).filter((i) => i.balance > 0);
  const canVoid = membership.role !== "bursar";
  const ready = emailReady();
  // Parents reachable by text (only matters when the school has SMS fee reminders on).
  const withPhone = new Set<string>();
  let smsOn = false;
  if (tab === "defaulters" && smsReady() && o?.defaulters.length) {
    const admin = createAdminClient();
    const s = await smsSettings(admin, school.id);
    smsOn = s.sms_enabled && s.sms_fees;
    if (smsOn) for (const [id, list] of await parentPhones(admin, o.defaulters.map((d) => d.id))) if (list.length) withPhone.add(id);
  }
  const reachable = (d: { id: string; parents_with_email: number }) => (ready && d.parents_with_email > 0) || withPhone.has(d.id);
  const periodName = `${termLabel(term)}${classId ? `, ${classLabel(classes.find((c) => c.id === classId)!.name, classes.find((c) => c.id === classId)!.arm)}` : ""}`;
  const base = { term: term.id, ...(classId ? { class: classId } : {}) };
  const href = (o2: Record<string, string>) => `/admin/payments?${new URLSearchParams({ ...base, ...o2 })}`;
  const exportHref = (kind: string) => `/admin/payments/export?${new URLSearchParams({ ...base, kind })}`;
  const debtTotal = (o?.defaulters ?? []).reduce((a, d) => a + d.total, 0);

  return (
    <AdminPage
      ctx={ctx}
      active="payments"
      crumb={[{ label: "Finance" }]}
      title="Payments and defaulters"
      actions={
        <>
          <a className="s-btn2" href={exportHref(tab === "defaulters" ? "defaulters" : tab === "invoices" ? "invoices" : "payments")} download>
            Export {tab}
          </a>
          <a className="s-btn" href="#record">
            Record cash or transfer
          </a>
        </>
      }
    >
      <form method="get" className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="tab" value={tab} />
        <div>
          <label className="label" htmlFor="p-term">
            Term
          </label>
          <select className="sk-input py-2" id="p-term" name="term" defaultValue={term.id}>
            {terms.map((t) => (
              <option key={t.id} value={t.id}>
                {termLabel(t)}
                {t.is_current ? " (current)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="p-class">
            Class
          </label>
          <select className="sk-input py-2" id="p-class" name="class" defaultValue={classId ?? ""}>
            <option value="">All classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {classLabel(c.name, c.arm)}
              </option>
            ))}
          </select>
        </div>
        <button className="s-btn2">Show</button>
      </form>

      {!o?.invoices ? (
        <p role="status" className="rounded-xl bg-[#FFF6E3] px-4 py-3 text-sm text-[#5C4310]">
          No invoices for {periodName} yet.{" "}
          <Link className="s-link" href={`/admin/fees?term=${term.id}`}>
            Set the fees and publish the invoices
          </Link>
          .
        </p>
      ) : null}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard tone="blue" icon={ICONS.book} label="Expected income" value={naira(o?.expected, true)} sub={`${o?.invoices ?? 0} invoice${o?.invoices === 1 ? "" : "s"} · ${periodName}`} />
        <StatCard tone="teal" icon={ICONS.check} label="Received" value={naira(o?.received, true)} percent={pct(o?.received ?? 0, o?.expected ?? 0)} sub={`${pct(o?.received ?? 0, o?.expected ?? 0)}% collected · ${o?.paid_in_full ?? 0} paid in full`} />
        <StatCard tone="pink" icon={ICONS.users} label="Outstanding" value={naira(o?.outstanding, true)} sub={`${o?.owing ?? 0} student${o?.owing === 1 ? "" : "s"} still owing`} />
        <StatCard tone="amber" icon={ICONS.clock} label="Owed from earlier terms" value={naira(o?.earlier, true)} sub={o?.earlier ? `${o.earlier_students} student${o.earlier_students === 1 ? "" : "s"} · carried into this term` : "Nothing carried over"} />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 xl:grid-cols-[1.7fr_1fr]">
        <section aria-label="Payments, defaulters and invoices" className="flex min-w-0 flex-col gap-4 rounded-[18px] border border-[#E3EAF3] bg-white p-[22px]">
          <nav aria-label="Lists" className="flex flex-wrap gap-2">
            {[
              ["payments", `Payments (${(o?.payments ?? []).filter((p) => !p.voided).length})`],
              ["defaulters", `Defaulters (${o?.defaulters.length ?? 0})`],
              ["invoices", `Invoices (${o?.invoices ?? 0})`],
            ].map(([k, label]) => (
              <Link
                key={k}
                href={href({ tab: k })}
                aria-current={tab === k ? "page" : undefined}
                className={`flex min-h-[44px] items-center rounded-xl border-[1.5px] px-4 text-sm font-bold ${tab === k ? "border-c1 bg-c1 text-white" : "border-[#DCE5F0] bg-white text-brand-slate"}`}
              >
                {label}
              </Link>
            ))}
          </nav>

          {tab === "payments" &&
            (o?.payments.length ? (
              <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Payments table: scroll sideways to see more">
                <table className="tbl min-w-[860px]">
                  <caption className="sr-only">Payments for {periodName}</caption>
                  <thead>
                    <tr>
                      <th scope="col">Date</th>
                      <th scope="col">Student</th>
                      <th scope="col">Class</th>
                      <th scope="col">Method</th>
                      <th scope="col">Receipt</th>
                      <th scope="col">Amount</th>
                      <th scope="col">Status</th>
                      <th scope="col">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {o.payments.map((p) => (
                      <tr key={p.id}>
                        <td className="whitespace-nowrap">{day(p.at)}</td>
                        <th scope="row">{p.name}</th>
                        <td>{p.class ?? "—"}</td>
                        <td>
                          {METHOD_LABEL[p.method] ?? p.method}
                          {p.reference && <span className="block text-xs text-[#4A5A70]">Ref: {p.reference}</span>}
                        </td>
                        <td>
                          {p.receipt && !p.voided ? (
                            <Link className="s-link" href={`/receipt/${p.id}`}>
                              {p.receipt}
                            </Link>
                          ) : (
                            (p.receipt ?? "—")
                          )}
                        </td>
                        <td className={`whitespace-nowrap font-bold ${p.voided ? "text-[#4A5A70] line-through" : ""}`}>{naira(p.amount)}</td>
                        <td>{p.voided ? <Pill kind="bad">Cancelled</Pill> : <Pill kind="good">Received</Pill>}</td>
                        <td>
                          {p.voided ? (
                            <span className="text-xs text-[#4A5A70]">{p.void_reason}</span>
                          ) : (
                            <div className="flex flex-col gap-1.5">
                              {ready && p.method !== "paystack" && (
                                <ActionForm action={resendReceipt}>
                                  <input type="hidden" name="id" value={p.id} />
                                  <SubmitButton className="s-link text-sm" pending="Sending…">
                                    Email receipt<span className="sr-only"> {p.receipt}</span>
                                  </SubmitButton>
                                </ActionForm>
                              )}
                              {canVoid && p.method !== "paystack" && (
                                <details>
                                  <summary className="s-link cursor-pointer text-sm">
                                    Cancel<span className="sr-only"> payment {p.receipt}</span>
                                  </summary>
                                  <ActionForm action={voidPayment} className="mt-2 flex w-56 flex-col gap-2">
                                    <input type="hidden" name="id" value={p.id} />
                                    <label className="label" htmlFor={`v-${p.id}`}>
                                      Why?
                                    </label>
                                    <input id={`v-${p.id}`} name="reason" className="sk-input py-2" required minLength={3} maxLength={200} placeholder="e.g. Entered twice" />
                                    <SubmitButton className="s-btn-danger" pending="Cancelling…">
                                      Cancel payment
                                    </SubmitButton>
                                  </ActionForm>
                                </details>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty>No payments for {periodName} yet.</Empty>
            ))}

          {tab === "defaulters" &&
            (o?.defaulters.length ? (
              <ActionForm action={sendReminders} className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-brand-slate">
                    {o.defaulters.length} student{o.defaulters.length === 1 ? "" : "s"} owe {naira(debtTotal)} in all, including earlier terms.
                  </p>
                  <SubmitButton pending="Sending…">Send payment reminders</SubmitButton>
                </div>
                {!ready && !smsOn && <p className="text-[13px] text-[#4A5A70]">Emails aren&apos;t switched on yet, so reminders can&apos;t be sent.</p>}
                <p className="text-[13px] text-[#4A5A70]">Tick the students whose parents should get their full balance by email{smsOn ? " and text" : ""}. Each parent gets at most one reminder per child a day.</p>
                <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Defaulters table: scroll sideways to see more">
                  <table className="tbl min-w-[860px]">
                    <caption className="sr-only">Students owing for {periodName}</caption>
                    <thead>
                      <tr>
                        <th scope="col">Select</th>
                        <th scope="col">Student</th>
                        <th scope="col">Class</th>
                        <th scope="col">This term</th>
                        <th scope="col">Earlier terms</th>
                        <th scope="col">Total owed</th>
                        <th scope="col">Last reminder</th>
                        <th scope="col">
                          <span className="sr-only">Record a payment</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {o.defaulters.map((d) => (
                        <tr key={d.id}>
                          <td>
                            <input
                              type="checkbox"
                              name="student"
                              value={d.id}
                              defaultChecked={reachable(d)}
                              disabled={!reachable(d)}
                              aria-label={`Send a reminder to ${d.name}'s parents`}
                              className="h-5 w-5"
                            />
                          </td>
                          <th scope="row">
                            {d.name}
                            {!reachable(d) && <span className="block text-xs font-normal text-[#4A5A70]">{smsOn ? "No parent email or phone" : "No parent email"}</span>}
                            {reachable(d) && d.parents_with_email === 0 && <span className="block text-xs font-normal text-[#4A5A70]">By text only</span>}
                          </th>
                          <td>{d.class ?? "—"}</td>
                          <td>{d.cur ? naira(d.cur) : "—"}</td>
                          <td>{d.prev ? naira(d.prev) : "—"}</td>
                          <td className="font-extrabold text-[#912018]">{naira(d.total)}</td>
                          <td>{d.last_reminder ? day(d.last_reminder) : "Never"}</td>
                          <td>
                            {d.invoice_id && d.cur > 0 && (
                              <Link className="s-link text-sm" href={`${href({ tab: "defaulters", invoice: d.invoice_id })}#record`}>
                                Record payment<span className="sr-only"> for {d.name}</span>
                              </Link>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ActionForm>
            ) : (
              <Empty>Nobody owes anything for {periodName}.</Empty>
            ))}

          {tab === "invoices" &&
            (o?.invoice_list.length ? (
              <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Invoices table: scroll sideways to see more">
                <table className="tbl min-w-[640px]">
                  <caption className="sr-only">Invoices for {periodName}</caption>
                  <thead>
                    <tr>
                      <th scope="col">Student</th>
                      <th scope="col">Class</th>
                      <th scope="col">Total</th>
                      <th scope="col">Paid</th>
                      <th scope="col">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {o.invoice_list.map((i) => (
                      <tr key={i.id}>
                        <th scope="row">
                          {i.name} <span className="block text-xs font-normal text-[#4A5A70]">{i.admission_no}</span>
                        </th>
                        <td>{i.class ?? "—"}</td>
                        <td>{naira(i.total)}</td>
                        <td>{naira(i.paid)}</td>
                        <td>{i.balance > 0 ? <span className="font-bold text-[#912018]">{naira(i.balance)}</span> : i.balance < 0 ? <Pill kind="info">{naira(-i.balance)} credit</Pill> : <Pill kind="good">Paid</Pill>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty>No invoices for {periodName} yet.</Empty>
            ))}
        </section>

        <Panel id="record" title="Record a payment">
          {owingInvoices.length ? (
            <ActionForm action={recordPayment} resetOnSuccess className="flex flex-col gap-3">
              <div>
                <label className="label" htmlFor="r-inv">
                  Student
                </label>
                <select id="r-inv" name="invoice" className="sk-input" required defaultValue={owingInvoices.some((i) => i.id === sp.invoice) ? sp.invoice : ""}>
                  <option value="" disabled>
                    Choose a student
                  </option>
                  {owingInvoices.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.class ?? "no class"}) · owes {naira(i.balance)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="r-amt">
                  Amount (₦)
                </label>
                <input id="r-amt" name="amount" className="sk-input" inputMode="decimal" required placeholder="e.g. 50000" />
              </div>
              <fieldset>
                <legend className="label">Method</legend>
                <div className="flex flex-wrap gap-2">
                  {(["transfer", "cash", "pos"] as const).map((m, i) => (
                    <label key={m} className="flex min-h-[44px] items-center gap-2 rounded-xl border-[1.5px] border-[#DCE5F0] px-3 text-sm font-semibold has-[:checked]:border-c1 has-[:checked]:bg-brand-cloud">
                      <input type="radio" name="method" value={m} defaultChecked={i === 0} className="h-4 w-4" />
                      {METHOD_LABEL[m]}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="r-date">
                    Date paid
                  </label>
                  <input id="r-date" name="paid_on" type="date" className="sk-input" required defaultValue={today()} max={today()} />
                </div>
                <div>
                  <label className="label" htmlFor="r-ref">
                    Reference (optional)
                  </label>
                  <input id="r-ref" name="reference" className="sk-input" maxLength={80} placeholder="Bank or POS reference" />
                </div>
              </div>
              <label className="flex min-h-[44px] items-center gap-2 text-sm font-semibold text-brand-slate">
                <input type="checkbox" name="email" value="1" defaultChecked={ready} disabled={!ready} className="h-5 w-5" />
                Email the receipt to the parent
              </label>
              <p className="text-[13px] text-[#4A5A70]">Every payment gets a receipt number you can print or share. Payments parents make online are recorded here automatically.</p>
              <div>
                <SubmitButton>Save payment</SubmitButton>
              </div>
            </ActionForm>
          ) : (
            <Empty>{o?.invoices ? `Nobody owes anything for ${periodName}.` : "Publish this term's invoices first."}</Empty>
          )}
        </Panel>
      </div>
    </AdminPage>
  );
}
