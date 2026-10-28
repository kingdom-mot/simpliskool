import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/PrintButton";
import { classLabel } from "@/components/admin";
import { requireUser } from "@/lib/auth";
import { METHOD_LABEL } from "@/lib/fees";
import { naira, TERM_NAME } from "@/lib/format";
import { initials, schoolThemeStyle } from "@/lib/theme";

export const metadata = { title: "Receipt" };

type Pay = {
  id: string;
  school_id: string;
  amount_kobo: number;
  method: string;
  receipt_no: string | null;
  reference: string | null;
  paid_at: string | null;
  created_at: string;
  status: string;
  voided_at: string | null;
  invoices: {
    total_kobo: number;
    paid_kobo: number;
    balance_kobo: number;
    students: { first_name: string; last_name: string; admission_no: string; classes: { name: string; arm: string } | null } | null;
    terms: { term_no: number; academic_sessions: { name: string } | null } | null;
    invoice_lines: { name: string; amount_kobo: number; position: number }[];
  } | null;
  schools: { name: string; address: string | null; phone: string | null; email: string | null; logo_url: string | null; primary_color: string | null; secondary_color: string | null; motto: string | null } | null;
};

const TZ = "Africa/Lagos";

export default async function ReceiptPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase, memberships } = await requireUser();
  const sel = "id, school_id, amount_kobo, method, receipt_no, reference, paid_at, created_at, status, voided_at, invoices(total_kobo, paid_kobo, balance_kobo, students(first_name, last_name, admission_no, classes(name, arm)), terms(term_no, academic_sessions(name)), invoice_lines(name, amount_kobo, position))";
  // Row-level security decides who can see it: the school's finance staff, the child's parents, or the student.
  let res = await supabase.from("payments").select(`${sel}, schools(name, address, phone, email, logo_url, primary_color, secondary_color, motto)`).eq("id", id).maybeSingle<Pay>();
  if (res.error) res = await supabase.from("payments").select(`${sel}, schools(name, address, phone, email, logo_url, primary_color, secondary_color)`).eq("id", id).maybeSingle<Pay>();
  const p = res.data;
  if (!p || !p.invoices?.students || !p.schools) notFound();
  const inv = p.invoices;
  const st = inv.students!;
  const school = p.schools;
  const role = memberships.find((m) => m.school_id === p.school_id)?.role;
  const back = role === "parent" ? "/parent/fees" : role === "student" ? "/student" : "/admin/payments";
  const term = inv.terms ? `${TERM_NAME[inv.terms.term_no]} ${inv.terms.academic_sessions?.name ?? ""}`.trim() : "School fees";
  const paid = new Date(p.paid_at ?? p.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: TZ });
  const cancelled = !!p.voided_at || p.status !== "success";

  return (
    <div style={schoolThemeStyle(school.primary_color, school.secondary_color)} className="min-h-screen bg-brand-cloud px-4 py-6 print:bg-white print:p-0">
      <main id="main" className="mx-auto flex max-w-[680px] flex-col gap-4">
        <div className="no-print flex flex-wrap items-center justify-between gap-3">
          <Link className="s-link text-sm" href={back}>
            Back
          </Link>
          <PrintButton />
        </div>

        <article className="print-area flex flex-col gap-5 rounded-[18px] border border-[#E3EAF3] bg-white p-6 text-brand-slate">
          <header className="flex flex-wrap items-start justify-between gap-4 border-b-4 border-c1 pb-4">
            <div className="flex items-center gap-3">
              {school.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={school.logo_url} alt="" width={56} height={56} className="h-14 w-14 rounded-xl object-contain" />
              ) : (
                <span aria-hidden="true" className="flex h-14 w-14 items-center justify-center rounded-xl bg-c1 text-xl font-extrabold text-white">
                  {initials(school.name)}
                </span>
              )}
              <div>
                <div className="font-heading text-xl font-extrabold text-c1">{school.name}</div>
                {school.motto && <div className="text-sm italic text-[#4A5A70]">{school.motto}</div>}
                <div className="text-xs text-[#4A5A70]">{[school.address, school.phone, school.email].filter(Boolean).join(" · ")}</div>
              </div>
            </div>
            <div className="text-right">
              <h1 className="text-2xl !text-c1">Receipt</h1>
              <div className="font-mono text-base font-bold">{p.receipt_no ?? "—"}</div>
            </div>
          </header>

          {cancelled && (
            <p role="status" className="rounded-xl bg-[#FEF3F2] px-4 py-3 text-sm font-bold text-[#912018]">
              This payment was cancelled by the school. This receipt is not valid.
            </p>
          )}

          <dl className="grid grid-cols-[minmax(0,1fr)] gap-3 text-sm sm:grid-cols-2">
            {[
              ["Received from", `Parent of ${st.first_name} ${st.last_name}`],
              ["Student", `${st.first_name} ${st.last_name} · ${st.admission_no}${st.classes ? ` · ${classLabel(st.classes.name, st.classes.arm)}` : ""}`],
              ["For", term],
              ["Date paid", paid],
              ["Method", `${METHOD_LABEL[p.method] ?? p.method}${p.reference ? ` · Ref ${p.reference}` : ""}`],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs font-bold uppercase tracking-[0.05em] text-[#4A5A70]">{k}</dt>
                <dd className="font-semibold">{v}</dd>
              </div>
            ))}
          </dl>

          <div className="rounded-xl bg-brand-cloud p-4 text-center">
            <div className="text-xs font-bold uppercase tracking-[0.05em] text-[#4A5A70]">Amount received</div>
            <div className={`font-heading text-[34px] font-black text-c1 ${cancelled ? "line-through" : ""}`}>{naira(p.amount_kobo)}</div>
          </div>

          {inv.invoice_lines.length > 0 && (
            <table className="tbl">
              <caption className="mb-2 text-left text-sm font-bold">{term} bill</caption>
              <thead>
                <tr>
                  <th scope="col">Item</th>
                  <th scope="col" className="text-right">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...inv.invoice_lines]
                  .sort((a, b) => a.position - b.position)
                  .map((l, i) => (
                    <tr key={i}>
                      <td>{l.name}</td>
                      <td className="text-right">{naira(l.amount_kobo)}</td>
                    </tr>
                  ))}
                <tr>
                  <th scope="row">Total bill</th>
                  <td className="text-right font-bold">{naira(inv.total_kobo)}</td>
                </tr>
                <tr>
                  <th scope="row">Paid so far</th>
                  <td className="text-right font-bold">{naira(inv.paid_kobo)}</td>
                </tr>
                <tr>
                  <th scope="row">Balance</th>
                  <td className="text-right font-extrabold">{inv.balance_kobo > 0 ? naira(inv.balance_kobo) : "Paid in full"}</td>
                </tr>
              </tbody>
            </table>
          )}

          <footer className="border-t border-[#E3EAF3] pt-3 text-xs text-[#4A5A70]">
            Issued by {school.name} with Simpliskool. Keep this receipt for your records.
          </footer>
        </article>
      </main>
    </div>
  );
}
