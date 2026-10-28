import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { NavGroup } from "@/lib/nav";

export type GroupRole = "proprietor" | "finance" | "academic";
export const GROUP_ROLE_LABEL: Record<GroupRole, string> = { proprietor: "Proprietor", finance: "Group finance", academic: "Director of studies" };
export const GROUP_COOKIE = "sk_group";

export type Branch = { id: string; name: string; slug: string; address: string | null; phone: string | null; capacity: number | null; primary_color: string | null; secondary_color: string | null; logo_url: string | null; status: string };

const NAV: NavGroup[] = [
  { label: "Group", items: [{ key: "overview", label: "Overview", href: "/group" }, { key: "branches", label: "Branches", href: "/group/branches" }] },
  { label: "Money", items: [{ key: "finance", label: "Fees and payouts", href: "/group/finance" }, { key: "payroll", label: "Payroll", href: "/group/payroll" }] },
  {
    label: "Academics and people",
    items: [
      { key: "academics", label: "Results and standards", href: "/group/academics" },
      { key: "staff", label: "Staff across branches", href: "/group/staff" },
      { key: "admissions", label: "Admissions", href: "/group/admissions" },
    ],
  },
  {
    label: "Shared",
    items: [
      { key: "announcements", label: "Announcements", href: "/group/announcements" },
      { key: "settings", label: "Shared settings", href: "/group/settings" },
      { key: "team", label: "Group team", href: "/group/team" },
    ],
  },
];
/** What each group role may open (same as the design). */
const KEEP: Record<GroupRole, string[] | null> = {
  proprietor: null,
  finance: ["overview", "branches", "finance", "payroll"],
  academic: ["overview", "branches", "academics", "staff", "admissions", "announcements", "settings"],
};
export function groupNav(role: GroupRole): NavGroup[] {
  const keep = KEEP[role];
  return NAV.map((g) => ({ ...g, items: g.items.filter((i) => !keep || keep.includes(i.key)) })).filter((g) => g.items.length);
}

/**
 * The signed-in person's group and the branches they may see. Group pages read
 * branch data with the server key, so every query must stay inside `ids`.
 */
export async function requireGroup(page: string) {
  const { user, fullName } = await requireUser();
  const admin = createAdminClient();
  const { data: rows } = await admin.from("group_members").select("group_id, role, branch_ids, school_groups(id, name)").eq("user_id", user.id).returns<{ group_id: string; role: GroupRole; branch_ids: string[] | null; school_groups: { id: string; name: string } | null }[]>();
  if (!rows?.length) redirect("/dashboard");
  const wanted = (await cookies()).get(GROUP_COOKIE)?.value;
  const me = rows.find((r) => r.group_id === wanted) ?? rows[0];
  const keep = KEEP[me.role];
  if (keep && !keep.includes(page)) redirect("/group");
  const { data: all } = await admin.from("schools").select("id, name, slug, address, phone, capacity, primary_color, secondary_color, logo_url, status").eq("group_id", me.group_id).order("name").returns<Branch[]>();
  const branches = (all ?? []).filter((b) => !me.branch_ids || me.branch_ids.includes(b.id));
  const first = branches[0];
  return {
    admin,
    user,
    fullName,
    role: me.role,
    group: { id: me.group_id, name: me.school_groups?.name ?? "School group" },
    branches,
    ids: branches.map((b) => b.id),
    // For the side menu: the group's name in the first branch's colours.
    shell: { name: me.school_groups?.name ?? "School group", primary_color: first?.primary_color ?? null, secondary_color: first?.secondary_color ?? null, logo_url: first?.logo_url ?? null },
    nav: groupNav(me.role),
  };
}

export type GroupCtx = Awaited<ReturnType<typeof requireGroup>>;

/** Each branch's current term (id, name). */
export async function currentTerms(ctx: GroupCtx) {
  if (!ctx.ids.length) return new Map<string, { id: string; label: string }>();
  const { data } = await ctx.admin.from("terms").select("id, school_id, term_no, academic_sessions(name)").in("school_id", ctx.ids).eq("is_current", true).returns<{ id: string; school_id: string; term_no: number; academic_sessions: { name: string } | null }[]>();
  const N = ["", "First Term", "Second Term", "Third Term"];
  return new Map((data ?? []).map((t) => [t.school_id, { id: t.id, label: `${N[t.term_no] ?? "Term"} ${t.academic_sessions?.name ?? ""}`.trim() }]));
}

export const lagosToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date());
