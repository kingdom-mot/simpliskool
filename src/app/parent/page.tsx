import { requireSchool } from "@/lib/auth";
import { ParentView, type ParentData } from "./ParentView";

export default async function ParentHome({ searchParams }: { searchParams: { child?: string } }) {
  const { supabase, school, fullName } = await requireSchool(["parent"]);
  const { data } = await supabase.rpc("parent_dashboard", { p_school: school.id });
  return <ParentView school={school} fullName={fullName} d={(data as ParentData | null) ?? null} childId={searchParams.child} />;
}
