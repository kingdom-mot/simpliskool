import { notFound } from "next/navigation";
import { AdminPage, Panel, classLabel, requireAdminPage } from "@/components/admin";
import { ScoreSheet } from "@/components/ScoreSheet";
import { Empty } from "@/components/ui";
import { loadTerms, termLabel } from "@/lib/fees";
import { RESULTS_ADMIN } from "@/lib/results";
import { loadSheet } from "@/lib/score-sheet";

export const metadata = { title: "Enter scores" };

export default async function AdminScores(props: { searchParams: Promise<{ cs?: string; term?: string }> }) {
  const sp = await props.searchParams;
  const ctx = await requireAdminPage(RESULTS_ADMIN);
  const { supabase, school } = ctx;
  if (!sp.cs || !/^[0-9a-f-]{36}$/i.test(sp.cs)) notFound();
  const { data: cs } = await supabase
    .from("class_subjects")
    .select("id, class_id, classes(name, arm), subjects(name), profiles(full_name)")
    .eq("id", sp.cs)
    .eq("school_id", school.id)
    .maybeSingle<{ id: string; class_id: string; classes: { name: string; arm: string } | null; subjects: { name: string } | null; profiles: { full_name: string | null } | null }>();
  if (!cs) notFound();
  const { term } = await loadTerms(supabase, school.id, sp.term);
  if (!term) notFound();
  const sheet = await loadSheet(supabase, school.id, cs.id, cs.class_id, term.id);
  const label = `${classLabel(cs.classes?.name ?? "", cs.classes?.arm ?? "")} · ${cs.subjects?.name ?? ""}`;
  const back = `/admin/results?${new URLSearchParams({ class: cs.class_id, term: term.id })}`;

  return (
    <AdminPage ctx={ctx} active="results" crumb={[{ label: "Results", href: back }]} title={`${label} scores`}>
      <p className="-mt-2 text-sm text-[#4A5A70]">
        {termLabel(term)} · Subject teacher: {cs.profiles?.full_name?.trim() || "none set"}. Changes you make here are saved with your name.
      </p>
      <Panel id="sheet-h" title="Scores">
        {sheet.students.length ? (
          <ScoreSheet csId={cs.id} termId={term.id} title={`${label} scores, ${termLabel(term)}`} students={sheet.students} parts={sheet.parts} scale={sheet.scale} submittedAt={sheet.submittedAt} submitLabel="Mark as complete" />
        ) : (
          <Empty>No students in this class yet.</Empty>
        )}
      </Panel>
    </AdminPage>
  );
}
