import Link from "next/link";
import { NoteView } from "@/components/NoteView";
import { Empty } from "@/components/ui";
import { NOTE_FIELDS, type Note } from "@/lib/lesson-notes";
import { dayLabel } from "@/lib/teaching";

type DB = Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>;
type Row = Note & { class_subjects: { class_id: string; subjects: { name: string } | null } | null };

/** Lesson notes the teachers have shared with this class (newest first), or one note. */
export async function SharedNotes({ supabase, classId, href, open }: { supabase: DB; classId: string | null; href: (id: string | null) => string; open?: string }) {
  if (!classId) return <Empty>Not in a class yet. Please tell the school.</Empty>;
  const { data } = await supabase
    .from("lesson_notes")
    .select(`${NOTE_FIELDS}, class_subjects!inner(class_id, subjects(name))`)
    .eq("class_subjects.class_id", classId)
    .eq("status", "shared")
    .order("shared_at", { ascending: false })
    .limit(60)
    .returns<Row[]>();
  const notes = data ?? [];
  const cur = notes.find((n) => n.id === open);
  if (cur)
    return (
      <div className="flex flex-col gap-3">
        <Link href={href(null)} className="text-sm font-bold text-c1 underline">
          ← All lesson notes
        </Link>
        <section aria-labelledby="note-h" className="flex flex-col gap-3 rounded-[18px] border border-[#E3EAF3] bg-white p-[18px]">
          <p className="text-[13px] font-bold text-[#4A5A70]">
            {cur.class_subjects?.subjects?.name} · Week {cur.week}
          </p>
          <h2 id="note-h" className="text-xl !text-c1">
            {cur.topic}
          </h2>
          <NoteView note={cur} />
        </section>
      </div>
    );
  if (!notes.length) return <Empty>Notes appear here after the teacher shares them in class. Use them to revise.</Empty>;
  const subjects = [...new Set(notes.map((n) => n.class_subjects?.subjects?.name ?? ""))];
  return (
    <div className="flex flex-col gap-4">
      {subjects.map((s) => (
        <section key={s} aria-label={s} className="flex flex-col gap-2">
          <h2 className="text-base !text-c1">{s}</h2>
          <ul className="flex flex-col gap-2">
            {notes
              .filter((n) => (n.class_subjects?.subjects?.name ?? "") === s)
              .map((n) => (
                <li key={n.id}>
                  <Link href={href(n.id)} className="flex min-h-[60px] flex-col justify-center rounded-[16px] border border-[#E3EAF3] bg-white p-3 hover:border-c2">
                    <span className="font-bold text-brand-slate">{n.topic}</span>
                    <span className="text-[13px] text-[#4A5A70]">
                      Week {n.week}
                      {n.shared_at ? ` · shared ${dayLabel(n.shared_at)}` : ""}
                    </span>
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
