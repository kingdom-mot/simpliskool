import { releaseDueSoon } from "@/lib/announce";
import { requireSchool } from "@/lib/auth";
import { LEGAL_VERSION } from "@/lib/legal";
import { AdminView, type AdminData } from "./AdminView";

export default async function AdminHome() {
  const { supabase, school, membership, fullName } = await requireSchool(["owner", "admin", "principal", "bursar"]);
  await releaseDueSoon();
  const [{ data }, agreed] = await Promise.all([
    supabase.rpc("admin_dashboard", { p_school: school.id }),
    // Owners are reminded until they accept the current terms and data processing agreement (not in the demo).
    membership.role === "owner"
      ? Promise.all([
          supabase.from("legal_acceptances").select("id", { count: "exact", head: true }).eq("school_id", school.id).eq("document", "dpa").eq("version", LEGAL_VERSION),
          supabase.from("schools").select("is_demo").eq("id", school.id).maybeSingle<{ is_demo: boolean }>(),
        ]).then(([a, s]) => (a.error ? true : (a.count ?? 0) > 0 || !!s.data?.is_demo))
      : Promise.resolve(true),
  ]);
  return <AdminView school={school} role={membership.role} fullName={fullName} d={(data as AdminData | null) ?? null} agreementDue={!agreed} />;
}
