import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NoteView } from "@/components/NoteView";
import { termLabel } from "@/lib/fees";
import { loadArchive, noteLabel } from "@/lib/note-archive";
import { createAdminClient } from "@/lib/supabase/admin";
import { schoolThemeStyle } from "@/lib/theme";

// Checked fresh on every visit, so a cancelled or expired link stops working straight away.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Approved lesson notes", robots: { index: false, follow: false } };

type LinkRow = { id: string; school_id: string; name: string; term_id: string | null; session_id: string | null; expires_at: string; revoked_at: string | null; schools: { name: string; primary_color: string | null; secondary_color: string | null } | null };

/** Read-only page for a visiting inspector: approved lesson notes only, until the link expires. */
export default async function InspectPage(props: { params: Promise<{ token: string }>; searchParams: Promise<{ note?: string }> }) {
  const { token } = await props.params;
  const sp = await props.searchParams;
  if (!/^[A-Za-z0-9_-]{20,60}$/.test(token)) notFound();
  const admin = createAdminClient();
  const { data: link } = await admin.from("inspector_links").select("id, school_id, name, term_id, session_id, expires_at, revoked_at, schools(name, primary_color, secondary_color)").eq("token", token).maybeSingle<LinkRow>();
  if (!link || link.revoked_at || link.expires_at < new Date().toISOString()) {
    return (
      <main id="main" className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="text-2xl !text-brand-navy">This link has expired</h1>
        <p className="mt-2 text-brand-slate">Please ask the school for a new link.</p>
      </main>
    );
  }
  const { data: terms } = await admin
    .from("terms")
    .select("id, term_no, academic_sessions(name)")
    .eq("school_id", link.school_id)
    .or(link.term_id ? `id.eq.${link.term_id}` : `session_id.eq.${link.session_id}`)
    .returns<{ id: string; term_no: number; academic_sessions: { name: string } | null }[]>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = await loadArchive(admin as any, link.school_id, (terms ?? []).map((t) => t.id), {});
  const sel = rows.find((r) => r.id === sp.note);
  if (sel) await admin.from("inspector_views").insert({ link_id: link.id, note_id: sel.id });
  const scope = (terms ?? []).length === 1 ? termLabel({ term_no: terms![0].term_no, session: terms![0].academic_sessions?.name ?? "" }) : `${terms?.[0]?.academic_sessions?.name ?? ""} session`;

  return (
    <div style={schoolThemeStyle(link.schools?.primary_color, link.schools?.secondary_color)} className="min-h-screen bg-brand-cloud px-4 py-6">
      <main id="main" className="mx-auto flex max-w-[860px] flex-col gap-4">
        <header className="rounded-[22px] bg-c1 px-5 py-4 text-white">
          <p className="text-sm text-white">Read-only access for {link.name}</p>
          <h1 className="text-2xl !text-white">{link.schools?.name} · Approved lesson notes</h1>
          <p className="text-sm text-white">
            {scope} · link expires {new Date(link.expires_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </header>
        {sel ? (
          <article className="flex flex-col gap-3 rounded-[18px] border border-[#E3EAF3] bg-white p-5">
            <Link className="s-link text-sm" href={`/inspect/${token}`}>
              Back to all notes
            </Link>
            <h2 className="text-lg !text-c1">
              Week {sel.week} · {noteLabel(sel)} · {sel.profiles?.full_name ?? ""}
            </h2>
            <NoteView note={sel} />
          </article>
        ) : rows.length ? (
          <ul className="flex flex-col gap-2">
            {rows.map((n) => (
              <li key={n.id}>
                <Link href={`/inspect/${token}?note=${n.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-[16px] border border-[#E3EAF3] bg-white p-4">
                  <span className="font-bold text-brand-slate">
                    Week {n.week} · {noteLabel(n)}
                  </span>
                  <span className="text-sm text-[#4A5A70]">
                    {n.topic} · {n.profiles?.full_name ?? ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl bg-white p-4">No approved notes yet.</p>
        )}
      </main>
    </div>
  );
}
