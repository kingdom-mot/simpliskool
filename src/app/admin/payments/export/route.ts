import { requireSchool } from "@/lib/auth";
import { FINANCE_ROLES, METHOD_LABEL, loadTerms, termLabel } from "@/lib/fees";

type Row = Record<string, unknown>;

function csv(rows: (string | number | null)[][]) {
  const cell = (v: string | number | null) => {
    let s = v === null || v === undefined ? "" : String(v);
    // Stop spreadsheet formulas sneaking in through names or references.
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
}
const amt = (kobo: unknown) => (Number(kobo ?? 0) / 100).toFixed(2);
const date = (iso: unknown) => (iso ? new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date(String(iso))) : "");

export async function GET(req: Request) {
  const url = new URL(req.url);
  const { supabase, school } = await requireSchool(FINANCE_ROLES);
  const { term } = await loadTerms(supabase, school.id, url.searchParams.get("term") ?? undefined);
  if (!term) return new Response("No term", { status: 404 });
  const cls = url.searchParams.get("class");
  const classId = cls && /^[0-9a-f-]{36}$/i.test(cls) ? cls : null;
  const kind = url.searchParams.get("kind") ?? "payments";
  const { data } = await supabase.rpc("fee_overview", { p_school: school.id, p_term: term.id, p_class: classId });
  if (!data) return new Response("Not allowed", { status: 403 });
  const o = data as { payments: Row[]; defaulters: Row[]; invoice_list: Row[] };

  let rows: (string | number | null)[][];
  if (kind === "defaulters") {
    rows = [["Student", "Admission no", "Class", "This term (NGN)", "Earlier terms (NGN)", "Total owed (NGN)", "Last reminder"]];
    for (const d of o.defaulters) rows.push([String(d.name), String(d.admission_no), (d.class as string) ?? "", amt(d.cur), amt(d.prev), amt(d.total), date(d.last_reminder)]);
  } else if (kind === "invoices") {
    rows = [["Student", "Admission no", "Class", "Total (NGN)", "Paid (NGN)", "Balance (NGN)"]];
    for (const i of o.invoice_list) rows.push([String(i.name), String(i.admission_no), (i.class as string) ?? "", amt(i.total), amt(i.paid), amt(i.balance)]);
  } else {
    rows = [["Date", "Student", "Class", "Method", "Reference", "Receipt", "Amount (NGN)", "Status", "Recorded by"]];
    for (const p of o.payments)
      rows.push([date(p.at), String(p.name), (p.class as string) ?? "", METHOD_LABEL[String(p.method)] ?? String(p.method), (p.reference as string) ?? "", (p.receipt as string) ?? "", amt(p.amount), p.voided ? `Cancelled: ${p.void_reason ?? ""}` : "Received", (p.by as string) ?? ""]);
  }
  const name = `${school.slug}-${kind}-${termLabel(term).replace(/[^A-Za-z0-9]+/g, "-")}.csv`.toLowerCase();
  return new Response(csv(rows), {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${name}"`, "cache-control": "no-store" },
  });
}
