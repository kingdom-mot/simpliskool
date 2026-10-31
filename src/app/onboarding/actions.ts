"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isDemoEmail } from "@/lib/demo";
import { createClient } from "@/lib/supabase/server";
import { SCHOOL_COOKIE } from "@/lib/auth";

const schema = z.object({
  name: z.string().trim().min(3, "Enter the school's full name"),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$/, "Use 3–40 lowercase letters, numbers or hyphens"),
});

export type OnboardingState = { error?: string };

export async function createSchool(_prev: OnboardingState, formData: FormData): Promise<OnboardingState> {
  const parsed = schema.safeParse({ name: formData.get("name"), slug: formData.get("slug") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: me } = await supabase.auth.getUser();
  if (isDemoEmail(me.user?.email)) return { error: "You're in the Simpliskool demo. Sign out, then sign up with your own email to create your school." };
  const { data: schoolId, error } = await supabase.rpc("create_school", { p_name: parsed.data.name, p_slug: parsed.data.slug });
  if (error) {
    console.error("create_school failed", error);
    if (error.code === "23505") return { error: "That web address is taken. Try another." };
    if (/function .*create_school|PGRST202/i.test(`${error.code} ${error.message}`)) return { error: "The database isn't set up yet (create_school is missing). Run the Supabase SQL files, then try again." };
    return { error: `We couldn't create the school: ${error.message}` };
  }

  // Make sure the new owner can actually see the school before moving on.
  const { data: mine, error: readError } = await supabase.from("memberships").select("id").eq("school_id", schoolId as string).limit(1);
  if (readError || !mine?.length) {
    console.error("New school not visible to its owner", readError);
    return { error: `The school was created, but your account can't open it yet${readError ? ` (${readError.message})` : ""}. Open simpliskool.com/status and send a screenshot to support.` };
  }

  (await cookies()).set(SCHOOL_COOKIE, schoolId as string, { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 60 * 60 * 24 * 180 });
  redirect("/admin");
}
