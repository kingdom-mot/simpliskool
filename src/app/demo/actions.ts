"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SCHOOL_COOKIE } from "@/lib/auth";
import { PERSONAS, personaTarget, resetDemo, type PersonaKey } from "@/lib/demo";
import { GROUP_COOKIE } from "@/lib/group";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const opts = { httpOnly: true, sameSite: "lax" as const, secure: true, path: "/", maxAge: 60 * 60 * 12 };

/** Signs the visitor in as one of the demo people (no code needed) and opens their portal. */
export async function enterDemo(fd: FormData) {
  const key = String(fd.get("persona") ?? "") as PersonaKey;
  if (!PERSONAS.some((p) => p.key === key)) redirect("/demo");
  let target = await personaTarget(key);
  if (!target) {
    // First visit ever: build the demo.
    const built = await resetDemo().then(() => true).catch((e) => {
      console.error("Demo build failed", e);
      return false;
    });
    if (built) target = await personaTarget(key);
  }
  if (!target) redirect("/demo?error=setup");
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: target.email });
  const hashed = data?.properties?.hashed_token;
  if (error || !hashed) redirect("/demo?error=signin");
  const supabase = await createClient();
  const { error: vErr } = await supabase.auth.verifyOtp({ type: "email", token_hash: hashed });
  if (vErr) redirect("/demo?error=signin");
  const jar = await cookies();
  for (const c of ["sk_view", "sk_2fa"]) jar.delete(c);
  jar.set(SCHOOL_COOKIE, target.school, opts);
  if (target.group) jar.set(GROUP_COOKIE, target.group, opts);
  redirect(target.go);
}
