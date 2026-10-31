import { requirePlatform } from "@/lib/platform";
import { csvCell } from "@/lib/platform-data";
import { onlinePayments, rangeStart, type Range } from "@/lib/platform-money";

/** Online payments in the chosen period, for Excel. */
export async function GET(req: Request) {
  const ctx = await requirePlatform("payments");
  const r = new URL(req.url).searchParams.get("range");
  const range: Range = r === "30" || r === "term" ? r : "week";
  const rows = await onlinePayments(ctx.admin, rangeStart(range, Date.now()), 5000);
  const n = (k: number) => (k / 100).toFixed(2);
  const lines = [
    ["Time", "Reference", "School", "Paid by", "Channel", "Fee paid (NGN)", "Paystack charge (NGN)", "To the school (NGN)", "Status"],
    ...rows.map((x) => [x.at, x.reference, x.school, x.payer, x.channel ?? "", n(x.amount), n(x.charge), x.status === "Paid" ? n(x.amount - x.charge) : "0.00", x.status]),
  ];
  return new Response("﻿" + lines.map((l) => l.map(csvCell).join(",")).join("\r\n"), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="simpliskool-payments-${range}.csv"` } });
}
