import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
  schools: { id: string; name: string; slug: string; logo_url: string | null; primary_color: string | null; secondary_color: string | null } | null;
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

/** Signed-in user plus their school memberships. Redirects to /login when signed out. */
export async function requireUser() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) redirect("/login?error=setup");
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: memberships }, { data: profile }] = await Promise.all([
    supabase
      .from("memberships")
      .select("school_id, role, schools(id, name, slug, logo_url, primary_color, secondary_color)")
      .eq("user_id", user.id)
      .returns<Membership[]>(),
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle<{ full_name: string | null }>(),
  ]);

  const fullName = profile?.full_name?.trim() || user.email?.split("@")[0] || "there";
  return { supabase, user, fullName, memberships: memberships ?? [] };
}

/** The school the user is working in, checked against the roles allowed on this page. */
export async function requireSchool(allowed: Role[]) {
  const ctx = await requireUser();
  const selected = cookies().get(SCHOOL_COOKIE)?.value;
  const inSchool = ctx.memberships.filter((m) => m.school_id === selected);
  const pool = inSchool.length ? inSchool : ctx.memberships;
  const membership = pool.find((m) => allowed.includes(m.role));
  if (!membership || !membership.schools) redirect("/dashboard");
  return { ...ctx, membership, school: membership.schools };
}
