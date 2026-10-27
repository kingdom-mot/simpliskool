import { notFound } from "next/navigation";
import { AdminPage, classLabel, Panel, requireAdminPage, SETUP_ROLES } from "@/components/admin";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Pill } from "@/components/ui";
import { personInitials } from "@/lib/format";
import { addGuardian, removeGuardian, updateStudent } from "../actions";
import { SignInPanel } from "./SignInPanel";

type Student = {
  id: string;
  first_name: string;
  last_name: string;
  other_names: string | null;
  admission_no: string;
  gender: "male" | "female" | null;
  date_of_birth: string | null;
  class_id: string | null;
  status: "active" | "graduated" | "withdrawn";
  signin_method: "pin" | "own";
  created_at: string;
  classes: { name: string; arm: string } | null;
  profiles: { email: string | null; phone: string | null } | null;
  guardians: { id: string; relationship: string | null; user_id: string; profiles: { full_name: string | null; phone: string | null; email: string | null } | null }[];
};

function age(dob: string | null) {
  if (!dob) return null;
  const d = new Date(dob);
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  if (now < new Date(now.getFullYear(), d.getMonth(), d.getDate())) a--;
  return a;
}

export default async function StudentProfile({ params, searchParams }: { params: { id: string }; searchParams: { added?: string } }) {
  const ctx = await requireAdminPage([...SETUP_ROLES, "bursar"]);
  const { supabase, school, membership } = ctx;
  const canEdit = SETUP_ROLES.includes(membership.role);
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) notFound();

  const [{ data: s }, { data: classes }, { data: pin }] = await Promise.all([
    supabase
      .from("students")
      .select("id, first_name, last_name, other_names, admission_no, gender, date_of_birth, class_id, status, signin_method, created_at, classes(name, arm), profiles(email, phone), guardians(id, relationship, user_id, profiles(full_name, phone, email))")
      .eq("id", params.id)
      .eq("school_id", school.id)
      .maybeSingle<Student>(),
    supabase.from("classes").select("id, name, arm").eq("school_id", school.id).order("level_order").order("name").order("arm"),
    supabase.rpc("student_pin_status", { p_student: params.id }).maybeSingle<{ has_pin: boolean; set_at: string | null; failed_count: number; locked_until: string | null }>(),
  ]);
  if (!s) notFound();

  const name = `${s.first_name} ${s.last_name}`;
  const cls = s.classes ? classLabel(s.classes.name, s.classes.arm) : "No class";
  const years = age(s.date_of_birth);
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "simpliskool.com";
  const own = s.signin_method === "own" ? (s.profiles?.email && !s.profiles.email.endsWith("@students.simpliskool.com") ? s.profiles.email : s.profiles?.phone ? `+${s.profiles.phone.replace(/^\+/, "")}` : null) : null;

  return (
    <AdminPage ctx={ctx} active="students" crumb={[{ label: "Students", href: "/admin/students" }]} title={name}>
      {searchParams.added && (
        <p role="status" className="rounded-xl bg-[#E7F6F2] px-4 py-3 text-sm font-semibold text-[#0B6B5A]">
          {s.first_name} has been added. Create a PIN below so they can sign in.
        </p>
      )}
      <section aria-label="Student summary" className="flex flex-wrap items-center gap-4 rounded-[18px] border border-[#E3EAF3] bg-white p-5">
        <span aria-hidden="true" className="flex h-16 w-16 items-center justify-center rounded-2xl bg-c1 text-xl font-extrabold text-white">
          {personInitials(name)}
        </span>
        <div className="flex flex-col gap-1.5">
          <p className="text-[15px] text-[#4A5A70]">
            {[cls, s.admission_no, s.gender ? (s.gender === "male" ? "Male" : "Female") : null, years !== null ? `${years} years` : null].filter(Boolean).join(" · ")}
          </p>
          <div className="flex flex-wrap gap-2">
            <Pill kind={s.status === "active" ? "good" : "info"}>{s.status === "active" ? "Active" : s.status === "graduated" ? "Graduated" : "Left school"}</Pill>
            <Pill kind={s.guardians.length ? "good" : "warn"}>{s.guardians.length ? `${s.guardians.length} parent${s.guardians.length === 1 ? "" : "s"} linked` : "No parent linked"}</Pill>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Panel id="pd-h" title="Personal details">
            {canEdit ? (
              <ActionForm action={updateStudent} className="flex flex-col gap-3">
                <input type="hidden" name="id" value={s.id} />
                <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
                  <In id="first_name" label="First name" value={s.first_name} required />
                  <In id="last_name" label="Surname" value={s.last_name} required />
                  <In id="other_names" label="Other names" value={s.other_names ?? ""} />
                  <In id="admission_no" label="Admission number" value={s.admission_no} required />
                  <div>
                    <label className="label" htmlFor="class_id">Class</label>
                    <select className="sk-input sk-select" id="class_id" name="class_id" defaultValue={s.class_id ?? ""}>
                      <option value="">No class</option>
                      {(classes ?? []).map((c) => (
                        <option key={c.id} value={c.id}>
                          {classLabel(c.name, c.arm)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label" htmlFor="gender">Gender</label>
                    <select className="sk-input sk-select" id="gender" name="gender" defaultValue={s.gender ?? ""}>
                      <option value="">Not given</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                  </div>
                  <In id="date_of_birth" label="Date of birth" value={s.date_of_birth ?? ""} type="date" />
                  <div>
                    <label className="label" htmlFor="status">Status</label>
                    <select className="sk-input sk-select" id="status" name="status" defaultValue={s.status}>
                      <option value="active">Active</option>
                      <option value="graduated">Graduated</option>
                      <option value="withdrawn">Left school</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end">
                  <SubmitButton>Save details</SubmitButton>
                </div>
              </ActionForm>
            ) : (
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-[#4A5A70]">Date of birth</dt><dd className="font-bold text-c1">{s.date_of_birth ?? "—"}</dd></div>
                <div><dt className="text-[#4A5A70]">Class</dt><dd className="font-bold text-c1">{cls}</dd></div>
              </dl>
            )}
          </Panel>
        </div>

        <div className="flex flex-col gap-4">
          <Panel id="g-h" title="Parents and guardians">
            {s.guardians.length ? (
              <ul className="flex flex-col">
                {s.guardians.map((g) => (
                  <li key={g.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EEF3F9] py-3">
                    <span>
                      <span className="block font-bold text-c1">
                        {g.profiles?.full_name || "Parent"}
                        {g.relationship ? ` · ${g.relationship}` : ""}
                      </span>
                      <span className="text-[13px] text-[#4A5A70]">{[g.profiles?.phone ? `+${g.profiles.phone.replace(/^\+/, "")}` : null, g.profiles?.email].filter(Boolean).join(" · ")}</span>
                    </span>
                    {canEdit && (
                      <ActionForm action={removeGuardian} className="flex flex-col items-end gap-1">
                        <input type="hidden" name="guardian_id" value={g.id} />
                        <input type="hidden" name="student_id" value={s.id} />
                        <SubmitButton className="min-h-[44px] px-2 text-sm font-bold text-[#B42318] underline underline-offset-2" pending="Unlinking…">
                          Unlink<span className="sr-only"> {g.profiles?.full_name}</span>
                        </SubmitButton>
                      </ActionForm>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[#4A5A70]">No parent linked yet.</p>
            )}
            {canEdit && (
              <details className="group">
                <summary className="s-btn2 cursor-pointer list-none">+ Link a parent or guardian</summary>
                <ActionForm action={addGuardian} resetOnSuccess className="mt-3 flex flex-col gap-3">
                  <input type="hidden" name="student_id" value={s.id} />
                  <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
                    <In id="g-name" name="name" label="Full name" />
                    <div>
                      <label className="label" htmlFor="g-rel">Relationship</label>
                      <select className="sk-input sk-select" id="g-rel" name="relationship" defaultValue="">
                        <option value="">Not given</option>
                        <option>Father</option>
                        <option>Mother</option>
                        <option>Guardian</option>
                        <option>Other</option>
                      </select>
                    </div>
                    <In id="g-phone" name="phone" label="Phone number" type="tel" />
                    <In id="g-email" name="email" label="Email" type="email" />
                  </div>
                  <p className="text-[13px] text-[#4A5A70]">If the parent already uses Simpliskool for another child, use the same phone or email and we&apos;ll link this child to their account.</p>
                  <div>
                    <SubmitButton pending="Linking…">Link parent</SubmitButton>
                  </div>
                </ActionForm>
              </details>
            )}
          </Panel>

          {canEdit && (
            <Panel id="si-h" title={`How ${s.first_name} signs in`}>
              <SignInPanel
                studentId={s.id}
                firstName={s.first_name}
                name={name}
                className={cls}
                admissionNo={s.admission_no}
                schoolName={school.name}
                schoolCode={school.slug}
                loginHost={rootDomain}
                method={s.signin_method}
                hasPin={!!pin?.has_pin}
                pinSetAt={pin?.set_at ?? null}
                failedCount={pin?.failed_count ?? 0}
                ownContact={own}
              />
            </Panel>
          )}
        </div>
      </div>
    </AdminPage>
  );
}

function In({ id, name, label, value, type = "text", required }: { id: string; name?: string; label: string; value?: string; type?: string; required?: boolean }) {
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <input className="sk-input" id={id} name={name ?? id} type={type} defaultValue={value} required={required} />
    </div>
  );
}
