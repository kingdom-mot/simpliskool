import Link from "next/link";
import { AdminPage, classLabel, Panel, requireAdminPage } from "@/components/admin";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Empty } from "@/components/ui";
import { initials } from "@/lib/theme";
import { addStudent } from "../actions";

export default async function NewStudentPage({ searchParams }: { searchParams: { class?: string } }) {
  const ctx = await requireAdminPage();
  const { supabase, school } = ctx;
  const { data: classes } = await supabase.from("classes").select("id, name, arm").eq("school_id", school.id).order("level_order").order("name").order("arm");
  const prefix = `${initials(school.name)}/${new Date().getFullYear()}/`;
  const { data: nextNo } = await supabase.rpc("next_admission_no", { p_school: school.id, p_prefix: prefix });
  const preset = classes?.find((c) => c.id === searchParams.class);

  return (
    <AdminPage ctx={ctx} active="students" crumb={[{ label: "Students", href: "/admin/students" }]} title="Add a student">
      {!classes?.length ? (
        <Empty>
          Add your classes first.{" "}
          <Link href="/admin/classes" className="s-link">
            Set up classes
          </Link>
        </Empty>
      ) : (
        <ActionForm action={addStudent} className="flex flex-col gap-4">
          <Panel id="st-h" title="Student">
            <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-3">
              <Field id="first_name" label="First name" required autoComplete="off" />
              <Field id="last_name" label="Surname" required autoComplete="off" />
              <Field id="other_names" label="Other names (optional)" autoComplete="off" />
              <div>
                <label className="label" htmlFor="class">Class</label>
                <select className="sk-input sk-select" id="class" name="class" required defaultValue={preset ? classLabel(preset.name, preset.arm) : ""}>
                  <option value="" disabled>
                    Choose a class
                  </option>
                  {classes.map((c) => (
                    <option key={c.id}>{classLabel(c.name, c.arm)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="gender">Gender</label>
                <select className="sk-input sk-select" id="gender" name="gender" defaultValue="">
                  <option value="">Not given</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
              <Field id="date_of_birth" label="Date of birth" type="date" />
              <div>
                <Field id="admission_no" label="Admission number" placeholder={String(nextNo ?? `${prefix}001`)} describedBy="adm-hint" />
                <p id="adm-hint" className="mt-1 text-[13px] text-[#4A5A70]">
                  Leave empty to use {String(nextNo ?? `${prefix}001`)}
                </p>
              </div>
            </div>
          </Panel>
          <Panel id="pa-h" title="Parent or guardian (optional)">
            <p className="text-sm text-[#4A5A70]">With a phone number or email, the parent can sign in to see results, attendance and fees.</p>
            <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
              <Field id="parent_name" label="Full name" autoComplete="off" />
              <div>
                <label className="label" htmlFor="relationship">Relationship</label>
                <select className="sk-input sk-select" id="relationship" name="relationship" defaultValue="">
                  <option value="">Not given</option>
                  <option>Father</option>
                  <option>Mother</option>
                  <option>Guardian</option>
                  <option>Other</option>
                </select>
              </div>
              <Field id="parent_phone" label="Phone number" type="tel" placeholder="08031234567" autoComplete="off" />
              <Field id="parent_email" label="Email" type="email" autoComplete="off" />
            </div>
          </Panel>
          <div className="flex flex-wrap justify-end gap-2.5">
            <Link href="/admin/students" className="s-btn2">
              Cancel
            </Link>
            <SubmitButton pending="Adding…">Add student</SubmitButton>
          </div>
        </ActionForm>
      )}
    </AdminPage>
  );
}

function Field({ id, label, type = "text", required, placeholder, autoComplete, describedBy }: { id: string; label: string; type?: string; required?: boolean; placeholder?: string; autoComplete?: string; describedBy?: string }) {
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <input className="sk-input" id={id} name={id} type={type} required={required} placeholder={placeholder} autoComplete={autoComplete} aria-describedby={describedBy} />
    </div>
  );
}
