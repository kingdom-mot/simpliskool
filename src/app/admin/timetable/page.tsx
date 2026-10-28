import Link from "next/link";
import { AdminPage, Panel, classLabel, requireAdminPage } from "@/components/admin";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Empty } from "@/components/ui";
import { RESULTS_ADMIN } from "@/lib/results";
import { loadClasses } from "@/lib/results-load";
import { DAYS, hm, subjectTint, type Period } from "@/lib/timetable";
import { applyStandardDay, saveSlot } from "./actions";

export const metadata = { title: "Timetable" };

type Slot = { id: string; class_id: string; day_of_week: number; period_id: string | null; room: string | null; starts_at: string; ends_at: string; class_subjects: { id: string; teacher_id: string | null; subjects: { name: string } | null; profiles: { full_name: string | null } | null } | null };

export default async function TimetablePage(props: { searchParams: Promise<{ class?: string; day?: string; period?: string }> }) {
  const sp = await props.searchParams;
  const ctx = await requireAdminPage(RESULTS_ADMIN);
  const { supabase, school } = ctx;
  const [classes, { data: periodRows }] = await Promise.all([
    loadClasses(supabase, school.id),
    supabase.from("school_periods").select("id, label, kind, starts_at, ends_at").eq("school_id", school.id).order("starts_at").returns<Period[]>(),
  ]);
  const periods = periodRows ?? [];
  const cls = classes.find((c) => c.id === sp.class) ?? classes[0];

  if (!cls) {
    return (
      <AdminPage ctx={ctx} active="timetable" crumb={[{ label: "Academics" }]} title="Timetable">
        <Empty>
          Add classes first on the{" "}
          <Link className="s-link" href="/admin/classes">
            Classes and subjects
          </Link>{" "}
          page.
        </Empty>
      </AdminPage>
    );
  }
  if (!periods.length) {
    return (
      <AdminPage ctx={ctx} active="timetable" crumb={[{ label: "Academics" }]} title="Timetable">
        <Panel id="start-h" title="First, set the school day">
          <p className="text-sm text-brand-slate">Start with a standard day (8:00 start, 40-minute lessons, a short break at 10:00 and lunch at 12:20) and change the times afterwards, or add your own periods.</p>
          <div className="flex flex-wrap gap-2">
            <ActionForm action={applyStandardDay}>
              <SubmitButton pending="Setting up…">Use a standard school day</SubmitButton>
            </ActionForm>
            <Link className="s-btn2" href="/admin/timetable/periods">
              Set my own period times
            </Link>
          </div>
        </Panel>
      </AdminPage>
    );
  }

  const [{ data: slotRows }, { data: csRows }] = await Promise.all([
    supabase
      .from("timetable_periods")
      .select("id, class_id, day_of_week, period_id, room, starts_at, ends_at, class_subjects(id, teacher_id, subjects(name), profiles(full_name))")
      .eq("school_id", school.id)
      .returns<Slot[]>(),
    supabase.from("class_subjects").select("id, subjects(name), profiles(full_name)").eq("class_id", cls.id).returns<{ id: string; subjects: { name: string } | null; profiles: { full_name: string | null } | null }[]>(),
  ]);
  const slots = slotRows ?? [];
  const mine = slots.filter((s) => s.class_id === cls.id);
  const subjects = (csRows ?? []).sort((a, b) => (a.subjects?.name ?? "").localeCompare(b.subjects?.name ?? ""));
  const className = new Map(classes.map((c) => [c.id, classLabel(c.name, c.arm)]));
  const at = (day: number, pid: string) => mine.find((s) => s.day_of_week === day && s.period_id === pid);
  // A teacher booked in two classes at once (can happen if a subject's teacher was changed later).
  const clashOf = (s: Slot) => {
    const t = s.class_subjects?.teacher_id;
    if (!t) return null;
    const o = slots.find((x) => x.id !== s.id && x.class_id !== s.class_id && x.day_of_week === s.day_of_week && x.class_subjects?.teacher_id === t && x.starts_at < s.ends_at && x.ends_at > s.starts_at);
    return o ? className.get(o.class_id) ?? "another class" : null;
  };
  const clashes = mine.map((s) => ({ s, other: clashOf(s) })).filter((x) => x.other);
  const lessons = periods.filter((p) => p.kind === "lesson");
  const selDay = DAYS.find((d) => String(d.n) === sp.day)?.n ?? null;
  const selPeriod = lessons.find((p) => p.id === sp.period) ?? null;
  const sel = selDay && selPeriod ? at(selDay, selPeriod.id) : undefined;
  const name = classLabel(cls.name, cls.arm);
  const q = (o: Record<string, string>) => `/admin/timetable?${new URLSearchParams({ class: cls.id, ...o })}`;
  const free = selDay && selPeriod ? (((await supabase.rpc("free_teachers", { p_school: school.id, p_day: selDay, p_period: selPeriod.id })).data as string[] | null) ?? []).filter(Boolean) : [];

  return (
    <AdminPage
      ctx={ctx}
      active="timetable"
      crumb={[{ label: "Academics" }]}
      title="Timetable"
      actions={
        <Link className="s-btn2" href="/admin/timetable/periods">
          Edit period times
        </Link>
      }
    >
      <form method="get" className="flex flex-wrap items-end gap-2">
        <div>
          <label className="label" htmlFor="tt-class">
            Class
          </label>
          <select className="sk-input sk-select py-2" id="tt-class" name="class" defaultValue={cls.id}>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {classLabel(c.name, c.arm)}
              </option>
            ))}
          </select>
        </div>
        <button className="s-btn2">Show</button>
      </form>

      {clashes.length > 0 && (
        <div role="alert" className="rounded-xl bg-[#FEF3F2] px-4 py-3 text-sm font-semibold text-[#912018]">
          {clashes.length} clash{clashes.length === 1 ? "" : "es"}:{" "}
          {clashes.map(({ s, other }) => `${s.class_subjects?.profiles?.full_name ?? "A teacher"} is also teaching ${other} on ${DAYS[s.day_of_week - 1]?.name}, ${hm(s.starts_at)}`).join("; ")}. Pick another teacher or time.
        </div>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 2xl:grid-cols-[minmax(0,1fr)_360px]">
        <section aria-labelledby="grid-h" className="flex min-w-0 flex-col gap-3 rounded-[18px] border border-[#E3EAF3] bg-white p-[22px]">
          <h2 id="grid-h" className="text-lg !text-c1">
            {name} weekly timetable
          </h2>
          <p className="text-[13px] text-[#4A5A70]">Select a period to change it. {subjects.length ? "" : "This class has no subjects yet: add them under Classes and subjects."}</p>
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Timetable: scroll sideways to see more">
            <table className="tbl min-w-[820px] table-fixed">
              <caption className="sr-only">{name} weekly timetable. Select a period to change it.</caption>
              <thead>
                <tr>
                  <th scope="col" className="w-[110px]">
                    Period
                  </th>
                  {DAYS.map((d) => (
                    <th key={d.n} scope="col">
                      {d.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {periods.map((p) =>
                  p.kind === "break" ? (
                    <tr key={p.id}>
                      <th scope="row" className="whitespace-nowrap">
                        {p.label}
                        <span className="block text-xs font-normal text-[#4A5A70]">{hm(p.starts_at)}</span>
                      </th>
                      <td colSpan={5} className="bg-[#F5F8FC] text-center text-sm font-bold tracking-[0.08em] text-[#4A5A70]">
                        {p.label.toUpperCase()}
                      </td>
                    </tr>
                  ) : (
                    <tr key={p.id}>
                      <th scope="row" className="whitespace-nowrap">
                        {p.label}
                        <span className="block text-xs font-normal text-[#4A5A70]">
                          {hm(p.starts_at)}–{hm(p.ends_at)}
                        </span>
                      </th>
                      {DAYS.map((d) => {
                        const s = at(d.n, p.id);
                        const on = selDay === d.n && selPeriod?.id === p.id;
                        const clash = s ? clashOf(s) : null;
                        const subj = s?.class_subjects?.subjects?.name;
                        return (
                          <td key={d.n} className="!p-1.5">
                            <Link
                              href={`${q({ day: String(d.n), period: p.id })}#edit`}
                              aria-current={on ? "true" : undefined}
                              className={`flex min-h-[60px] flex-col justify-center rounded-xl border-[1.5px] px-2.5 py-1.5 text-left text-sm ${on ? "border-c1 ring-2 ring-c1" : clash ? "border-[#B42318]" : "border-transparent"}`}
                              style={{ background: clash ? "#FEF3F2" : subj ? subjectTint(subj) : "#FFFFFF", outlineColor: "var(--c1)" }}
                            >
                              <span className={`font-bold ${subj ? "text-brand-slate" : "text-[#4A5A70]"}`}>{subj ?? "Free"}</span>
                              {s && <span className="truncate text-xs text-[#34445A]">{s.class_subjects?.profiles?.full_name?.trim() || "No teacher"}{s.room ? ` · ${s.room}` : ""}</span>}
                              {clash && <span className="text-xs font-extrabold text-[#912018]">Clash</span>}
                              <span className="sr-only">
                                , {d.name} {p.label}. Change this period.
                              </span>
                            </Link>
                          </td>
                        );
                      })}
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </section>

        <Panel id="edit" title={selDay && selPeriod ? `${DAYS[selDay - 1].name}, ${selPeriod.label} (${hm(selPeriod.starts_at)})` : "Choose a period"}>
          {selDay && selPeriod ? (
            <ActionForm action={saveSlot} key={`${selDay}-${selPeriod.id}`} className="flex flex-col gap-3">
              <input type="hidden" name="class" value={cls.id} />
              <input type="hidden" name="day" value={selDay} />
              <input type="hidden" name="period" value={selPeriod.id} />
              <div>
                <label className="label" htmlFor="sl-subject">
                  Subject and teacher
                </label>
                <select id="sl-subject" name="class_subject" className="sk-input sk-select" defaultValue={sel?.class_subjects?.id ?? ""}>
                  <option value="">Free period</option>
                  {subjects.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.subjects?.name} · {c.profiles?.full_name?.trim() || "no teacher yet"}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="sl-room">
                  Room (optional)
                </label>
                <input id="sl-room" name="room" className="sk-input" maxLength={40} defaultValue={sel?.room ?? ""} placeholder="e.g. Block A, room 4" />
              </div>
              {free.length > 0 && <p className="text-[13px] text-[#4A5A70]">Teachers free at this time: {free.slice(0, 6).join(", ")}{free.length > 6 ? "…" : ""}.</p>}
              <div className="flex flex-wrap gap-2">
                <SubmitButton>Save period</SubmitButton>
                {sel && (
                  <button name="clear" value="1" className="s-btn2">
                    Clear
                  </button>
                )}
              </div>
              <p className="text-[13px] text-[#4A5A70]">A teacher can&apos;t be in two classes at once: Simpliskool will tell you if they&apos;re busy.</p>
            </ActionForm>
          ) : (
            <p className="text-sm text-brand-slate">Select a period on the timetable to choose its subject, teacher and room. Teachers&apos; own timetables update automatically.</p>
          )}
        </Panel>
      </div>
    </AdminPage>
  );
}
