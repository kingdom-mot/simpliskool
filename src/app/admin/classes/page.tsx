import Link from "next/link";
import { AdminPage, classLabel, Panel, requireAdminPage, SECTION_ORDER, sectionOf } from "@/components/admin";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Empty } from "@/components/ui";
import { SECTIONS } from "@/lib/nigeria";
import {
  addClass,
  addSubject,
  addSubjectToClass,
  applyTemplate,
  copySubjectsToArms,
  deleteClass,
  deleteSubject,
  removeClassSubject,
  saveClassSubjects,
  updateClass,
} from "./actions";

type ClassRow = { id: string; name: string; arm: string; level_order: number; class_teacher_id: string | null };
type Subject = { id: string; name: string };
type ClassSubject = { id: string; subject_id: string; teacher_id: string | null; subjects: { name: string } | null };
type Person = { user_id: string; role: string; profiles: { full_name: string | null; email: string | null } | null };

export default async function ClassesPage(props: { searchParams: Promise<{ class?: string }> }) {
  const searchParams = await props.searchParams;
  const ctx = await requireAdminPage();
  const { supabase, school } = ctx;

  const [{ data: classData }, { data: subjects }, { data: staff }, { data: studentRows }] = await Promise.all([
    supabase.from("classes").select("id, name, arm, level_order, class_teacher_id").eq("school_id", school.id).order("level_order").order("name").order("arm").returns<ClassRow[]>(),
    supabase.from("subjects").select("id, name").eq("school_id", school.id).order("name").returns<Subject[]>(),
    supabase.from("memberships").select("user_id, role, profiles(full_name, email)").eq("school_id", school.id).in("role", ["teacher", "principal", "admin", "owner"]).returns<Person[]>(),
    supabase.from("students").select("class_id").eq("school_id", school.id).eq("status", "active").limit(10000),
  ]);
  const classes = classData ?? [];
  const counts = new Map<string, number>();
  for (const r of studentRows ?? []) if (r.class_id) counts.set(r.class_id, (counts.get(r.class_id) ?? 0) + 1);

  // One entry per person, teachers first.
  const people = new Map<string, string>();
  for (const p of [...(staff ?? [])].sort((a, b) => (a.role === "teacher" ? -1 : 1) - (b.role === "teacher" ? -1 : 1))) {
    if (!people.has(p.user_id)) people.set(p.user_id, p.profiles?.full_name?.trim() || p.profiles?.email || "Unnamed staff");
  }
  const teachers = Array.from(people, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));

  const sel = classes.find((c) => c.id === searchParams.class) ?? classes[0];
  const { data: classSubjects } = sel
    ? await supabase.from("class_subjects").select("id, subject_id, teacher_id, subjects(name)").eq("class_id", sel.id).returns<ClassSubject[]>()
    : { data: [] as ClassSubject[] };
  const cs = [...(classSubjects ?? [])].sort((a, b) => (a.subjects?.name ?? "").localeCompare(b.subjects?.name ?? ""));
  const notOnClass = (subjects ?? []).filter((s) => !cs.some((c) => c.subject_id === s.id));
  const otherArms = sel ? classes.filter((c) => c.name === sel.name && c.id !== sel.id) : [];
  const noTeacher = cs.filter((c) => !c.teacher_id).map((c) => c.subjects?.name);

  const groups = SECTION_ORDER.map((sec) => ({ sec, items: classes.filter((c) => sectionOf(c.name) === sec) })).filter((g) => g.items.length);

  return (
    <AdminPage ctx={ctx} active="classes" crumb={[{ label: "Academics" }]} title="Classes and subjects">
      {classes.length === 0 ? (
        <TemplatePanel first />
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <nav aria-label="Classes" className="flex flex-col gap-4 rounded-[18px] border border-[#E3EAF3] bg-white p-4">
            {groups.map((g) => (
              <div key={g.sec} className="flex flex-col gap-1">
                <div className="px-2 text-xs font-extrabold uppercase tracking-[0.06em] text-[#4A5A70]">{g.sec}</div>
                {g.items.map((c) => {
                  const on = c.id === sel?.id;
                  return (
                    <Link
                      key={c.id}
                      href={`/admin/classes?class=${c.id}`}
                      aria-current={on ? "page" : undefined}
                      className={`flex min-h-[44px] items-center justify-between rounded-xl px-3 text-[15px] ${on ? "bg-c1 font-extrabold text-white" : "font-semibold text-brand-slate hover:bg-brand-cloud"}`}
                    >
                      <span>{classLabel(c.name, c.arm)}</span>
                      <span className={`text-[13px] ${on ? "text-white" : "text-[#4A5A70]"}`}>{counts.get(c.id) ?? 0} students</span>
                    </Link>
                  );
                })}
              </div>
            ))}
            <details className="group border-t border-[#EEF3F9] pt-3">
              <summary className="s-btn2 w-full cursor-pointer list-none">+ Add a class</summary>
              <ActionForm action={addClass} resetOnSuccess className="mt-3 flex flex-col gap-3">
                <div>
                  <label className="label" htmlFor="nc-name">Class name</label>
                  <input className="sk-input" id="nc-name" name="name" placeholder="e.g. JSS 1" required />
                </div>
                <div>
                  <label className="label" htmlFor="nc-arms">Arms</label>
                  <input className="sk-input" id="nc-arms" name="arms" placeholder="e.g. A, B, C" aria-describedby="nc-arms-hint" />
                  <p id="nc-arms-hint" className="mt-1 text-[13px] text-[#4A5A70]">Leave empty if the class has one arm. Separate arms with commas.</p>
                </div>
                <SubmitButton pending="Adding…">Add class</SubmitButton>
              </ActionForm>
            </details>
          </nav>

          {sel && (
            <div className="flex flex-col gap-4">
              <Panel
                id="cl-h"
                title={classLabel(sel.name, sel.arm)}
                actions={
                  <Link className="s-btn2" href={`/admin/students?class=${sel.id}`}>
                    View {counts.get(sel.id) ?? 0} students
                  </Link>
                }
              >
                <ActionForm action={updateClass} className="flex flex-col gap-3">
                  <input type="hidden" name="class_id" value={sel.id} />
                  <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-[1fr_120px_1.4fr]">
                    <div>
                      <label className="label" htmlFor="c-name">Class name</label>
                      <input className="sk-input" id="c-name" name="name" defaultValue={sel.name} required />
                    </div>
                    <div>
                      <label className="label" htmlFor="c-arm">Arm</label>
                      <input className="sk-input" id="c-arm" name="arm" defaultValue={sel.arm} />
                    </div>
                    <div>
                      <label className="label" htmlFor="c-teacher">Class teacher</label>
                      <select className="sk-input sk-select" id="c-teacher" name="class_teacher_id" defaultValue={sel.class_teacher_id ?? ""}>
                        <option value="">No class teacher yet</option>
                        {teachers.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {teachers.length === 0 && (
                    <p className="text-sm text-[#4A5A70]">
                      No teachers yet.{" "}
                      <Link href="/admin/staff" className="s-link">
                        Invite your teachers
                      </Link>{" "}
                      to choose a class teacher.
                    </p>
                  )}
                  <div className="flex justify-end">
                    <SubmitButton>Save class</SubmitButton>
                  </div>
                </ActionForm>
              </Panel>

              <Panel id="sub-h" title={`Subjects and teachers (${cs.length})`}>
                {cs.length ? (
                  <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Table: scroll sideways to see more">
                    <table className="tbl min-w-[520px]">
                      <caption className="sr-only">Subjects for {classLabel(sel.name, sel.arm)} and who teaches them</caption>
                      <thead>
                        <tr>
                          <th scope="col">Subject</th>
                          <th scope="col">Subject teacher</th>
                          <th scope="col">
                            <span className="sr-only">Remove</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {cs.map((c) => (
                          <tr key={c.id}>
                            <th scope="row">{c.subjects?.name}</th>
                            <td>
                              <input type="hidden" name="cs_id" value={c.id} form="cs-form" />
                              <label className="sr-only" htmlFor={`t_${c.id}`}>
                                Teacher for {c.subjects?.name}
                              </label>
                              <select className="sk-input sk-select min-w-[220px]" id={`t_${c.id}`} name={`t_${c.id}`} form="cs-form" defaultValue={c.teacher_id ?? ""}>
                                <option value="">No teacher yet</option>
                                {teachers.map((t) => (
                                  <option key={t.id} value={t.id}>
                                    {t.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="text-right">
                              <ActionForm action={removeClassSubject} className="flex flex-col items-end gap-1">
                                <input type="hidden" name="cs_id" value={c.id} />
                                <SubmitButton className="min-h-[44px] rounded-lg px-3 text-sm font-bold text-[#B42318] underline underline-offset-2" pending="Removing…">
                                  Remove<span className="sr-only"> {c.subjects?.name}</span>
                                </SubmitButton>
                              </ActionForm>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <Empty>No subjects on this class yet. Add them below.</Empty>
                )}
                {noTeacher.length > 0 && cs.length > 0 && (
                  <p className="rounded-xl bg-[#FFF6E3] px-4 py-3 text-sm text-[#5C4310]">
                    {noTeacher.length === cs.length ? "No subject has a teacher yet." : `${noTeacher.slice(0, 3).join(", ")}${noTeacher.length > 3 ? ` and ${noTeacher.length - 3} more` : ""} ${noTeacher.length === 1 ? "has" : "have"} no teacher yet.`} Assign
                    teachers so scores can be entered.
                  </p>
                )}
                {cs.length > 0 && (
                  <div className="flex flex-wrap justify-end gap-2.5">
                    {otherArms.length > 0 && (
                      <ActionForm action={copySubjectsToArms} className="flex flex-col gap-2">
                        <input type="hidden" name="class_id" value={sel.id} />
                        <SubmitButton className="s-btn2" pending="Copying…">
                          Copy subjects to {otherArms.map((a) => classLabel(a.name, a.arm)).join(", ")}
                        </SubmitButton>
                      </ActionForm>
                    )}
                    <ActionForm action={saveClassSubjects} id="cs-form" className="flex flex-col gap-2">
                      <SubmitButton>Save teachers</SubmitButton>
                    </ActionForm>
                  </div>
                )}

                <ActionForm action={addSubjectToClass} resetOnSuccess className="flex flex-col gap-3 rounded-2xl bg-brand-cloud p-4">
                  <input type="hidden" name="class_id" value={sel.id} />
                  <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                    <div>
                      <label className="label" htmlFor="add-sub">Add a subject</label>
                      <select className="sk-input sk-select" id="add-sub" name="subject_id" defaultValue="">
                        <option value="">Choose a subject…</option>
                        {notOnClass.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label" htmlFor="new-sub">Or a new subject</label>
                      <input className="sk-input" id="new-sub" name="new_subject" placeholder="e.g. Music" />
                    </div>
                    <SubmitButton pending="Adding…">Add</SubmitButton>
                  </div>
                </ActionForm>
              </Panel>

              <details className="rounded-[18px] border border-[#E3EAF3] bg-white p-[22px]">
                <summary className="flex min-h-[44px] cursor-pointer list-none items-center font-heading text-lg font-extrabold text-c1">Remove this class</summary>
                <ActionForm action={deleteClass} className="mt-3 flex flex-col items-start gap-3">
                  <input type="hidden" name="class_id" value={sel.id} />
                  <p className="text-sm text-[#4A5A70]">You can only remove a class with no students in it.</p>
                  <SubmitButton className="s-btn-danger" pending="Removing…">
                    Remove {classLabel(sel.name, sel.arm)}
                  </SubmitButton>
                </ActionForm>
              </details>
            </div>
          )}
        </div>
      )}

      {classes.length > 0 && (
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-2">
          <Panel id="all-sub-h" title={`All subjects (${subjects?.length ?? 0})`}>
            <ul className="flex flex-wrap gap-2">
              {(subjects ?? []).map((s) => (
                <li key={s.id} className="flex items-center gap-1 rounded-full bg-brand-cloud py-1 pl-3 pr-1 text-sm font-semibold">
                  {s.name}
                  <ActionForm action={deleteSubject} className="contents">
                    <input type="hidden" name="subject_id" value={s.id} />
                    <SubmitButton className="flex h-8 w-8 items-center justify-center rounded-full text-[#B42318] hover:bg-white" pending="…">
                      <span aria-hidden="true">×</span>
                      <span className="sr-only">Delete {s.name}</span>
                    </SubmitButton>
                  </ActionForm>
                </li>
              ))}
            </ul>
            <ActionForm action={addSubject} resetOnSuccess className="flex flex-col gap-2">
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[200px] flex-1">
                  <label className="label" htmlFor="ns-name">New subject</label>
                  <input className="sk-input" id="ns-name" name="name" placeholder="e.g. Music" required />
                </div>
                <SubmitButton pending="Adding…">Add subject</SubmitButton>
              </div>
            </ActionForm>
          </Panel>
          <TemplatePanel />
        </div>
      )}
    </AdminPage>
  );
}

function TemplatePanel({ first = false }: { first?: boolean }) {
  return (
    <Panel id="tpl-h" title={first ? "Set up your classes" : "Add more from the Nigerian template"}>
      <p className="text-[15px] text-[#4A5A70]">
        {first ? "Start with the usual Nigerian classes and subjects. You can rename, add or remove anything afterwards." : "Adds any missing classes and subjects. Classes you already have are left as they are."}
      </p>
      <ActionForm action={applyTemplate} className="flex flex-col gap-4">
        <fieldset className="flex flex-col gap-2">
          <legend className="label">Sections in your school</legend>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-2">
            {SECTIONS.map((s) => (
              <label key={s.key} className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl border-[1.5px] border-[#DCE5F0] px-3">
                <input type="checkbox" name="section" value={s.key} defaultChecked={first && (s.key === "jss" || s.key === "ss")} className="h-5 w-5 accent-[var(--c2,#0B7D6E)]" />
                <span>
                  <span className="block font-bold text-brand-slate">{s.label}</span>
                  <span className="block text-[13px] text-[#4A5A70]">
                    {s.classes[0]} – {s.classes[s.classes.length - 1]}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="max-w-xs">
          <label className="label" htmlFor="tpl-arms">Arms in each class</label>
          <input className="sk-input" id="tpl-arms" name="arms" defaultValue="A" aria-describedby="tpl-arms-hint" />
          <p id="tpl-arms-hint" className="mt-1 text-[13px] text-[#4A5A70]">For example: A, B, C or Gold, Silver</p>
        </div>
        <div>
          <SubmitButton pending="Setting up…">{first ? "Create classes and subjects" : "Add from template"}</SubmitButton>
        </div>
      </ActionForm>
    </Panel>
  );
}
