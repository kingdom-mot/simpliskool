import { AdminPage, Panel, requireAdminPage } from "@/components/admin";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Pill } from "@/components/ui";
import { TERM_NAME } from "@/lib/format";
import { createSession, makeCurrentTerm, saveTermDates } from "./actions";

type Term = { id: string; term_no: number; starts_on: string | null; ends_on: string | null; is_current: boolean };
type Session = { id: string; name: string; starts_on: string | null; ends_on: string | null; is_current: boolean; terms: Term[] };

function fmt(d: string | null) {
  if (!d) return "Not set";
  return new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** Typical Nigerian calendar for a session starting in September of `year`. */
function suggested(year: number) {
  return {
    name: `${year}/${year + 1}`,
    t1s: `${year}-09-14`, t1e: `${year}-12-11`,
    t2s: `${year + 1}-01-07`, t2e: `${year + 1}-04-02`,
    t3s: `${year + 1}-04-27`, t3e: `${year + 1}-07-23`,
  };
}

export default async function SessionsPage() {
  const ctx = await requireAdminPage();
  const { supabase, school } = ctx;
  const { data } = await supabase
    .from("academic_sessions")
    .select("id, name, starts_on, ends_on, is_current, terms(id, term_no, starts_on, ends_on, is_current)")
    .eq("school_id", school.id)
    .order("name", { ascending: false })
    .returns<Session[]>();
  const sessions = (data ?? []).map((s) => ({ ...s, terms: [...s.terms].sort((a, b) => a.term_no - b.term_no) }));
  const current = sessions.find((s) => s.is_current) ?? sessions[0];
  const others = sessions.filter((s) => s.id !== current?.id);

  const now = new Date();
  const startYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  const latest = sessions[0] ? Number(sessions[0].name.slice(0, 4)) : null;
  const next = suggested(latest ? latest + 1 : startYear);

  return (
    <AdminPage ctx={ctx} active="sessions" crumb={[{ label: "School" }]} title="Sessions and terms">
      {!current ? (
        <Panel id="new-h" title="Set up your first session">
          <p className="text-[15px] text-[#4A5A70]">Add this school year and its three terms. We&apos;ve filled in typical dates; change them to match your calendar.</p>
          <SessionForm defaults={suggested(startYear)} firstTime />
        </Panel>
      ) : (
        <>
          <Panel
            id="cur-h"
            title={`${current.name} session`}
            actions={current.is_current ? <Pill kind="good">Current</Pill> : <Pill kind="info">Not current</Pill>}
          >
            <ActionForm action={saveTermDates} className="flex flex-col gap-4">
              <input type="hidden" name="session_id" value={current.id} />
              <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-3">
                {current.terms.map((t) => (
                  <fieldset key={t.id} className="flex flex-col gap-3 rounded-2xl border-[1.5px] p-4" style={{ borderColor: t.is_current ? "var(--c2,#0B7D6E)" : "#E3EAF3" }}>
                    <legend className="px-1 font-heading text-base font-extrabold text-c1">{TERM_NAME[t.term_no]}</legend>
                    <input type="hidden" name="term_id" value={t.id} />
                    <input type="hidden" name={`no_${t.id}`} value={t.term_no} />
                    <div>{t.is_current ? <Pill kind="good">Current term</Pill> : <Pill kind="info">{t.ends_on && t.ends_on < now.toISOString().slice(0, 10) ? "Ended" : "Upcoming"}</Pill>}</div>
                    <div>
                      <label className="label" htmlFor={`s_${t.id}`}>Starts</label>
                      <input className="sk-input" id={`s_${t.id}`} name={`s_${t.id}`} type="date" defaultValue={t.starts_on ?? ""} />
                    </div>
                    <div>
                      <label className="label" htmlFor={`e_${t.id}`}>Ends</label>
                      <input className="sk-input" id={`e_${t.id}`} name={`e_${t.id}`} type="date" defaultValue={t.ends_on ?? ""} />
                    </div>
                  </fieldset>
                ))}
              </div>
              <div className="flex justify-end">
                <SubmitButton>Save term dates</SubmitButton>
              </div>
            </ActionForm>

            <div className="flex flex-col gap-2 rounded-2xl bg-brand-cloud p-4">
              <h3 className="text-base !text-c1">Change the current term</h3>
              <p className="text-sm text-[#4A5A70]">The current term decides where attendance, scores and fees go for everyone in the school.</p>
              <div className="flex flex-wrap gap-2.5">
                {current.terms
                  .filter((t) => !t.is_current)
                  .map((t) => (
                    <ActionForm key={t.id} action={makeCurrentTerm} className="flex flex-col gap-2">
                      <input type="hidden" name="term_id" value={t.id} />
                      <SubmitButton className="s-btn2" pending="Changing…">
                        Make {TERM_NAME[t.term_no]} current
                      </SubmitButton>
                    </ActionForm>
                  ))}
              </div>
            </div>
          </Panel>

          {others.length > 0 && (
            <Panel id="past-h" title="Other sessions">
              <ul className="flex flex-col">
                {others.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EEF3F9] py-3">
                    <span>
                      <span className="block font-bold text-c1">{s.name}</span>
                      <span className="text-[13px] text-[#4A5A70]">
                        {fmt(s.starts_on)} – {fmt(s.ends_on)}
                      </span>
                    </span>
                    <span className="flex flex-wrap gap-2">
                      {s.terms.map((t) => (
                        <ActionForm key={t.id} action={makeCurrentTerm} className="flex flex-col gap-2">
                          <input type="hidden" name="term_id" value={t.id} />
                          <SubmitButton className="s-btn2" pending="Changing…">
                            Make {TERM_NAME[t.term_no].replace(" Term", "")} term current<span className="sr-only"> for {s.name}</span>
                          </SubmitButton>
                        </ActionForm>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <details className="group rounded-[18px] border border-[#E3EAF3] bg-white p-[22px]">
            <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between font-heading text-lg font-extrabold text-c1">
              Add the next session ({next.name})
              <span aria-hidden="true" className="transition group-open:rotate-45">+</span>
            </summary>
            <div className="mt-4">
              <SessionForm defaults={next} />
            </div>
          </details>
        </>
      )}
    </AdminPage>
  );
}

function SessionForm({ defaults, firstTime = false }: { defaults: ReturnType<typeof suggested>; firstTime?: boolean }) {
  return (
    <ActionForm action={createSession} className="flex flex-col gap-4">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="sess-name">Session</label>
          <input className="sk-input" id="sess-name" name="name" defaultValue={defaults.name} required inputMode="numeric" aria-describedby="sess-hint" />
          <p id="sess-hint" className="mt-1 text-[13px] text-[#4A5A70]">For example 2026/2027</p>
        </div>
        <div>
          <label className="label" htmlFor="sess-current">Current term</label>
          <select className="sk-input sk-select" id="sess-current" name="current" defaultValue={firstTime ? "1" : ""}>
            <option value="">Keep the current term as it is</option>
            <option value="1">First Term of this session</option>
            <option value="2">Second Term of this session</option>
            <option value="3">Third Term of this session</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-3">
        {[1, 2, 3].map((n) => (
          <fieldset key={n} className="flex flex-col gap-3 rounded-2xl border-[1.5px] border-[#E3EAF3] p-4">
            <legend className="px-1 font-heading text-base font-extrabold text-c1">{TERM_NAME[n]}</legend>
            <div>
              <label className="label" htmlFor={`n-t${n}s`}>Starts</label>
              <input className="sk-input" id={`n-t${n}s`} name={`t${n}s`} type="date" defaultValue={defaults[`t${n}s` as "t1s"]} />
            </div>
            <div>
              <label className="label" htmlFor={`n-t${n}e`}>Ends</label>
              <input className="sk-input" id={`n-t${n}e`} name={`t${n}e`} type="date" defaultValue={defaults[`t${n}e` as "t1e"]} />
            </div>
          </fieldset>
        ))}
      </div>
      <div className="flex justify-end">
        <SubmitButton pending="Adding…">{firstTime ? "Save session" : "Add session"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
