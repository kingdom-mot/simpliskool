import Link from "next/link";
import { AdminPage, Panel, classLabel, requireAdminPage } from "@/components/admin";
import { Broadsheet } from "@/components/Broadsheet";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Empty, Pill } from "@/components/ui";
import { emailReady } from "@/lib/email";
import { loadTerms, termLabel } from "@/lib/fees";
import { remindScoreTeachers } from "@/lib/results-actions";
import { RESULTS_ADMIN, type ClassResults } from "@/lib/results";
import { loadClasses, loadScale } from "@/lib/results-load";

export const metadata = { title: "Results broadsheet" };

export default async function ResultsPage(props: { searchParams: Promise<{ class?: string; term?: string }> }) {
  const sp = await props.searchParams;
  const ctx = await requireAdminPage(RESULTS_ADMIN);
  const { supabase, school } = ctx;
  const [classes, { terms, term }, scale] = await Promise.all([loadClasses(supabase, school.id), loadTerms(supabase, school.id, sp.term), loadScale(supabase, school.id)]);
  const cls = classes.find((c) => c.id === sp.class) ?? classes[0];

  if (!cls || !term) {
    return (
      <AdminPage ctx={ctx} active="results" crumb={[{ label: "Academics" }]} title="Results broadsheet">
        <Empty>
          {!term ? "Add the session and terms first on the Sessions and terms page." : "Add classes and subjects first on the Classes and subjects page."}
        </Empty>
      </AdminPage>
    );
  }

  const { data } = await supabase.rpc("class_results", { p_class: cls.id, p_term: term.id });
  const r = data as ClassResults | null;
  const name = classLabel(cls.name, cls.arm);
  const subjects = r?.subjects ?? [];
  const finished = subjects.filter((s) => s.submitted_at || (r!.class_size > 0 && s.complete >= r!.class_size));
  const open = subjects.filter((s) => !finished.includes(s));
  const q = new URLSearchParams({ class: cls.id, term: term.id });

  return (
    <AdminPage
      ctx={ctx}
      active="results"
      crumb={[{ label: "Academics" }]}
      title="Results broadsheet"
      actions={
        <>
          <a className="s-btn2" href={`/admin/results/export?${q}`} download>
            Download for Excel
          </a>
          <Link className="s-btn" href={`/admin/report-cards?${q}`}>
            Continue to report cards
          </Link>
        </>
      }
    >
      <form method="get" className="flex flex-wrap items-end gap-2">
        <div>
          <label className="label" htmlFor="r-class">
            Class
          </label>
          <select className="sk-input py-2" id="r-class" name="class" defaultValue={cls.id}>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {classLabel(c.name, c.arm)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="r-term">
            Term
          </label>
          <select className="sk-input py-2" id="r-term" name="term" defaultValue={term.id}>
            {terms.map((t) => (
              <option key={t.id} value={t.id}>
                {termLabel(t)}
                {t.is_current ? " (current)" : ""}
              </option>
            ))}
          </select>
        </div>
        <button className="s-btn2">Show</button>
      </form>

      <Panel
        id="sub-h"
        title={`Score entry · ${finished.length} of ${subjects.length} subjects complete`}
        actions={
          open.length > 0 && emailReady() ? (
            <ActionForm action={remindScoreTeachers} className="flex flex-col items-end gap-2">
              <input type="hidden" name="class" value={cls.id} />
              <input type="hidden" name="term" value={term.id} />
              <SubmitButton pending="Sending…">
                Remind {open.length} subject teacher{open.length === 1 ? "" : "s"}
              </SubmitButton>
            </ActionForm>
          ) : null
        }
      >
        {subjects.length ? (
          <ul className="grid grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {subjects.map((s) => {
              const done = finished.includes(s);
              return (
                <li key={s.id} className="flex items-center justify-between gap-2 rounded-xl border border-[#E3EAF3] px-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-brand-slate">{s.name}</div>
                    <div className="truncate text-xs text-[#4A5A70]">{s.teacher ?? "No teacher set"}</div>
                  </div>
                  <div className="flex flex-none flex-col items-end gap-1">
                    {done ? <Pill kind="good">{s.submitted_at ? "Submitted" : "Complete"}</Pill> : s.scored ? <Pill kind="warn">{s.complete} of {r!.class_size}</Pill> : <Pill kind="bad">Not started</Pill>}
                    <Link className="s-link text-xs" href={`/admin/results/scores?${new URLSearchParams({ cs: s.id, term: term.id })}`}>
                      {done ? "View" : "Enter"} scores<span className="sr-only"> for {s.name}</span>
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty>
            {name} has no subjects yet. Add them on the{" "}
            <Link className="s-link" href={`/admin/classes?class=${cls.id}`}>
              Classes and subjects
            </Link>{" "}
            page.
          </Empty>
        )}
      </Panel>

      <Panel id="bs-h" title={`${name} broadsheet · ${termLabel(term)}`}>
        {r?.students.length && subjects.length ? (
          <>
            <Broadsheet r={r} scale={scale} caption={`${name} broadsheet: total score per subject out of 100, with average and position`} />
            <p className="text-[13px] text-[#4A5A70]">&quot;Missing&quot; means the subject teacher hasn&apos;t entered a score yet; &quot;part&quot; means CA 1, CA 2 or the exam is still empty. Failed subjects show in red with the grade.</p>
          </>
        ) : (
          <Empty>No students or subjects in {name} yet.</Empty>
        )}
      </Panel>
    </AdminPage>
  );
}
