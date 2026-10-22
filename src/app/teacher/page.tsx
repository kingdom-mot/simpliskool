import { PortalShell } from "@/components/PortalShell";
import { requireSchool } from "@/lib/auth";

type ClassRow = { id: string; name: string; arm: string };
type SubjectRow = { id: string; classes: ClassRow | null; subjects: { name: string } | null };

export default async function TeacherHome() {
  const { supabase, school, user } = await requireSchool(["teacher"]);

  const [{ data: formClasses }, { data: subjectClasses }] = await Promise.all([
    supabase.from("classes").select("id, name, arm").eq("school_id", school.id).eq("class_teacher_id", user.id).returns<ClassRow[]>(),
    supabase
      .from("class_subjects")
      .select("id, classes(id, name, arm), subjects(name)")
      .eq("school_id", school.id)
      .eq("teacher_id", user.id)
      .returns<SubjectRow[]>(),
  ]);

  return (
    <PortalShell schoolName={school.name} roleLabel="Teacher">
      <h1 className="text-2xl font-semibold text-brand-navy">My classes</h1>

      <section className="mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Class teacher for</h2>
        {formClasses?.length ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {formClasses.map((c) => (
              <div key={c.id} className="card">
                <p className="font-semibold text-brand-navy">{c.name} {c.arm}</p>
                <p className="mt-1 text-sm text-slate-600">Register, results and report comments</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-600">You are not a class teacher this term.</p>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Subjects I teach</h2>
        {subjectClasses?.length ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {subjectClasses.map((cs) => (
              <div key={cs.id} className="card">
                <p className="font-semibold text-brand-navy">{cs.subjects?.name}</p>
                <p className="mt-1 text-sm text-slate-600">{cs.classes?.name} {cs.classes?.arm}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-600">No subjects assigned yet. Ask your school administrator.</p>
        )}
      </section>
    </PortalShell>
  );
}
