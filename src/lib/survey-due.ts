import "server-only";
import { cookies } from "next/headers";
import { getSettings } from "@/lib/platform-settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { groupOf, SURVEYS, type Group, type SurveyKey } from "@/lib/surveys";

type Db = { from: ReturnType<typeof createAdminClient>["from"] };

/**
 * Which survey (if any) to show this person now:
 * - the end-of-pilot survey while Dream Savvy has it switched on (back office → Pilot measures);
 * - otherwise the baseline survey during a school's first weeks (30 days by default).
 * Never in the demo, never twice, and not for three days after "Not now".
 */
export async function surveyDue(supabase: Db, schoolId: string, role: string): Promise<{ survey: SurveyKey; group: Group } | null> {
  const group = groupOf(role);
  if (!group) return null;
  const settings = await getSettings();
  const { data: school } = await createAdminClient().from("schools").select("created_at, is_demo").eq("id", schoolId).maybeSingle<{ created_at: string; is_demo: boolean }>();
  if (!school || school.is_demo) return null;
  const baselineDays = settings.baseline_days ?? 30;
  const survey: SurveyKey | null = settings.end_survey_open ? "end" : Date.now() - Date.parse(school.created_at) < baselineDays * 864e5 ? "baseline" : null;
  if (!survey || !SURVEYS[survey].questions[group]) return null;
  if ((await cookies()).get("sk_survey_later")?.value === survey) return null;
  const { count, error } = await supabase.from("survey_responses").select("id", { count: "exact", head: true }).eq("school_id", schoolId).eq("survey", survey);
  if (error || (count ?? 0) > 0) return null; // already answered (each person only sees their own answers), or 0022 not run yet
  return { survey, group };
}
