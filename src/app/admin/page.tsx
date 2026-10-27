import { requireSchool } from "@/lib/auth";
import { AdminView, type AdminData } from "./AdminView";

export default async function AdminHome() {
  const { supabase, school, membership, fullName } = await requireSchool(["owner", "admin", "principal", "bursar"]);
  const { data } = await supabase.rpc("admin_dashboard", { p_school: school.id });
  return <AdminView school={school} role={membership.role} fullName={fullName} d={(data as AdminData | null) ?? null} />;
}
