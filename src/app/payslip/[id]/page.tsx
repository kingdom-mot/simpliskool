import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/PrintButton";
import { requireUser } from "@/lib/auth";
import { naira } from "@/lib/format";
import { parseItems } from "@/lib/payroll";
import { initials, schoolThemeStyle } from "@/lib/theme";

export const metadata = { title: "Payslip" };

type Slip = { id: string; name: string; job_title: string | null; basic_kobo: number; allowances: unknown; deductions: unknown; gross_kobo: number; pension_kobo: number; paye_kobo: number; net_kobo: number; bank_name: string | null; account_no: string | null; payroll_runs: { month: string; status: string } | null; schools: { name: string; address: string | null; logo_url: string | null; primary_color: string | null; secondary_color: string | null } | null };

/** A payslip: the payroll team any time, the staff member once the month is paid (row-level security decides). */
export default async function PayslipPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase, memberships } = await requireUser();
  const { data: s } = await supabase.from("payslips").select("id, name, job_title, basic_kobo, allowances, deductions, gross_kobo, pension_kobo, paye_kobo, net_kobo, bank_name, account_no, payroll_runs(month, status), schools(name, address, logo_url, primary_color, secondary_color)").eq("id", id).maybeSingle<Slip>();
  if (!s || !s.schools || !s.payroll_runs) notFound();
  const month = new Date(`${s.payroll_runs.month}T12:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const back = memberships.some((m) => m.role === "owner" || m.role === "bursar") ? `/admin/payroll?month=${s.payroll_runs.month.slice(0, 7)}` : "/dashboard";
  const lines: [string, string][] = [
    ["Basic salary", naira(s.basic_kobo)],
    ...parseItems(s.allowances).map((a) => [a.name, naira(a.kobo)] as [string, string]),
    ["Gross pay", naira(s.gross_kobo)],
    ...parseItems(s.deductions).map((d) => [d.name, `−${naira(d.kobo)}`] as [string, string]),
    ...(s.pension_kobo ? [["Pension", `−${naira(s.pension_kobo)}`] as [string, string]] : []),
    ...(s.paye_kobo ? [["PAYE tax", `−${naira(s.paye_kobo)}`] as [string, string]] : []),
  ];
  return (
    <div style={schoolThemeStyle(s.schools.primary_color, s.schools.secondary_color)} className="min-h-screen bg-brand-cloud px-4 py-6 print:bg-white print:p-0">
      <main id="main" className="mx-auto flex max-w-[640px] flex-col gap-4">
        <div className="no-print flex items-center justify-between gap-3">
          <Link className="s-link text-sm" href={back}>
            Back
          </Link>
          <PrintButton />
        </div>
        <article className="print-area flex flex-col gap-4 rounded-[18px] border border-[#E3EAF3] bg-white p-6 text-brand-slate">
          <header className="flex items-center justify-between gap-3 border-b-4 border-c1 pb-4">
            <div className="flex items-center gap-3">
              {s.schools.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.schools.logo_url} alt="" width={52} height={52} className="h-[52px] w-[52px] rounded-xl object-contain" />
              ) : (
                <span aria-hidden="true" className="flex h-[52px] w-[52px] items-center justify-center rounded-xl bg-c1 text-lg font-extrabold text-white">
                  {initials(s.schools.name)}
                </span>
              )}
              <div>
                <div className="font-heading text-lg font-extrabold text-c1">{s.schools.name}</div>
                <div className="text-xs text-[#4A5A70]">{s.schools.address}</div>
              </div>
            </div>
            <h1 className="text-xl !text-c1">Payslip · {month}</h1>
          </header>
          <p className="font-bold">
            {s.name}
            {s.job_title ? ` · ${s.job_title}` : ""}
          </p>
          <dl className="flex flex-col text-sm">
            {lines.map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-[#EEF3F9] py-2">
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
            <div className="flex justify-between py-2 text-lg font-extrabold text-c1">
              <dt>Net pay</dt>
              <dd>{naira(s.net_kobo)}</dd>
            </div>
          </dl>
          {s.account_no && (
            <p className="text-xs text-[#4A5A70]">
              Paid to {s.bank_name} ····{s.account_no.slice(-4)}
            </p>
          )}
        </article>
      </main>
    </div>
  );
}
