import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";

/** Features Dream Savvy can switch off for every school, or for one school. */
export const FEATURES = [
  { key: "ai", label: "AI teaching assistant", note: "All plans · pilot schools have it on", nav: ["ai"] },
  { key: "cbt", label: "CBT tests", note: "All plans", nav: ["cbt", "questions"] },
  { key: "payroll", label: "Payroll", note: "All plans · pension and PAYE optional", nav: ["payroll"] },
  { key: "grp", label: "Group portal", note: "For schools with more than one branch", nav: [] },
  { key: "inspect", label: "Inspector links for lesson notes", note: "All plans", nav: [] },
  { key: "wa", label: "WhatsApp messages", note: "Not ready yet", nav: [] },
] as const;
export type FeatureKey = (typeof FEATURES)[number]["key"];

export type PlanKey = "pilot" | "single" | "group";
export const PLAN_LABEL: Record<PlanKey, string> = { pilot: "Pilot", single: "Single school", group: "School group" };

export type PlatformSettings = {
  fee_kobo: number;
  flags: Record<FeatureKey, boolean>;
  trial_days: number;
  free_sms: number;
  sms_price: string;
  pin_tries: number;
  pin_lock_minutes: number;
  view_minutes: number;
  pilot_ends: string | null;
  plans: Record<PlanKey, { price: string; desc: string }>;
};

export const DEFAULT_SETTINGS: PlatformSettings = {
  fee_kobo: 0,
  flags: { ai: true, cbt: true, payroll: true, grp: true, inspect: true, wa: false },
  trial_days: 30,
  free_sms: 500,
  sms_price: "",
  pin_tries: 5,
  pin_lock_minutes: 15,
  view_minutes: 30,
  pilot_ends: null,
  plans: {
    pilot: { price: "Free", desc: "Everything included until the pilot ends. For our first 20 schools." },
    single: { price: "", desc: "All features for one school. SMS bought separately." },
    group: { price: "", desc: "For 2 or more branches. Adds the group portal and shared settings." },
  },
};

function merge(raw: Partial<PlatformSettings> | null | undefined): PlatformSettings {
  const r = raw ?? {};
  return {
    ...DEFAULT_SETTINGS,
    ...r,
    flags: { ...DEFAULT_SETTINGS.flags, ...(r.flags ?? {}) },
    plans: {
      pilot: { ...DEFAULT_SETTINGS.plans.pilot, ...(r.plans?.pilot ?? {}) },
      single: { ...DEFAULT_SETTINGS.plans.single, ...(r.plans?.single ?? {}) },
      group: { ...DEFAULT_SETTINGS.plans.group, ...(r.plans?.group ?? {}) },
    },
  };
}

/** The platform settings (defaults if 0018 hasn't been run yet). Once per request. */
export const getSettings = cache(async (): Promise<PlatformSettings> => {
  try {
    const { data } = await createAdminClient().from("platform_settings").select("data").eq("id", true).maybeSingle<{ data: Partial<PlatformSettings> }>();
    return merge(data?.data);
  } catch {
    return DEFAULT_SETTINGS;
  }
});

/** A school's own switches win; otherwise the platform-wide switch decides. */
export function featureOnFor(settings: PlatformSettings, schoolFeatures: Partial<Record<FeatureKey, boolean>> | null | undefined, key: FeatureKey) {
  const own = schoolFeatures?.[key];
  return typeof own === "boolean" ? own : settings.flags[key];
}

/** Which features are off for this school. Once per request. */
export const featuresOff = cache(async (schoolId: string): Promise<Set<FeatureKey>> => {
  const settings = await getSettings();
  let own: Partial<Record<FeatureKey, boolean>> | null = null;
  try {
    const { data } = await createAdminClient().from("schools").select("features").eq("id", schoolId).maybeSingle<{ features: Partial<Record<FeatureKey, boolean>> | null }>();
    own = data?.features ?? null;
  } catch {
    // before 0018: everything stays on
  }
  return new Set(FEATURES.map((f) => f.key).filter((k) => !featureOnFor(settings, own, k)));
});

export async function featureOn(schoolId: string, key: FeatureKey) {
  return !(await featuresOff(schoolId)).has(key);
}

/** Menu keys to hide because their feature is off. */
export async function hiddenNavKeys(schoolId: string) {
  const off = await featuresOff(schoolId);
  return new Set(FEATURES.filter((f) => off.has(f.key)).flatMap((f) => [...f.nav]));
}
