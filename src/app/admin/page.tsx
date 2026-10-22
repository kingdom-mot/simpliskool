import { PortalShell } from "@/components/PortalShell";
import { requireSchool } from "@/lib/auth";

export default async function AdminHome() {
  const { supabase, school, membership } = await requireSchool(["owner", "admin", "bursar"]);
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "simpliskool.com";

  const count = (table: string) =>
    supabase.from(table).select("id", { count: "exact", head: true }).eq("school_id", school.id);

  const [students, classes, subjects, staff, sessions, feeItems, applications] = await Promise.all([
    count("students"),
    count("classes"),
    count("subjects"),
    supabase.from("memberships").select("id", { count: "exact", head: true }).eq("school_id", school.id).in("role", ["admin", "bursar", "teacher"]),
    supabase.from("academic_sessions").select("id", { count: "exact", head: true }).eq("school_id", school.id).eq("is_current", true),
    count("fee_items"),
    supabase.from("admission_applications").select("id", { count: "exact", head: true }).eq("school_id", school.id).eq("status", "new"),
  ]);

  const stats = [
    { label: "Students", value: students.count ?? 0 },
    { label: "Classes", value: classes.count ?? 0 },
    { label: "Staff", value: staff.count ?? 0 },
    { label: "New admission applications", value: applications.count ?? 0 },
  ];

  const setup = [
    { label: "Set the current session and term", done: (sessions.count ?? 0) > 0 },
    { label: "Create classes", done: (classes.count ?? 0) > 0 },
    { label: "Add subjects", done: (subjects.count ?? 0) > 0 },
    { label: "Add students and parents", done: (students.count ?? 0) > 0 },
    { label: "Invite teachers and bursar", done: (staff.count ?? 0) > 0 },
    { label: "Set this term's fees", done: (feeItems.count ?? 0) > 0 },
  ];
  const doneCount = setup.filter((s) => s.done).length;

  return (
    <PortalShell schoolName={school.name} roleLabel={membership.role === "bursar" ? "Bursar" : "Administrator"}>
      <h1 className="text-2xl font-semibold text-brand-navy">Welcome to {school.name}</h1>
      <p className="mt-1 text-sm text-slate-600">
        Your school website:{" "}
        <a className="font-medium text-brand-teal hover:underline" href={`https://${school.slug}.${rootDomain}`}>
          {school.slug}.{rootDomain}
        </a>
      </p>

      <section className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card">
            <p className="text-3xl font-semibold text-brand-navy">{s.value}</p>
            <p className="mt-1 text-sm text-slate-600">{s.label}</p>
          </div>
        ))}
      </section>

      <section className="card mt-6">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold text-brand-navy">Set up your school</h2>
          <span className="text-sm text-slate-500">{doneCount} of {setup.length} done</span>
        </div>
        <div className="mt-3 h-2 rounded-full bg-slate-100">
          <div className="h-2 rounded-full bg-brand-teal" style={{ width: `${(doneCount / setup.length) * 100}%` }} />
        </div>
        <ul className="mt-4 divide-y divide-slate-100">
          {setup.map((s) => (
            <li key={s.label} className="flex items-center gap-3 py-2.5 text-sm">
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${s.done ? "bg-brand-teal text-white" : "border border-slate-300"}`}>
                {s.done ? "✓" : ""}
              </span>
              <span className={s.done ? "text-slate-500 line-through" : "text-slate-800"}>{s.label}</span>
            </li>
          ))}
        </ul>
      </section>
    </PortalShell>
  );
}
