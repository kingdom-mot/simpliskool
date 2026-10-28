import { MobileShell } from "@/components/MobileShell";
import { MobileResults, type ReleasedTerm } from "@/components/MobileResults";
import { Empty } from "@/components/ui";
import { requireSchool } from "@/lib/auth";
import { STUDENT_TABS } from "@/lib/nav";
import type { StudentResult } from "@/lib/results";

export const metadata = { title: "My results" };

export default async function StudentResults(props: { searchParams: Promise<{ term?: string }> }) {
  const sp = await props.searchParams;
  const { supabase, school, user } = await requireSchool(["student"]);
  const { data: me } = await supabase.from("students").select("id").eq("school_id", school.id).eq("user_id", user.id).maybeSingle<{ id: string }>();
  let terms: ReleasedTerm[] = [];
  let r: StudentResult | null = null;
  let termId: string | null = null;
  if (me) {
    terms = ((await supabase.rpc("released_terms", { p_student: me.id })).data as ReleasedTerm[] | null) ?? [];
    termId = terms.find((t) => t.id === sp.term)?.id ?? terms[0]?.id ?? null;
    if (termId) r = (await supabase.rpc("student_result", { p_student: me.id, p_term: termId })).data as StudentResult | null;
  }
  return (
    <MobileShell school={school} title="My results" tabs={STUDENT_TABS} active="results">
      {!me ? <Empty>Your account isn&apos;t linked to a student record. Please tell your class teacher.</Empty> : <MobileResults r={r} terms={terms} termId={termId} studentId={me.id} termHref={(id) => `/student/results?term=${id}`} />}
    </MobileShell>
  );
}
