import { releaseDueSoon } from "@/lib/announce";
import { requireSchool } from "@/lib/auth";
import { ParentView, type ParentData } from "./ParentView";

export default async function ParentHome(props: { searchParams: Promise<{ child?: string }> }) {
  const searchParams = await props.searchParams;
  const { supabase, school, fullName } = await requireSchool(["parent"]);
  await releaseDueSoon();
  const { data } = await supabase.rpc("parent_dashboard", { p_school: school.id });
  return <ParentView school={school} fullName={fullName} d={(data as ParentData | null) ?? null} childId={searchParams.child} />;
}
