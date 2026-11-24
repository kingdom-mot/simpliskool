import { releaseDueSoon } from "@/lib/announce";
import { requireSchool } from "@/lib/auth";
import { LEGAL_VERSION } from "@/lib/legal";
import { SurveyCard } from "@/components/SurveyCard";
import { surveyDue } from "@/lib/survey-due";
import { StaffClock, type MyClock } from "@/components/StaffClock";
import { AdminView, type AdminData } from "./AdminView";

export default async function AdminHome() {
  const { supabase, school, membership, fullName, viewing } =
    await requireSchool(["owner", "admin", "principal", "bursar"]);
  await releaseDueSoon();
  const [{ data }, agreed, due, { data: clock }] = await Promise.all([
    supabase.rpc("admin_dashboard", { p_school: school.id }),
    // Owners are reminded until they accept the current terms and data processing agreement (not in the demo).
    membership.role === "owner"
      ? Promise.all([
          supabase
            .from("legal_acceptances")
            .select("id", { count: "exact", head: true })
            .eq("school_id", school.id)
            .eq("document", "dpa")
            .eq("version", LEGAL_VERSION),
          supabase
            .from("schools")
            .select("is_demo")
            .eq("id", school.id)
            .maybeSingle<{ is_demo: boolean }>(),
        ]).then(([a, s]) =>
          a.error ? true : (a.count ?? 0) > 0 || !!s.data?.is_demo,
        )
      : Promise.resolve(true),
    surveyDue(supabase, school.id, membership.role),
    // Principals, admins and bursars clock in too. Null for an owner who isn't also staff.
    viewing || membership.role === "owner"
      ? Promise.resolve({ data: null })
      : supabase.rpc("my_staff_clock", { p_school: school.id }),
  ]);
  const extra = (
    <>
      {clock && <StaffClock c={clock as MyClock} />}
      {due && (
        <SurveyCard survey={due.survey} group={due.group} page="/admin" />
      )}
    </>
  );
  return (
    <AdminView
      school={school}
      role={membership.role}
      fullName={fullName}
      d={(data as AdminData | null) ?? null}
      agreementDue={!agreed}
      extra={clock || due ? extra : undefined}
    />
  );
}
