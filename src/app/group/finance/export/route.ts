import { requireGroup } from "@/lib/group";
import { groupMoney } from "@/lib/group-finance";
import { branchStats } from "@/lib/group-stats";

const csv = (rows: (string | number)[][]) => rows.map((r) => r.map((c) => (/[",\n]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : String(c))).join(",")).join("\r\n");
const n = (kobo: number) => (kobo / 100).toFixed(2);

/** Fees by branch and the list of balances, for Excel. */
export async function GET(req: Request) {
  const ctx = await requireGroup("finance");
  const b = new URL(req.url).searchParams.get("branch");
  const ids = b && ctx.ids.includes(b) ? [b] : ctx.ids;
  const stats = (await branchStats(ctx)).filter((x) => ids.includes(x.id));
  const { debtors } = await groupMoney(ctx, ids);
  const body = csv([
    ["Fees by branch"],
    ["Branch", "Term", "Billed (NGN)", "Collected (NGN)", "Outstanding (NGN)", "Collected %", "Students owing"],
    ...stats.map((s) => [s.name, s.term ?? "", n(s.billed), n(s.collected), n(s.billed - s.collected), s.billed ? Math.round((s.collected / s.billed) * 100) : 0, s.owing]),
    [],
    ["Balances"],
    ["Student", "Branch", "Class", "Owing (NGN)", "Last paid"],
    ...debtors.map((d) => [d.name, d.branch, d.cls, n(d.owing), d.lastPaid ? d.lastPaid.slice(0, 10) : "Never this term"]),
  ]);
  return new Response("﻿" + body, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${ctx.group.name.replace(/[^A-Za-z0-9]+/g, "-")}-fees.csv"` } });
}
