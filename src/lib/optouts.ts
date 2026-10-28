import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

/**
 * People who turned off school emails or texts (Account → Messages).
 * Sign-in codes are not affected. If the table isn't there yet, nobody is opted out.
 */
export async function optedOut(admin: Admin, userIds: (string | null | undefined)[], channel: "email" | "sms"): Promise<Set<string>> {
  const ids = [...new Set(userIds.filter((x): x is string => !!x))];
  if (!ids.length) return new Set();
  const out = new Set<string>();
  for (let i = 0; i < ids.length; i += 300) {
    const { data, error } = await admin.from("message_optouts").select("user_id").eq("channel", channel).in("user_id", ids.slice(i, i + 300));
    if (error) return new Set();
    for (const r of (data ?? []) as { user_id: string }[]) out.add(r.user_id);
  }
  return out;
}
