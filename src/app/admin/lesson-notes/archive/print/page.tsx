import Link from "next/link";
import { NoteView } from "@/components/NoteView";
import { PrintButton } from "@/components/PrintButton";
import { SETUP_ROLES } from "@/components/admin";
import { requireSchool } from "@/lib/auth";
import { loadTerms, termLabel } from "@/lib/fees";
import { loadArchive, noteLabel } from "@/lib/note-archive";

export const metadata = { title: "Lesson notes" };

export default async function PrintNotes(props: { searchParams: Promise<{ term?: string; teacher?: string; subject?: string; class?: string }> }) {
  const sp = await props.searchParams;
  const { supabase, school } = await requireSchool(SETUP_ROLES);
  const { term } = await loadTerms(supabase, school.id, sp.term);
  const rows = term ? await loadArchive(supabase, school.id, [term.id], { teacher: sp.teacher, subject: sp.subject, cls: sp.class }) : [];
  return (
    <div className="min-h-screen bg-brand-cloud px-4 py-6 print:bg-white print:p-0">
      <main id="main" className="mx-auto flex max-w-[860px] flex-col gap-4">
        <div className="no-print flex items-center justify-between gap-3">
          <Link className="s-link text-sm" href="/admin/lesson-notes/archive">
            Back
          </Link>
          <PrintButton />
        </div>
        <div className="print-area flex flex-col gap-4">
          <h1 className="text-2xl !text-c1">
            {school.name} · Lesson notes · {term ? termLabel(term) : ""}
          </h1>
          {rows.map((n) => (
            <article key={n.id} className="break-inside-avoid rounded-[18px] border border-[#E3EAF3] bg-white p-5">
              <h2 className="mb-2 text-lg !text-c1">
                Week {n.week} · {noteLabel(n)} · {n.profiles?.full_name ?? ""}
                {n.score ? ` · ${n.score}/10` : ""}
              </h2>
              <NoteView note={n} />
            </article>
          ))}
          {!rows.length && <p>No approved notes match.</p>}
        </div>
      </main>
    </div>
  );
}
