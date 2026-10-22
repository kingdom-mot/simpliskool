"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
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

  const supabase = createClient();
  const { data: schoolId, error } = await supabase.rpc("create_school", { p_name: parsed.data.name, p_slug: parsed.data.slug });
  if (error) {
    if (error.code === "23505") return { error: "That web address is taken. Try another." };
    return { error: error.message };
  }

  cookies().set(SCHOOL_COOKIE, schoolId as string, { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 60 * 60 * 24 * 180 });
  redirect("/admin");
}
