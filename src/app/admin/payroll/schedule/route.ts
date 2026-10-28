import { requireSchool } from "@/lib/auth";

/** Bank schedule for an approved or paid run: who to pay, how much, into which account. */
export async function GET(req: Request) {
  const run = new URL(req.url).searchParams.get("run") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(run)) return new Response("Not found", { status: 404 });
  const { supabase, school } = await requireSchool(["owner", "bursar"]);
  const { data: r } = await supabase.from("payroll_runs").select("month, status").eq("id", run).eq("school_id", school.id).maybeSingle<{ month: string; status: string }>();
  if (!r || r.status === "draft") return new Response("Approve the payroll first", { status: 409 });
  const { data } = await supabase.from("payslips").select("name, bank_name, account_no, account_name, net_kobo, pension_kobo, employer_pension_kobo, paye_kobo").eq("run_id", run).order("name").returns<{ name: string; bank_name: string | null; account_no: string | null; account_name: string | null; net_kobo: number; pension_kobo: number; employer_pension_kobo: number; paye_kobo: number }[]>();
  const cell = (v: string | number | null) => {
    let s = v === null ? "" : String(v);
    if (/^[=+\-@]/.test(s)) s = `'${s}`;
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const amt = (k: number) => (k / 100).toFixed(2);
  const rows = [["Staff", "Bank", "Account number", "Account name", "Net pay (NGN)", "Staff pension (NGN)", "School pension (NGN)", "PAYE (NGN)"], ...(data ?? []).map((x) => [x.name, x.bank_name ?? "", x.account_no ?? "", x.account_name ?? "", amt(x.net_kobo), amt(x.pension_kobo), amt(x.employer_pension_kobo), amt(x.paye_kobo)])];
  const csv = "﻿" + rows.map((l) => l.map(cell).join(",")).join("\r\n");
  return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${school.slug}-payroll-${r.month.slice(0, 7)}.csv"`, "cache-control": "no-store" } });
}
