import Link from "next/link";
import { MobileShell } from "@/components/MobileShell";
import { MobileResults, type ReleasedTerm } from "@/components/MobileResults";
import { classLabel } from "@/components/admin";
import { Empty } from "@/components/ui";
import { requireSchool } from "@/lib/auth";
import { PARENT_TABS } from "@/lib/nav";
import type { StudentResult } from "@/lib/results";

export const metadata = { title: "Results" };

export default async function ParentResults(props: { searchParams: Promise<{ child?: string; term?: string }> }) {
  const sp = await props.searchParams;
  const { supabase, school, user } = await requireSchool(["parent"]);
  const { data: rows } = await supabase
    .from("guardians")
    .select("students(id, first_name, last_name, classes(name, arm))")
    .eq("school_id", school.id)
    .eq("user_id", user.id)
    .returns<{ students: { id: string; first_name: string; last_name: string; classes: { name: string; arm: string } | null } | null }[]>();
  const kids = (rows ?? []).map((r) => r.students).filter((k): k is NonNullable<typeof k> => !!k).sort((a, b) => a.first_name.localeCompare(b.first_name));
  const kid = kids.find((k) => k.id === sp.child) ?? kids[0];
  let terms: ReleasedTerm[] = [];
  let r: StudentResult | null = null;
  let termId: string | null = null;
  if (kid) {
    terms = ((await supabase.rpc("released_terms", { p_student: kid.id })).data as ReleasedTerm[] | null) ?? [];
    termId = terms.find((t) => t.id === sp.term)?.id ?? terms[0]?.id ?? null;
    if (termId) r = (await supabase.rpc("student_result", { p_student: kid.id, p_term: termId })).data as StudentResult | null;
  }
  return (
    <MobileShell school={school} title="Results" tabs={PARENT_TABS} active="results">
      {!kid ? (
        <Empty>No children are linked to your account yet. Please contact the school.</Empty>
      ) : (
        <>
          {kids.length > 1 && (
            <nav aria-label="Child" className="flex gap-2 overflow-x-auto pb-0.5">
              {kids.map((k) => (
                <Link
                  key={k.id}
                  href={`/parent/results?child=${k.id}`}
                  aria-current={k.id === kid.id ? "true" : undefined}
                  className={`flex min-h-[44px] flex-none items-center rounded-full border-[1.5px] px-4 text-sm ${k.id === kid.id ? "border-c1 bg-c1 font-extrabold text-white" : "border-[#DCE5F0] bg-white font-semibold text-brand-slate"}`}
                >
                  {k.first_name}
                  {k.classes ? ` · ${classLabel(k.classes.name, k.classes.arm)}` : ""}
                </Link>
              ))}
            </nav>
          )}
          <MobileResults r={r} terms={terms} termId={termId} studentId={kid.id} termHref={(id) => `/parent/results?child=${kid.id}&term=${id}`} />
        </>
      )}
    </MobileShell>
  );
}
