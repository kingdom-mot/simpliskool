import { createBrowserClient } from "@supabase/ssr";

/** Browser Supabase client, or null when this deployment has no Supabase settings. */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createBrowserClient(url, key);
}
