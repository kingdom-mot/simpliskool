import Link from "next/link";
import { AdminPage, Panel, requireAdminPage } from "@/components/admin";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Empty, Pill } from "@/components/ui";
import { emailReady } from "@/lib/email";
import { FEE_SECTIONS, FINANCE_ROLES, feeSectionOf, koboInput, loadTerms, termLabel, type FeeSection } from "@/lib/fees";
import { naira } from "@/lib/format";
import { levelOrder } from "@/lib/nigeria";
import { addFeeItem, copyLastTerm, deleteFeeItem, saveTermSettings, updateFeeItem } from "./actions";
import { PublishInvoices } from "./PublishInvoices";

export const metadata = { title: "Fee setup" };

type Item = { id: string; name: string; amount_kobo: number; section: FeeSection | null; level: string | null; optional: boolean; position: number; fee_item_students: { count: number }[] };

export default async function FeesPage(props: { searchParams: Promise<{ term?: string; section?: string; copied?: string }> }) {
  const sp = await props.searchParams;
  const ctx = await requireAdminPage(FINANCE_ROLES);
  const { supabase, school } = ctx;
  const { terms, term } = await loadTerms(supabase, school.id, sp.term);

  if (!term) {
    return (
      <AdminPage ctx={ctx} active="fees" crumb={[{ label: "Finance" }]} title="Fee setup">
        <Empty>
          Fees are set for each term. First add this session and its terms on the{" "}
          <Link className="s-link" href="/admin/sessions">
            Sessions and terms
          </Link>{" "}
          page.
        </Empty>
      </AdminPage>
    );
  }

  const [{ data: classRows }, { data: studentRows }, { data: itemRows }, { data: settings }, { data: schoolRow }, { count: invoiceCount }] = await Promise.all([
    supabase.from("classes").select("id, name").eq("school_id", school.id).returns<{ id: string; name: string }[]>(),
    supabase.from("students").select("class_id").eq("school_id", school.id).eq("status", "active").not("class_id", "is", null).returns<{ class_id: string }[]>(),
    supabase
      .from("fee_items")
      .select("id, name, amount_kobo, section, level, optional, position, fee_item_students(count)")
      .eq("term_id", term.id)
      .order("position")
      .order("created_at")
      .returns<Item[]>(),
    supabase.from("fee_terms").select("due_on, allow_part, published_at").eq("term_id", term.id).maybeSingle<{ due_on: string | null; allow_part: boolean; published_at: string | null }>(),
    supabase.from("schools").select("payment_instructions").eq("id", school.id).maybeSingle<{ payment_instructions: string | null }>(),
    supabase.from("invoices").select("id", { count: "exact", head: true }).eq("term_id", term.id).gt("total_kobo", 0),
  ]);
  const items = itemRows ?? [];

  // Class levels ("JSS 1") per section, with active student numbers.
  const levelStudents = new Map<string, number>();
  const classLevel = new Map((classRows ?? []).map((c) => [c.id, c.name.trim()]));
  for (const c of classRows ?? []) levelStudents.set(c.name.trim(), levelStudents.get(c.name.trim()) ?? 0);
  for (const s of studentRows ?? []) {
    const lv = classLevel.get(s.class_id);
    if (lv) levelStudents.set(lv, (levelStudents.get(lv) ?? 0) + 1);
  }
  const levels = [...levelStudents.keys()].sort((a, b) => levelOrder(a) - levelOrder(b) || a.localeCompare(b));
  const sections = FEE_SECTIONS.filter((s) => levels.some((l) => feeSectionOf(l) === s.key) || items.some((i) => i.section === s.key));
  const section = sections.find((s) => s.key === sp.section) ?? sections[0];

  const previous = terms[terms.findIndex((t) => t.id === term.id) + 1];
  const qs = (o: Record<string, string>) => `/admin/fees?${new URLSearchParams({ term: term.id, ...o })}`;

  if (!section) {
    return (
      <AdminPage ctx={ctx} active="fees" crumb={[{ label: "Finance" }]} title="Fee setup">
        <Empty>
          Add your classes first on the{" "}
          <Link className="s-link" href="/admin/classes">
            Classes and subjects
          </Link>{" "}
          page. Fees are set for each section (Nursery, Primary, JSS, SS).
        </Empty>
      </AdminPage>
    );
  }

  const sectionItems = items.filter((i) => (i.section ?? section.key) === section.key);
  const sectionLevels = levels.filter((l) => feeSectionOf(l) === section.key);
  const appliesTo = (i: Item, lv: string) => !i.level || i.level.toLowerCase() === lv.toLowerCase();
  const perLevel = sectionLevels.map((lv) => ({
    level: lv,
    students: levelStudents.get(lv) ?? 0,
    required: sectionItems.filter((i) => !i.optional && appliesTo(i, lv)).reduce((a, i) => a + i.amount_kobo, 0),
  }));
  const optionalIncome = sectionItems.filter((i) => i.optional).reduce((a, i) => a + i.amount_kobo * (i.fee_item_students[0]?.count ?? 0), 0);
  const expected = perLevel.reduce((a, l) => a + l.required * l.students, 0) + optionalIncome;
  const sectionStudents = perLevel.reduce((a, l) => a + l.students, 0);
  const allRequired = [...new Set(perLevel.map((l) => l.required))];

  // Whole-term figures for the publish step.
  const totalStudents = [...levelStudents.values()].reduce((a, n) => a + n, 0);

  return (
    <AdminPage
      ctx={ctx}
      active="fees"
      crumb={[{ label: "Finance" }]}
      title="Fee setup"
      actions={
        <form method="get" className="flex flex-wrap items-end gap-2">
          <div>
            <label className="label" htmlFor="f-term">
              Term
            </label>
            <select className="sk-input py-2" id="f-term" name="term" defaultValue={term.id}>
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
      }
    >
      {sp.copied && items.length > 0 && (
        <p role="status" className="rounded-xl bg-[#E7F6F2] px-4 py-3 text-sm font-semibold text-[#0B6B5A]">
          {Number(sp.copied)} fee item{sp.copied === "1" ? "" : "s"} copied. Check the amounts in each section, then publish the invoices.
        </p>
      )}
      {items.length === 0 && previous && (
        <ActionForm action={copyLastTerm} className="flex flex-wrap items-center gap-3 rounded-[18px] border border-[#E3EAF3] bg-white p-4">
          <input type="hidden" name="term" value={term.id} />
          <input type="hidden" name="from" value={previous.id} />
          <p className="text-sm text-brand-slate">
            No fees for {termLabel(term)} yet. Start from {termLabel(previous)}&apos;s fees and change what&apos;s different.
          </p>
          <SubmitButton className="s-btn2" pending="Copying…">
            Copy from {termLabel(previous)}
          </SubmitButton>
        </ActionForm>
      )}

      <nav aria-label="Sections" className="flex flex-wrap gap-2">
        {sections.map((s) => {
          const on = s.key === section.key;
          const n = items.filter((i) => i.section === s.key).length;
          return (
            <Link
              key={s.key}
              href={qs({ section: s.key })}
              aria-current={on ? "page" : undefined}
              className={`flex min-h-[44px] items-center gap-2 rounded-xl border-[1.5px] px-4 text-sm font-bold ${on ? "border-c1 bg-c1 text-white" : "border-[#DCE5F0] bg-white text-brand-slate"}`}
            >
              {s.label}
              <span className={`rounded-full px-2 py-0.5 text-xs ${on ? "bg-white/20" : "bg-brand-cloud"}`}>{n}</span>
            </Link>
          );
        })}
      </nav>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4">
        <Panel id="items-h" title={`${section.label} fee items`}>
          {sectionItems.length ? (
            <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Fee items: scroll sideways to see more">
              <table className="tbl min-w-[860px]">
                <caption className="sr-only">
                  {section.label} fee items for {termLabel(term)}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Item</th>
                    <th scope="col">Amount (₦)</th>
                    <th scope="col">Classes</th>
                    <th scope="col">Optional</th>
                    <th scope="col">
                      <span className="sr-only">Save or remove</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sectionItems.map((i) => {
                    const f = `item-${i.id}`;
                    const picked = i.fee_item_students[0]?.count ?? 0;
                    return (
                      <tr key={i.id}>
                        <td>
                          <input form={f} name="name" aria-label={`Item name for ${i.name}`} className="sk-input w-full min-w-[200px] py-2" defaultValue={i.name} required maxLength={80} />
                        </td>
                        <td>
                          <input form={f} name="amount" aria-label={`Amount for ${i.name}`} className="sk-input w-32 py-2" inputMode="decimal" defaultValue={koboInput(i.amount_kobo)} required />
                        </td>
                        <td>
                          <select form={f} name="level" aria-label={`Classes for ${i.name}`} className="sk-input w-full min-w-[220px] py-2" defaultValue={i.level ?? ""}>
                            <option value="">All {section.key === "other" ? "other" : section.label.split(" (")[0]} classes</option>
                            {sectionLevels.map((l) => (
                              <option key={l} value={l}>
                                {l} only
                              </option>
                            ))}
                            {i.level && !sectionLevels.some((l) => l.toLowerCase() === i.level!.toLowerCase()) && <option value={i.level}>{i.level} only</option>}
                          </select>
                        </td>
                        <td>
                          <label className="flex min-h-[44px] items-center gap-2 text-sm">
                            <input form={f} type="checkbox" name="optional" value="1" defaultChecked={i.optional} className="h-5 w-5" />
                            <span className="sr-only">{i.name} is optional</span>
                            <span aria-hidden="true">Optional</span>
                          </label>
                          {i.optional && (
                            <Link className="s-link text-sm" href={`/admin/fees/optional/${i.id}?term=${term.id}`}>
                              {picked} student{picked === 1 ? "" : "s"} · choose
                              <span className="sr-only"> students for {i.name}</span>
                            </Link>
                          )}
                        </td>
                        <td>
                          <div className="flex flex-wrap items-start gap-2">
                            <ActionForm action={updateFeeItem} id={f} className="flex flex-col gap-1">
                              <input type="hidden" name="id" value={i.id} />
                              <SubmitButton className="s-btn2">
                                Save<span className="sr-only"> {i.name}</span>
                              </SubmitButton>
                            </ActionForm>
                            <ActionForm action={deleteFeeItem} className="flex flex-col gap-1">
                              <input type="hidden" name="id" value={i.id} />
                              <SubmitButton className="s-btn-danger" pending="Removing…">
                                Remove<span className="sr-only"> {i.name}</span>
                              </SubmitButton>
                            </ActionForm>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>No fee items for {section.label} yet. Add tuition and any other charges below.</Empty>
          )}
          <p className="text-[13px] text-[#4A5A70]">Optional items (like the school bus) are only added to the invoices of students you pick.</p>

          <ActionForm action={addFeeItem} resetOnSuccess className="grid grid-cols-[minmax(0,1fr)] items-end gap-3 rounded-xl bg-brand-cloud p-4 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1.2fr_auto]">
            <input type="hidden" name="term" value={term.id} />
            <input type="hidden" name="section" value={section.key} />
            <div>
              <label className="label" htmlFor="n-name">
                New item
              </label>
              <input id="n-name" name="name" className="sk-input" required maxLength={80} placeholder="e.g. Tuition" />
            </div>
            <div>
              <label className="label" htmlFor="n-amount">
                Amount (₦)
              </label>
              <input id="n-amount" name="amount" className="sk-input" inputMode="decimal" required placeholder="e.g. 65000" />
            </div>
            <div>
              <label className="label" htmlFor="n-level">
                Classes
              </label>
              <select id="n-level" name="level" className="sk-input" defaultValue="">
                <option value="">All {section.key === "other" ? "other" : section.label.split(" (")[0]} classes</option>
                {sectionLevels.map((l) => (
                  <option key={l} value={l}>
                    {l} only
                  </option>
                ))}
              </select>
            </div>
            <label className="flex min-h-[48px] items-center gap-2 text-sm font-semibold text-brand-slate">
              <input type="checkbox" name="optional" value="1" className="h-5 w-5" /> Optional
            </label>
            <div className="sm:col-span-2 lg:col-span-4">
              <SubmitButton pending="Adding…">+ Add fee item</SubmitButton>
            </div>
          </ActionForm>
        </Panel>

        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          <Panel id="sum-h" title="Summary">
            <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 text-sm">
              <dt className="text-[#4A5A70]">Required per student</dt>
              <dd className="text-right font-extrabold text-brand-slate">
                {allRequired.length <= 1 ? naira(allRequired[0] ?? 0) : `${naira(Math.min(...allRequired))} to ${naira(Math.max(...allRequired))}`}
              </dd>
              <dt className="text-[#4A5A70]">Students in {section.label}</dt>
              <dd className="text-right font-extrabold text-brand-slate">{sectionStudents}</dd>
              <dt className="text-[#4A5A70]">Expected income</dt>
              <dd className="text-right font-heading text-lg font-black text-c1">{naira(expected)}</dd>
            </dl>
            {perLevel.length > 1 && (
              <table className="tbl">
                <caption className="sr-only">Required fees for each class</caption>
                <thead>
                  <tr>
                    <th scope="col">Class</th>
                    <th scope="col">Students</th>
                    <th scope="col">Per student</th>
                  </tr>
                </thead>
                <tbody>
                  {perLevel.map((l) => (
                    <tr key={l.level}>
                      <th scope="row">{l.level}</th>
                      <td>{l.students}</td>
                      <td>{naira(l.required)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>

          <Panel id="pay-h" title="Payment settings">
            <ActionForm action={saveTermSettings} className="flex flex-col gap-3">
              <input type="hidden" name="term" value={term.id} />
              <div>
                <label className="label" htmlFor="due">
                  Payment due by
                </label>
                <input id="due" name="due_on" type="date" className="sk-input" defaultValue={settings?.due_on ?? ""} />
              </div>
              <label className="flex min-h-[44px] items-center gap-2 text-sm font-semibold text-brand-slate">
                <input type="checkbox" name="allow_part" value="1" defaultChecked={settings?.allow_part ?? true} className="h-5 w-5" />
                Allow part payments
              </label>
              <div>
                <label className="label" htmlFor="instr">
                  How parents pay
                </label>
                <span id="instr-h" className="mb-1.5 block text-[13px] text-[#4A5A70]">
                  Shown on invoices and in the parent app, for every term. For example: bank name, account number and account name.
                </span>
                <textarea
                  id="instr"
                  name="instructions"
                  aria-describedby="instr-h"
                  rows={3}
                  maxLength={600}
                  className="sk-input min-h-[96px] py-3"
                  defaultValue={schoolRow?.payment_instructions ?? ""}
                  placeholder={"GTBank 0123456789, Greenfield Academy.\nUse your child's name as the reference."}
                />
              </div>
              <div>
                <SubmitButton>Save payment settings</SubmitButton>
              </div>
            </ActionForm>
          </Panel>

          <Panel id="pub-h" title="Invoices">
            <p className="text-sm text-brand-slate">
              {settings?.published_at ? (
                <>
                  <Pill kind="good">Published</Pill>{" "}
                  {invoiceCount ?? 0} invoice{invoiceCount === 1 ? "" : "s"} for {termLabel(term)}. Publish again after changing fees; payments already made stay on each invoice.
                </>
              ) : (
                <>
                  <Pill kind="warn">Not published</Pill> Parents can&apos;t see {termLabel(term)}&apos;s fees until you publish the invoices.
                </>
              )}
            </p>
            <PublishInvoices termId={term.id} termName={termLabel(term)} students={totalStudents} hasItems={items.length > 0} again={!!settings?.published_at} emailReady={emailReady()} />
            {settings?.published_at && (
              <Link className="s-link text-sm" href={`/admin/payments?term=${term.id}`}>
                Go to payments and defaulters
              </Link>
            )}
          </Panel>
        </div>
      </div>
    </AdminPage>
  );
}
