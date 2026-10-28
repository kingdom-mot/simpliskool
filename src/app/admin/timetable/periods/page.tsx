import Link from "next/link";
import { AdminPage, Panel, requireAdminPage } from "@/components/admin";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Empty, Pill } from "@/components/ui";
import { RESULTS_ADMIN } from "@/lib/results";
import { hm, type Period } from "@/lib/timetable";
import { deletePeriod, savePeriod } from "../actions";

export const metadata = { title: "Period times" };

export default async function PeriodsPage() {
  const ctx = await requireAdminPage(RESULTS_ADMIN);
  const { supabase, school } = ctx;
  const { data } = await supabase.from("school_periods").select("id, label, kind, starts_at, ends_at").eq("school_id", school.id).order("starts_at").returns<Period[]>();
  const periods = data ?? [];
  return (
    <AdminPage ctx={ctx} active="timetable" crumb={[{ label: "Timetable", href: "/admin/timetable" }]} title="Period times">
      <p className="-mt-2 text-sm text-[#4A5A70]">The same times are used for every class. Changing a time moves the lessons in it.</p>
      <Panel id="per-h" title="School day">
        {periods.length ? (
          <ul className="flex flex-col gap-2">
            {periods.map((p) => (
              <li key={p.id} className="flex flex-wrap items-end gap-2 rounded-xl border border-[#E3EAF3] p-3">
                <ActionForm action={savePeriod} className="flex flex-1 flex-wrap items-end gap-2">
                  <input type="hidden" name="id" value={p.id} />
                  <div className="min-w-[140px] flex-1">
                    <label className="label" htmlFor={`l-${p.id}`}>
                      Name
                    </label>
                    <input id={`l-${p.id}`} name="label" className="sk-input" defaultValue={p.label} maxLength={30} required />
                  </div>
                  <div>
                    <label className="label" htmlFor={`k-${p.id}`}>
                      Type
                    </label>
                    <select id={`k-${p.id}`} name="kind" className="sk-input sk-select" defaultValue={p.kind}>
                      <option value="lesson">Lesson</option>
                      <option value="break">Break</option>
                    </select>
                  </div>
                  <div>
                    <label className="label" htmlFor={`s-${p.id}`}>
                      Starts
                    </label>
                    <input id={`s-${p.id}`} name="starts_at" type="time" className="sk-input" defaultValue={p.starts_at.slice(0, 5)} required />
                  </div>
                  <div>
                    <label className="label" htmlFor={`e-${p.id}`}>
                      Ends
                    </label>
                    <input id={`e-${p.id}`} name="ends_at" type="time" className="sk-input" defaultValue={p.ends_at.slice(0, 5)} required />
                  </div>
                  <SubmitButton className="s-btn2">
                    Save<span className="sr-only"> {p.label}</span>
                  </SubmitButton>
                </ActionForm>
                <ActionForm action={deletePeriod}>
                  <input type="hidden" name="id" value={p.id} />
                  <SubmitButton className="s-btn-danger" pending="Removing…">
                    Remove<span className="sr-only"> {p.label}</span>
                  </SubmitButton>
                </ActionForm>
                <span className="sr-only">
                  {p.label}: {hm(p.starts_at)} to {hm(p.ends_at)}
                </span>
                {p.kind === "break" && <Pill kind="info">Break</Pill>}
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No periods yet. Add the first one below, or go back and use a standard school day.</Empty>
        )}
      </Panel>
      <Panel id="add-h" title="Add a period or break">
        <ActionForm action={savePeriod} resetOnSuccess className="flex flex-wrap items-end gap-2">
          <div className="min-w-[160px] flex-1">
            <label className="label" htmlFor="n-label">
              Name
            </label>
            <input id="n-label" name="label" className="sk-input" maxLength={30} required placeholder="e.g. Period 9 or Assembly" />
          </div>
          <div>
            <label className="label" htmlFor="n-kind">
              Type
            </label>
            <select id="n-kind" name="kind" className="sk-input sk-select" defaultValue="lesson">
              <option value="lesson">Lesson</option>
              <option value="break">Break</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="n-start">
              Starts
            </label>
            <input id="n-start" name="starts_at" type="time" className="sk-input" required />
          </div>
          <div>
            <label className="label" htmlFor="n-end">
              Ends
            </label>
            <input id="n-end" name="ends_at" type="time" className="sk-input" required />
          </div>
          <SubmitButton>Add</SubmitButton>
        </ActionForm>
      </Panel>
      <Link className="s-link text-sm" href="/admin/timetable">
        Back to the timetable
      </Link>
    </AdminPage>
  );
}
