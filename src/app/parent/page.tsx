import { PortalShell } from "@/components/PortalShell";
import { requireSchool } from "@/lib/auth";

type Child = {
  student_id: string;
  relationship: string | null;
  students: { first_name: string; last_name: string; admission_no: string; classes: { name: string; arm: string } | null } | null;
};

export default async function ParentHome() {
  const { supabase, school, user } = await requireSchool(["parent"]);

  const { data: children } = await supabase
    .from("guardians")
    .select("student_id, relationship, students(first_name, last_name, admission_no, classes(name, arm))")
    .eq("school_id", school.id)
    .eq("user_id", user.id)
    .returns<Child[]>();

  return (
    <PortalShell schoolName={school.name} roleLabel="Parent">
      <h1 className="text-2xl font-semibold text-brand-navy">My children</h1>
      {children?.length ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {children.map((c) => (
            <div key={c.student_id} className="card">
              <p className="text-lg font-semibold text-brand-navy">
                {c.students?.first_name} {c.students?.last_name}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {c.students?.classes ? `${c.students.classes.name} ${c.students.classes.arm}` : "Class not set"} · {c.students?.admission_no}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-600">No children are linked to your account yet. Please contact the school.</p>
      )}
    </PortalShell>
  );
}
