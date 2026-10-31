import Link from "next/link";
import { Flash } from "@/components/Flash";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Box, LinkTabs, money, Scroll, Stat, SuperShell } from "@/components/super";
import { Empty, Pill } from "@/components/ui";
import { listDisputes, listSettlements, paystackReady, paystackTestMode } from "@/lib/paystack";
import { lagosTime, requirePlatform } from "@/lib/platform";
import { demoSchoolIds, notDemo, nowMs, shortDay } from "@/lib/platform-data";
import { onlinePayments, RANGE_LABEL, rangeStart, type Range } from "@/lib/platform-money";
import { askNewAccount, declineRefund, refundPayment, sendDisputeEvidence } from "../actions";

export const metadata = { title: "Payments and payouts — Simpliskool back office" };

const OPEN_DISPUTE = ["awaiting-merchant-feedback", "awaiting-bank-feedback", "pending"];

export default async function SuperPayments(props: { searchParams: Promise<{ tab?: string; range?: string }> }) {
  const sp = await props.searchParams;
  const ctx = await requirePlatform("payments");
  const now = nowMs();
  const range: Range = sp.range === "30" || sp.range === "term" ? sp.range : "week";
  const tab = sp.tab === "po" || sp.tab === "ds" ? sp.tab : "tx";
  const from = rangeStart(range, now);
  const to = new Date(now).toISOString();
  const demo = await demoSchoolIds(ctx.admin);
  const [rows, { data: refunds }, disputes] = await Promise.all([
    onlinePayments(ctx.admin, from),
    notDemo(ctx.admin.from("refund_requests").select("id, school_id, amount_kobo, reason, status, created_at, decided_at, decline_note, schools(name), payments(paystack_reference, receipt_no), profiles!refund_requests_requested_by_fkey(full_name)"), demo)
      .order("created_at", { ascending: false })
      .limit(30)
      .returns<{ id: string; school_id: string; amount_kobo: number; reason: string; status: string; created_at: string; decided_at: string | null; decline_note: string | null; schools: { name: string } | null; payments: { paystack_reference: string | null; receipt_no: string | null } | null; profiles: { full_name: string | null } | null }[]>(),
    paystackReady() ? listDisputes(new Date(now - 90 * 86_400_000).toISOString(), to) : Promise.resolve({ ok: false as const, error: "Paystack isn't set up (PAYSTACK_SECRET_KEY)." }),
  ]);
  const paid = rows.filter((r) => r.status === "Paid");
  const total = paid.reduce((a, r) => a + r.amount, 0);
  const charges = paid.reduce((a, r) => a + r.charge, 0);
  const failed = rows.filter((r) => r.status === "Failed").length;
  const asked = (refunds ?? []).filter((r) => r.status === "asked");
  const openDisputes = disputes.ok ? disputes.data.filter((d) => OPEN_DISPUTE.includes(d.status)) : [];
  const money2 = ctx.can("money");
  const href = (o: Record<string, string>) => `/super/payments?${new URLSearchParams({ tab, range, ...o })}`;
  const STATUS = { Paid: "good", Refunded: "info", Cancelled: "info", Failed: "bad" } as const;

  let body: React.ReactNode;
  if (tab === "tx") {
    body = rows.length ? (
      <Scroll label="Payments">
        <table className="tbl min-w-[980px]">
          <caption className="sr-only">Online payments, newest first</caption>
          <thead>
            <tr>
              <th scope="col">Time</th>
              <th scope="col">Reference</th>
              <th scope="col">School</th>
              <th scope="col">Paid by</th>
              <th scope="col" className="!text-right">
                Fee paid
              </th>
              <th scope="col" className="!text-right">
                Paystack charge
              </th>
              <th scope="col" className="!text-right">
                To the school
              </th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 200).map((r) => (
              <tr key={`${r.id}-${r.status}`}>
                <td className="whitespace-nowrap">{lagosTime(r.at)}</td>
                <td className="font-mono text-[13px]">{r.reference}</td>
                <td className="font-bold text-[#173B70]">{r.school}</td>
                <td className="text-[13px]">
                  {r.payer}
                  {r.channel ? ` · ${r.channel}` : ""}
                </td>
                <td className="text-right">{money(r.amount)}</td>
                <td className="text-right">{r.charge ? money(r.charge) : "—"}</td>
                <td className="text-right font-extrabold">{r.status === "Paid" ? money(r.amount - r.charge) : "—"}</td>
                <td>
                  <Pill kind={STATUS[r.status]}>{r.status}</Pill>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Scroll>
    ) : (
      <Empty>No online payments in this period.</Empty>
    );
  } else if (tab === "po") {
    const res = paystackReady() ? await listSettlements(from, to) : ({ ok: false, error: "Paystack isn't set up (PAYSTACK_SECRET_KEY)." } as const);
    const codes = res.ok ? [...new Set(res.data.map((s) => s.subaccount?.subaccount_code).filter((c): c is string => !!c))] : [];
    const { data: payouts } = codes.length
      ? await ctx.admin.from("school_payouts").select("school_id, paystack_subaccount, bank_name, account_no, schools(name)").in("paystack_subaccount", codes).returns<{ school_id: string; paystack_subaccount: string; bank_name: string; account_no: string; schools: { name: string } | null }[]>()
      : { data: [] as { school_id: string; paystack_subaccount: string; bank_name: string; account_no: string; schools: { name: string } | null }[] };
    const bySub = new Map((payouts ?? []).map((p) => [p.paystack_subaccount, p]));
    body = !res.ok ? (
      <Empty>Payouts couldn&apos;t be loaded from Paystack: {res.error}</Empty>
    ) : !res.data.length ? (
      <Empty>No payouts in this period.{paystackTestMode() ? " (Paystack test mode doesn't make real payouts.)" : ""}</Empty>
    ) : (
      <Scroll label="Payouts to schools">
        <table className="tbl min-w-[860px]">
          <caption className="sr-only">Payouts to schools</caption>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">School</th>
              <th scope="col">Account</th>
              <th scope="col" className="!text-right">
                Amount
              </th>
              <th scope="col">Status</th>
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {res.data.map((s) => {
              const p = s.subaccount?.subaccount_code ? bySub.get(s.subaccount.subaccount_code) : undefined;
              const bad = /fail|revers/i.test(s.status);
              const name = p?.schools?.name ?? s.subaccount?.business_name ?? "Dream Savvy (main account)";
              return (
                <tr key={String(s.id)}>
                  <td className="whitespace-nowrap">{shortDay(s.settlement_date ?? s.createdAt)}</td>
                  <td className="font-bold text-[#173B70]">{name}</td>
                  <td className="text-[13px]">{p ? `${p.bank_name} ••${p.account_no.slice(-4)}` : s.subaccount?.account_number ? `••${s.subaccount.account_number.slice(-4)}` : "—"}</td>
                  <td className="text-right font-extrabold">{money(Number(s.effective_amount ?? s.total_amount))}</td>
                  <td>
                    <Pill kind={bad ? "bad" : /success|paid/i.test(s.status) ? "good" : "warn"}>{bad ? "Failed" : /success|paid/i.test(s.status) ? "Paid" : "Sending"}</Pill>
                  </td>
                  <td>
                    {bad && p && money2 && (
                      <ActionForm action={askNewAccount}>
                        <input type="hidden" name="school_id" value={p.school_id} />
                        <input type="hidden" name="why" value="the bank couldn't pay into it" />
                        <SubmitButton className="s-btn2 !min-h-[40px] !px-3 !py-1.5" pending="Sending…">
                          Ask for new account<span className="sr-only"> for {name}</span>
                        </SubmitButton>
                      </ActionForm>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Scroll>
    );
  } else {
    body = (
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 xl:grid-cols-2">
        <Box id="cb-h" title={`Chargebacks${openDisputes.length ? ` (${openDisputes.length} open)` : ""}`}>
          {!disputes.ok ? (
            <Empty>Chargebacks couldn&apos;t be loaded from Paystack: {disputes.error}</Empty>
          ) : !disputes.data.length ? (
            <Empty>No chargebacks in the last 90 days.</Empty>
          ) : (
            <ul className="flex flex-col gap-3">
              {disputes.data.map((d) => {
                const open = OPEN_DISPUTE.includes(d.status);
                const due = d.dueAt ?? d.due_at;
                return (
                  <li key={String(d.id)} className={`flex flex-col gap-2 rounded-xl p-3.5 ${open ? "border-2 border-[#F3C7C3]" : "border border-[#E3EAF3]"}`}>
                    <div className="flex flex-wrap justify-between gap-2">
                      <strong className="text-[#173B70]">
                        {money(Number(d.transaction?.amount ?? d.refund_amount ?? 0))} · {d.transaction?.reference ?? "No reference"}
                      </strong>
                      <Pill kind={open ? "bad" : "info"}>{open ? (due ? `Reply by ${shortDay(due)}` : "Open") : d.resolution ? `Closed · ${d.resolution.replace(/-/g, " ")}` : "Closed"}</Pill>
                    </div>
                    {d.message?.body && <p className="text-sm text-[#4A5A70]">Bank says: &ldquo;{d.message.body}&rdquo;</p>}
                    {open && money2 && d.transaction?.reference && (
                      <ActionForm action={sendDisputeEvidence}>
                        <input type="hidden" name="dispute_id" value={String(d.id)} />
                        <input type="hidden" name="reference" value={d.transaction.reference} />
                        <SubmitButton className="s-btn !min-h-[40px]" pending="Sending…">
                          Send receipt and student record as proof
                        </SubmitButton>
                      </ActionForm>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <p className="text-sm text-[#4A5A70]">If a chargeback is lost, Paystack takes the money back from the school&apos;s payouts.</p>
        </Box>
        <Box id="rf-h" title="Refunds asked for by schools">
          {refunds?.length ? (
            <ul className="flex flex-col">
              {refunds.map((r) => (
                <li key={r.id} className="flex flex-col gap-2 border-t border-[#EEF3F9] py-3 first:border-t-0">
                  <div className="flex flex-wrap justify-between gap-2">
                    <span>
                      <strong className="text-[#173B70]">{r.schools?.name}</strong>
                      <span className="block text-[13px] text-[#4A5A70]">
                        {r.reason} · {money(Number(r.amount_kobo))} · receipt {r.payments?.receipt_no ?? r.payments?.paystack_reference} · asked by {r.profiles?.full_name ?? "the school"} {shortDay(r.created_at)}
                      </span>
                    </span>
                    {r.status !== "asked" && <Pill kind={r.status === "refunded" ? "good" : "info"}>{r.status === "refunded" ? `Refunded ${shortDay(r.decided_at)}` : "Declined"}</Pill>}
                  </div>
                  {r.status === "asked" && money2 && (
                    <div className="flex flex-wrap items-end gap-2">
                      <ActionForm action={refundPayment}>
                        <input type="hidden" name="request_id" value={r.id} />
                        <SubmitButton className="s-btn !min-h-[40px]" pending="Refunding…">
                          Refund parent<span className="sr-only"> for {r.schools?.name}</span>
                        </SubmitButton>
                      </ActionForm>
                      <ActionForm action={declineRefund} className="flex flex-wrap items-end gap-2">
                        <input type="hidden" name="request_id" value={r.id} />
                        <div>
                          <label className="label" htmlFor={`dn-${r.id}`}>
                            Why decline?
                          </label>
                          <input id={`dn-${r.id}`} name="note" className="sk-input !min-h-[40px]" maxLength={300} />
                        </div>
                        <SubmitButton className="s-btn2 !min-h-[40px]" pending="Saving…">
                          Decline
                        </SubmitButton>
                      </ActionForm>
                    </div>
                  )}
                  {r.status === "declined" && r.decline_note && <p className="text-[13px] text-[#4A5A70]">Declined: {r.decline_note}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No refund requests yet. Bursars ask for them on the Payments page of their portal.</Empty>
          )}
          <p className="text-sm text-[#4A5A70]">A refund comes out of the school&apos;s next payout. Paystack&apos;s charge isn&apos;t returned.</p>
        </Box>
      </div>
    );
  }

  return (
    <SuperShell
      ctx={ctx}
      active="payments"
      title="Payments and payouts"
      sub="Every fee paid online goes through Dream Savvy's Paystack account and is split to the school."
      actions={
        <a className="s-btn2" href={`/super/payments/export?range=${range}`}>
          Export (CSV)
        </a>
      }
    >
      <Flash />
      <LinkTabs label="Dates" current={range} tabs={(["week", "30", "term"] as const).map((r) => [r, RANGE_LABEL[r], href({ range: r })])} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Parents paid" value={money(total)} sub={`${paid.length.toLocaleString("en-NG")} payment${paid.length === 1 ? "" : "s"} · ${RANGE_LABEL[range].toLowerCase()}`} />
        <Stat label="Paystack charges" value={money(charges)} sub="taken from each school's share" />
        <Stat tone="good" label="To schools" value={money(total - charges)} />
        <Stat tone={failed + asked.length + openDisputes.length ? "bad" : "plain"} label="Problems" value={String(failed + asked.length + openDisputes.length)} sub={`${failed} failed · ${asked.length} refund${asked.length === 1 ? "" : "s"} asked · ${openDisputes.length} chargeback${openDisputes.length === 1 ? "" : "s"}`} />
      </div>
      <LinkTabs
        label="Payments view"
        current={tab}
        tabs={[
          ["tx", "Payments", href({ tab: "tx" })],
          ["po", "Payouts to schools", href({ tab: "po" })],
          ["ds", `Disputes and refunds${asked.length + openDisputes.length ? ` (${asked.length + openDisputes.length})` : ""}`, href({ tab: "ds" })],
        ]}
      />
      {body}
      {!money2 && (
        <p className="text-sm text-[#4A5A70]">
          Your role can see payments. Refunds and chargebacks are handled by finance. <Link href="/super" className="s-link">Back to overview</Link>
        </p>
      )}
    </SuperShell>
  );
}
