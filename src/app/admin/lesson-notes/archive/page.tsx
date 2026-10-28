import { headers } from "next/headers";
import Link from "next/link";
import { AdminPage, Panel, SETUP_ROLES, classLabel, requireAdminPage } from "@/components/admin";
import { Flash } from "@/components/Flash";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Empty, Pill } from "@/components/ui";
import { loadTerms, termLabel } from "@/lib/fees";
import { loadArchive, noteLabel } from "@/lib/note-archive";
import { loadClasses } from "@/lib/results-load";
import { createInspectorLink, revokeInspectorLink } from "../actions";

export const metadata = { title: "Lesson note archive" };

type Link_ = { id: string; token: string; name: string; organisation: string | null; expires_at: string; revoked_at: string | null; term_id: string | null; session_id: string | null; inspector_views: { count: number }[] };
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" });

export default async function ArchivePage(props: { searchParams: Promise<{ term?: string; teacher?: string; subject?: string; class?: string }> }) {
  const sp = await props.searchParams;
  const ctx = await requireAdminPage(SETUP_ROLES);
  const { supabase, school } = ctx;
  const { terms, term } = await loadTerms(supabase, school.id, sp.term);
  const [classes, { data: subjects }, { data: teachers }, { data: links }, { data: sessions }] = await Promise.all([
    loadClasses(supabase, school.id),
    supabase.from("subjects").select("id, name").eq("school_id", school.id).order("name").returns<{ id: string; name: string }[]>(),
    supabase.from("memberships").select("user_id, profiles(full_name)").eq("school_id", school.id).eq("role", "teacher").returns<{ user_id: string; profiles: { full_name: string | null } | null }[]>(),
    supabase.from("inspector_links").select("id, token, name, organisation, expires_at, revoked_at, term_id, session_id, inspector_views(count)").eq("school_id", school.id).order("created_at", { ascending: false }).returns<Link_[]>(),
    supabase.from("academic_sessions").select("id, name").eq("school_id", school.id).order("name", { ascending: false }).returns<{ id: string; name: string }[]>(),
  ]);
  const f = { term: term?.id, teacher: sp.teacher, subject: sp.subject, cls: sp.class };
  const rows = term ? await loadArchive(supabase, school.id, [term.id], f) : [];
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "simpliskool.com";
  const origin = `${host.startsWith("localhost") ? "http" : "https"}://${host}`;
  const now = new Date().toISOString();
  const active = (links ?? []).filter((l) => !l.revoked_at && Date.parse(l.expires_at) > Date.parse(now));
  const qs = new URLSearchParams(Object.entries({ term: term?.id ?? "", teacher: sp.teacher ?? "", subject: sp.subject ?? "", class: sp.class ?? "" }).filter(([, v]) => v));
  const curSession = sessions?.find((s) => s.name === term?.session);

  return (
    <AdminPage
      ctx={ctx}
      active="lessonnotes"
      crumb={[{ label: "Lesson note review", href: "/admin/lesson-notes" }]}
      title="Lesson note archive"
      actions={
        rows.length ? (
          <Link className="s-btn2" href={`/admin/lesson-notes/archive/print?${qs}`}>
            Print or save selection as PDF
          </Link>
        ) : undefined
      }
    >
      <Flash />
      <p className="-mt-2 text-sm text-[#4A5A70]">Every approved note, kept safely by session and term. {rows.length} note{rows.length === 1 ? "" : "s"} shown.</p>
      <form method="get" className="flex flex-wrap items-end gap-2 rounded-[18px] border border-[#E3EAF3] bg-white p-4">
        <div>
          <label className="label" htmlFor="ar-term">
            Term
          </label>
          <select className="sk-input sk-select py-2" id="ar-term" name="term" defaultValue={term?.id ?? ""}>
            {terms.map((t) => (
              <option key={t.id} value={t.id}>
                {termLabel(t)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="ar-teacher">
            Teacher
          </label>
          <select className="sk-input sk-select py-2" id="ar-teacher" name="teacher" defaultValue={sp.teacher ?? ""}>
            <option value="">All teachers</option>
            {(teachers ?? []).map((t) => (
              <option key={t.user_id} value={t.user_id}>
                {t.profiles?.full_name ?? "Teacher"}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="ar-subject">
            Subject
          </label>
          <select className="sk-input sk-select py-2" id="ar-subject" name="subject" defaultValue={sp.subject ?? ""}>
            <option value="">All subjects</option>
            {(subjects ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="ar-class">
            Class
          </label>
          <select className="sk-input sk-select py-2" id="ar-class" name="class" defaultValue={sp.class ?? ""}>
            <option value="">All classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {classLabel(c.name, c.arm)}
              </option>
            ))}
          </select>
        </div>
        <button className="s-btn2">Show</button>
      </form>

      <Panel id="ar-h" title="Approved lesson notes">
        {rows.length ? (
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Approved notes: scroll sideways to see more">
            <table className="tbl min-w-[720px]">
              <caption className="sr-only">Approved lesson notes</caption>
              <thead>
                <tr>
                  <th scope="col">Week</th>
                  <th scope="col">Subject and class</th>
                  <th scope="col">Topic</th>
                  <th scope="col">Teacher</th>
                  <th scope="col">Approved</th>
                  <th scope="col">Score</th>
                  <th scope="col">
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((n) => (
                  <tr key={n.id}>
                    <td>{n.week}</td>
                    <th scope="row">{noteLabel(n)}</th>
                    <td>{n.topic}</td>
                    <td>{n.profiles?.full_name ?? "—"}</td>
                    <td>{n.reviewed_at ? day(n.reviewed_at) : "—"}</td>
                    <td>{n.score ? `${n.score}/10` : "—"}</td>
                    <td>
                      <Link className="s-link text-sm" href={`/admin/lesson-notes?tab=approved&note=${n.id}`}>
                        View<span className="sr-only"> {noteLabel(n)} week {n.week}</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>No approved notes match.</Empty>
        )}
      </Panel>

      <Panel id="insp-h" title="Give an inspector access">
        <p className="text-sm text-brand-slate">Create a read-only link for a visiting inspector. They can view approved notes only, and nothing else in your school. Each note they open is recorded.</p>
        <ActionForm action={createInspectorLink} resetOnSuccess className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <label className="label" htmlFor="in-name">
              Inspector&apos;s name
            </label>
            <input id="in-name" name="name" className="sk-input" required maxLength={120} />
          </div>
          <div>
            <label className="label" htmlFor="in-org">
              Organisation
            </label>
            <input id="in-org" name="organisation" className="sk-input" list="orgs" maxLength={120} placeholder="e.g. Lagos State Ministry of Education" />
            <datalist id="orgs">
              <option value="Lagos State Ministry of Education" />
              <option value="Ogun State Ministry of Education" />
              <option value="Oyo State Ministry of Education" />
              <option value="FCT Education Secretariat" />
            </datalist>
          </div>
          <div>
            <label className="label" htmlFor="in-scope">
              What they can see
            </label>
            <select id="in-scope" name="scope" className="sk-input sk-select" defaultValue={term ? `term:${term.id}` : ""}>
              {term && <option value={`term:${term.id}`}>{termLabel(term)}, all subjects</option>}
              {curSession && <option value={`session:${curSession.id}`}>Whole {curSession.name} session</option>}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="in-days">
              Link expires after
            </label>
            <select id="in-days" name="days" className="sk-input sk-select" defaultValue="7">
              <option value="1">1 day</option>
              <option value="7">7 days</option>
              <option value="30">30 days</option>
            </select>
          </div>
          <div className="sm:col-span-2 xl:col-span-4">
            <SubmitButton>Create inspector link</SubmitButton>
          </div>
        </ActionForm>
        {active.length > 0 && (
          <ul className="flex flex-col gap-2">
            {active.map((l) => (
              <li key={l.id} className="flex flex-wrap items-end gap-3 rounded-xl border border-[#E3EAF3] p-3">
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-brand-slate">
                    {l.name}
                    {l.organisation ? ` · ${l.organisation}` : ""}
                  </div>
                  <div className="text-xs text-[#4A5A70]">
                    Expires {day(l.expires_at)} · {l.inspector_views[0]?.count ?? 0} note{l.inspector_views[0]?.count === 1 ? "" : "s"} opened
                  </div>
                  <label className="sr-only" htmlFor={`lk-${l.id}`}>
                    Inspector link for {l.name}
                  </label>
                  <input id={`lk-${l.id}`} readOnly className="sk-input mt-1 py-2 font-mono text-xs" value={`${origin}/inspect/${l.token}`} />
                </div>
                <ActionForm action={revokeInspectorLink}>
                  <input type="hidden" name="id" value={l.id} />
                  <SubmitButton className="s-btn-danger" pending="Cancelling…">
                    Cancel link<span className="sr-only"> for {l.name}</span>
                  </SubmitButton>
                </ActionForm>
              </li>
            ))}
          </ul>
        )}
        {active.length === 0 && (links ?? []).length > 0 && <Pill kind="info">No active links</Pill>}
      </Panel>
    </AdminPage>
  );
}
