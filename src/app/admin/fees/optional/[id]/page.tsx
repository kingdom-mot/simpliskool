import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminPage, Panel, classLabel, requireAdminPage } from "@/components/admin";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Empty } from "@/components/ui";
import { FINANCE_ROLES, feeSectionOf } from "@/lib/fees";
import { naira } from "@/lib/format";
import { levelOrder } from "@/lib/nigeria";
import { saveOptionalStudents } from "../../actions";

export const metadata = { title: "Choose students" };

type Item = { id: string; name: string; amount_kobo: number; section: string | null; level: string | null; optional: boolean; term_id: string; fee_item_students: { student_id: string }[] };
type Student = { id: string; first_name: string; last_name: string; admission_no: string; classes: { id: string; name: string; arm: string } | null };

export default async function OptionalStudents(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const ctx = await requireAdminPage(FINANCE_ROLES);
  const { supabase, school } = ctx;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: item } = await supabase
    .from("fee_items")
    .select("id, name, amount_kobo, section, level, optional, term_id, fee_item_students(student_id)")
    .eq("id", id)
    .eq("school_id", school.id)
    .maybeSingle<Item>();
  if (!item) notFound();

  const { data: rows } = await supabase
    .from("students")
    .select("id, first_name, last_name, admission_no, classes(id, name, arm)")
    .eq("school_id", school.id)
    .eq("status", "active")
    .not("class_id", "is", null)
    .order("last_name")
    .returns<Student[]>();
  const fits = (s: Student) => {
    const n = s.classes?.name.trim() ?? "";
    return (!item.section || feeSectionOf(n) === item.section) && (!item.level || item.level.toLowerCase() === n.toLowerCase());
  };
  const students = (rows ?? []).filter(fits);
  const chosen = new Set(item.fee_item_students.map((f) => f.student_id));
  const groups = new Map<string, { label: string; order: number; list: Student[] }>();
  for (const s of students) {
    const c = s.classes!;
    const g = groups.get(c.id) ?? { label: classLabel(c.name, c.arm), order: levelOrder(c.name), list: [] };
    g.list.push(s);
    groups.set(c.id, g);
  }
  const sorted = [...groups.values()].sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
  const back = `/admin/fees?term=${item.term_id}${item.section ? `&section=${item.section}` : ""}`;

  return (
    <AdminPage ctx={ctx} active="fees" crumb={[{ label: "Fee setup", href: back }]} title={`Who pays for ${item.name}?`}>
      <p className="-mt-2 text-sm text-[#4A5A70]">
        {naira(item.amount_kobo)} per student. Only the students ticked here get it on their invoice.
      </p>
      {!item.optional ? (
        <Empty>This item isn&apos;t optional, so every student in its classes pays it.</Empty>
      ) : sorted.length === 0 ? (
        <Empty>No students in these classes yet.</Empty>
      ) : (
        <ActionForm action={saveOptionalStudents} className="flex flex-col gap-4">
          <input type="hidden" name="item" value={item.id} />
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sorted.map((g) => (
              <Panel key={g.label} id={`g-${g.label.replace(/\W/g, "")}`} title={g.label}>
                <fieldset className="flex flex-col">
                  <legend className="sr-only">Students in {g.label}</legend>
                  {g.list.map((s) => (
                    <label key={s.id} className="flex min-h-[44px] items-center gap-3 border-b border-[#EEF3F9] text-sm last:border-0">
                      <input type="checkbox" name="student" value={s.id} defaultChecked={chosen.has(s.id)} className="h-5 w-5" />
                      <span className="font-semibold text-brand-slate">
                        {s.first_name} {s.last_name}
                      </span>
                      <span className="ml-auto text-xs text-[#4A5A70]">{s.admission_no}</span>
                    </label>
                  ))}
                </fieldset>
              </Panel>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <SubmitButton>Save students</SubmitButton>
            <Link className="s-link text-sm" href={back}>
              Back to fee setup
            </Link>
          </div>
        </ActionForm>
      )}
    </AdminPage>
  );
}
