import { PortalShell } from "@/components/PortalShell";
import { requireSchool } from "@/lib/auth";

export default async function StudentHome() {
  const { supabase, school, user } = await requireSchool(["student"]);
  const { data: me } = await supabase
    .from("students")
    .select("first_name, last_name, classes(name, arm)")
    .eq("user_id", user.id)
    .maybeSingle<{ first_name: string; last_name: string; classes: { name: string; arm: string } | null }>();

  return (
    <PortalShell schoolName={school.name} roleLabel="Student">
      <h1 className="text-2xl font-semibold text-brand-navy">Hello{me ? `, ${me.first_name}` : ""}</h1>
      <p className="mt-1 text-sm text-slate-600">{me?.classes ? `${me.classes.name} ${me.classes.arm}` : "Your class will appear here."}</p>
    </PortalShell>
  );
}
