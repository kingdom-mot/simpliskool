import { createClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client with the service role key. Bypasses row-level security,
 * so only use it in server actions and route handlers, after checking permissions.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service role key is not configured");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Sign-in email for students who use admission number + PIN. Nothing is ever sent to it. */
export function studentLoginEmail(studentId: string) {
  return `s-${studentId}@students.simpliskool.com`;
}
