import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { activeView } from "@/lib/viewing";

export type Role = "owner" | "admin" | "principal" | "bursar" | "teacher" | "student" | "parent";

export const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner",
  admin: "Administrator",
  principal: "Principal",
  bursar: "Bursar",
  teacher: "Teacher",
  student: "Student",
  parent: "Parent",
};

export type Membership = {
  school_id: string;
  role: Role;
  schools: { id: string; name: string; slug: string; logo_url: string | null; primary_color: string | null; secondary_color: string | null; status?: string } | null;
};

export const SCHOOL_COOKIE = "sk_school";

export function homeForRole(role: Role): string {
  switch (role) {
    case "owner":
    case "admin":
    case "principal":
    case "bursar":
      return "/admin";
    case "teacher":
      return "/teacher";
    case "parent":
      return "/parent";
    case "student":
      return "/student";
  }
}

/** The signed-in user (one check with Supabase per request, shared by everything on the page). */
export const currentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/** Signed-in user plus their school memberships. Redirects to /login when signed out. */
export async function requireUser() {
  await cookies(); // signed-in pages are always rendered per request
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) redirect("/login?error=setup");
  const supabase = await createClient();
  const user = await currentUser();
  if (!user) redirect("/login");

  const [{ data: memberships, error: membershipError }, { data: profile }] = await Promise.all([
    supabase
      .from("memberships")
      .select("school_id, role, schools(id, name, slug, logo_url, primary_color, secondary_color, status)")
      .eq("user_id", user.id)
      .returns<Membership[]>(),
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle<{ full_name: string | null }>(),
  ]);

  // Never treat a database error as "no schools": that sends people back to onboarding in a loop.
  if (membershipError) {
    console.error("Loading memberships failed", membershipError);
    redirect("/status?problem=memberships");
  }

  const fullName = profile?.full_name?.trim() || user.email?.split("@")[0] || "there";
  // A Dream Savvy team member viewing a school sees it as its owner, read only.
  const viewing = await activeView(user.id);
  const own = (memberships ?? []).filter((m) => m.schools?.status !== "suspended");
  const suspended = (memberships ?? []).filter((m) => m.schools?.status === "suspended");
  const list: Membership[] = viewing ? [{ school_id: viewing.school_id, role: "owner", schools: { ...viewing.school, status: "active" } }] : own;
  return { supabase, user, fullName, memberships: list, suspended, viewing };
}

/** The school the user is working in, checked against the roles allowed on this page. */
export async function requireSchool(allowed: Role[], opts?: { allowSuspended?: boolean }) {
  const ctx = await requireUser();
  const selected = (await cookies()).get(SCHOOL_COOKIE)?.value;
  // Parents of a suspended school can still see and pay what they owe.
  const all = opts?.allowSuspended && !ctx.viewing ? [...ctx.memberships, ...ctx.suspended] : ctx.memberships;
  const inSchool = all.filter((m) => m.school_id === selected);
  const pool = ctx.viewing ? all : inSchool.length ? inSchool : all;
  const membership = pool.find((m) => allowed.includes(m.role));
  if (!membership) redirect(ctx.suspended.some((m) => allowed.includes(m.role)) ? "/suspended" : "/dashboard");
  if (!membership.schools) redirect("/status?problem=school-access");
  return { ...ctx, membership, school: membership.schools };
}
