import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

/** Set while a Dream Savvy team member is viewing a school (read only). */
export const VIEW_COOKIE = "sk_view";

export type ActiveView = { id: string; school_id: string; expires_at: string; reason: string; school: { id: string; name: string; slug: string; logo_url: string | null; primary_color: string | null; secondary_color: string | null } };

/**
 * The open viewing session for this person, if any. Never during a form
 * submission: viewers can look, not change anything (the database also refuses
 * any change made while viewing).
 */
export const activeView = cache(async (userId: string): Promise<ActiveView | null> => {
  const id = (await cookies()).get(VIEW_COOKIE)?.value;
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) return null;
  if ((await headers()).get("next-action")) return null;
  try {
    const { data } = await createAdminClient()
      .from("platform_views")
      .select("id, school_id, expires_at, reason, ended_at, schools(id, name, slug, logo_url, primary_color, secondary_color)")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle<{ id: string; school_id: string; expires_at: string; reason: string; ended_at: string | null; schools: ActiveView["school"] | null }>();
    if (!data || data.ended_at || !data.schools || Date.parse(data.expires_at) <= Date.now()) return null;
    return { id: data.id, school_id: data.school_id, expires_at: data.expires_at, reason: data.reason, school: data.schools };
  } catch {
    return null;
  }
});
