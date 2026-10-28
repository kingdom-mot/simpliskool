import Link from "next/link";
import { MobileShell } from "@/components/MobileShell";
import { Empty } from "@/components/ui";
import { requireSchool } from "@/lib/auth";
import { naira, TERM_NAME } from "@/lib/format";
import { PARENT_TABS } from "@/lib/nav";

export const metadata = { title: "Documents" };

type Kid = { id: string; first_name: string };
type Pay = { id: string; amount_kobo: number; receipt_no: string | null; paid_at: string | null; created_at: string; invoices: { student_id: string; terms: { term_no: number; academic_sessions: { name: string } | null } | null } | null };
type Card = { student_id: string; term_id: string; released_at: string; terms: { term_no: number; academic_sessions: { name: string } | null } | null };
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" });
const term = (t: { term_no: number; academic_sessions: { name: string } | null } | null) => (t ? `${TERM_NAME[t.term_no]} ${t.academic_sessions?.name ?? ""}`.trim() : "");

export default async function ParentDocuments(props: { searchParams: Promise<{ tab?: string }> }) {
  const sp = await props.searchParams;
  const tab = sp.tab === "reports" ? "reports" : "receipts";
  const { supabase, school, user } = await requireSchool(["parent"]);
  const { data: rows } = await supabase.from("guardians").select("students(id, first_name)").eq("school_id", school.id).eq("user_id", user.id).returns<{ students: Kid | null }[]>();
  const kids = (rows ?? []).map((r) => r.students).filter((k): k is Kid => !!k);
  const ids = kids.map((k) => k.id);
  const name = new Map(kids.map((k) => [k.id, k.first_name]));
  const [{ data: pays }, { data: cards }] = ids.length
    ? await Promise.all([
        supabase.from("payments").select("id, amount_kobo, receipt_no, paid_at, created_at, invoices!inner(student_id, terms(term_no, academic_sessions(name)))").in("invoices.student_id", ids).eq("status", "success").order("created_at", { ascending: false }).limit(100).returns<Pay[]>(),
        supabase.from("report_cards").select("student_id, term_id, released_at, terms(term_no, academic_sessions(name))").in("student_id", ids).not("released_at", "is", null).order("released_at", { ascending: false }).returns<Card[]>(),
      ])
    : [{ data: [] as Pay[] }, { data: [] as Card[] }];

  return (
    <MobileShell school={school} title="Documents" tabs={PARENT_TABS} active="fees">
      <nav aria-label="Documents" className="grid grid-cols-2 gap-1.5">
        {[
          ["receipts", "Receipts"],
          ["reports", "Report cards"],
        ].map(([k, l]) => (
          <Link key={k} href={`/parent/documents?tab=${k}`} aria-current={tab === k ? "page" : undefined} className={`flex min-h-[44px] items-center justify-center rounded-xl border-[1.5px] text-sm font-bold ${tab === k ? "border-c1 bg-c1 text-white" : "border-[#DCE5F0] bg-white text-brand-slate"}`}>
            {l}
          </Link>
        ))}
      </nav>
      {tab === "receipts" ? (
        pays?.length ? (
          <ul className="flex flex-col gap-2">
            {pays.map((p) => (
              <li key={p.id}>
                <Link href={`/receipt/${p.id}`} className="flex min-h-[60px] items-center justify-between gap-3 rounded-[16px] border border-[#E3EAF3] bg-white p-3 hover:border-c2">
                  <span>
                    <span className="block font-bold text-brand-slate">
                      Receipt {p.receipt_no} · {naira(p.amount_kobo)}
                    </span>
                    <span className="text-[13px] text-[#4A5A70]">
                      {name.get(p.invoices?.student_id ?? "")} · {term(p.invoices?.terms ?? null)} · {day(p.paid_at ?? p.created_at)}
                    </span>
                  </span>
                  <span className="text-sm font-bold text-c1">Open</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No receipts yet. They appear here after each payment.</Empty>
        )
      ) : cards?.length ? (
        <ul className="flex flex-col gap-2">
          {cards.map((c) => (
            <li key={c.student_id + c.term_id}>
              <Link href={`/report/${c.student_id}/${c.term_id}`} className="flex min-h-[60px] items-center justify-between gap-3 rounded-[16px] border border-[#E3EAF3] bg-white p-3 hover:border-c2">
                <span>
                  <span className="block font-bold text-brand-slate">
                    {name.get(c.student_id)}&apos;s report card
                  </span>
                  <span className="text-[13px] text-[#4A5A70]">
                    {term(c.terms)} · released {day(c.released_at)}
                  </span>
                </span>
                <span className="text-sm font-bold text-c1">Open</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>No report cards yet. They appear here when the school releases results.</Empty>
      )}
      <p className="text-[13px] text-[#4A5A70]">Open a document, then use Print or Save as PDF to keep a copy or share it on WhatsApp. Copies are also in your email.</p>
    </MobileShell>
  );
}
