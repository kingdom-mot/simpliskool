import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/PrintButton";
import { ReportCard } from "@/components/ReportCard";
import { requireUser } from "@/lib/auth";
import type { StudentResult } from "@/lib/results";

export const metadata = { title: "Report card" };

export default async function ReportPage(props: { params: Promise<{ student: string; term: string }> }) {
  const { student, term } = await props.params;
  const ok = (v: string) => /^[0-9a-f-]{36}$/i.test(v);
  if (!ok(student) || !ok(term)) notFound();
  const { supabase, memberships } = await requireUser();
  // The database decides: families once released; admins and the class's teachers any time.
  const { data } = await supabase.rpc("student_result", { p_student: student, p_term: term });
  const r = data as StudentResult | null;
  if (!r) notFound();
  const roles = memberships.map((m) => m.role);
  const back = roles.some((x) => ["owner", "admin", "principal"].includes(x))
    ? `/admin/report-cards?term=${term}&student=${student}`
    : roles.includes("teacher")
      ? "/teacher/broadsheet"
      : roles.includes("parent")
        ? `/parent/results?child=${student}&term=${term}`
        : `/student/results?term=${term}`;
  return (
    <div className="min-h-screen bg-brand-cloud px-4 py-6 print:bg-white print:p-0">
      <main id="main" className="mx-auto flex max-w-[860px] flex-col gap-4">
        <div className="no-print flex flex-wrap items-center justify-between gap-3">
          <Link className="s-link text-sm" href={back}>
            Back
          </Link>
          <PrintButton>Print or save as PDF</PrintButton>
        </div>
        <h1 className="sr-only">
          Report card for {r.student.name}
        </h1>
        <ReportCard r={r} />
      </main>
    </div>
  );
}
