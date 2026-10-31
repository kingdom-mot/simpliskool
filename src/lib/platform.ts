import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import type { NavGroup } from "@/lib/nav";
import { createAdminClient } from "@/lib/supabase/admin";
import { readPass } from "@/lib/totp";

/** The Dream Savvy back office: who can sign in and what each role may do. */
export type TeamRole = "super" | "support" | "finance" | "growth";
export const TEAM_ROLE_LABEL: Record<TeamRole, string> = { super: "Super admin", support: "Support", finance: "Finance", growth: "Business development" };
export const TEAM_ROLES: TeamRole[] = ["support", "growth", "finance", "super"];
export const PASS_COOKIE = "sk_2fa";
export const PASS_HOURS = 12;

const NAV: NavGroup[] = [
  {
    label: "Platform",
    items: [
      { key: "overview", label: "Overview", href: "/super" },
      { key: "schools", label: "Schools and groups", href: "/super/schools" },
      { key: "approvals", label: "New school checks", href: "/super/checks" },
    ],
  },
  {
    label: "Money",
    items: [
      { key: "payments", label: "Payments and payouts", href: "/super/payments" },
      { key: "billing", label: "Plans and billing", href: "/super/billing" },
    ],
  },
  {
    label: "Support",
    items: [
      { key: "support", label: "Support inbox", href: "/super/support" },
      { key: "messaging", label: "SMS and email", href: "/super/messaging" },
      { key: "notices", label: "Notices to schools", href: "/super/notices" },
    ],
  },
  {
    label: "Control",
    items: [
      { key: "audit", label: "Audit log", href: "/super/audit" },
      { key: "team", label: "Dream Savvy team", href: "/super/team" },
      { key: "platform", label: "Platform settings", href: "/super/platform" },
    ],
  },
];

const PAGES: Record<TeamRole, string[] | null> = {
  super: null,
  support: ["overview", "schools", "approvals", "payments", "support", "messaging", "notices"],
  finance: ["overview", "schools", "payments", "billing", "messaging", "audit"],
  growth: ["overview", "schools", "approvals", "billing", "support", "notices"],
};

export type Ability =
  | "school.add" // sign a school up for someone
  | "school.edit" // plan, features, notes
  | "school.suspend"
  | "school.owner" // change the owner's sign-in
  | "approve" // new school checks
  | "view" // view as a school
  | "money" // refunds, disputes, payouts
  | "billing" // plan prices
  | "billing.talk" // pilot conversations
  | "support" // assign, close, internal notes
  | "support.reply"
  | "notices"
  | "sms" // add SMS credit
  | "sender" // sender names
  | "audit.all"
  | "audit.money"
  | "team"
  | "platform";

const ALL: Ability[] = ["school.add", "school.edit", "school.suspend", "school.owner", "approve", "view", "money", "billing", "billing.talk", "support", "support.reply", "notices", "sms", "sender", "audit.all", "audit.money", "team", "platform"];
const CAN: Record<TeamRole, Ability[]> = {
  super: ALL,
  support: ["school.owner", "view", "support", "support.reply", "notices", "sms", "sender"],
  finance: ["money", "billing", "billing.talk", "sms", "audit.money"],
  growth: ["school.add", "school.edit", "approve", "view", "billing.talk", "support.reply", "notices"],
};
export const can = (role: TeamRole, a: Ability) => CAN[role].includes(a);
export const canOpen = (role: TeamRole, page: string) => !PAGES[role] || PAGES[role]!.includes(page);

type TeamRow = { user_id: string; role: TeamRole; totp_secret: string | null; totp_on_at: string | null; last_seen_at: string | null };

/**
 * The signed-in team member (no two-step check), or null. People whose email is in
 * SUPER_ADMIN_EMAILS (set in Vercel) become super admins the first time they come here.
 */
export async function teamMember() {
  const ctx = await requireUser();
  const admin = createAdminClient();
  const { data, error } = await admin.from("platform_team").select("user_id, role, totp_secret, totp_on_at, last_seen_at").eq("user_id", ctx.user.id).maybeSingle<TeamRow>();
  if (error) return null; // 0018 not run yet
  let row = data;
  const listed = (process.env.SUPER_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (!row && ctx.user.email && listed.includes(ctx.user.email.toLowerCase())) {
    const { data: made } = await admin.from("platform_team").insert({ user_id: ctx.user.id, role: "super" }).select("user_id, role, totp_secret, totp_on_at, last_seen_at").single<TeamRow>();
    row = made;
    if (row) await admin.from("platform_audit").insert({ actor_id: ctx.user.id, actor_name: ctx.fullName, action: "Joined the team", kind: "access", detail: "Super admin (listed in SUPER_ADMIN_EMAILS)" });
  }
  if (!row) return null;
  return { ...ctx, admin, team: row };
}

/** A team member who has entered their two-step code, allowed on this page. */
export async function requirePlatform(page: string) {
  const m = await teamMember();
  if (!m) redirect("/dashboard");
  if (!m.team.totp_on_at || !readPass((await cookies()).get(PASS_COOKIE)?.value, m.user.id)) redirect("/super/two-step");
  const role = m.team.role;
  if (!canOpen(role, page)) redirect("/super");
  if (!m.team.last_seen_at || Date.now() - Date.parse(m.team.last_seen_at) > 5 * 60_000) {
    await m.admin.from("platform_team").update({ last_seen_at: new Date().toISOString() }).eq("user_id", m.user.id);
  }
  const { data: demoRows } = await m.admin.from("schools").select("id").eq("is_demo", true).then((r) => (r.error ? { data: [] as { id: string }[] } : r));
  const demo = (demoRows ?? []).map((d: { id: string }) => d.id);
  const skip = (ids: string[]) => (ids.length ? `(${ids.join(",")})` : null);
  const [checks, tickets] = await Promise.all([
    canOpen(role, "approvals")
      ? (skip(demo) ? m.admin.from("schools").select("id", { count: "exact", head: true }).not("id", "in", skip(demo)!) : m.admin.from("schools").select("id", { count: "exact", head: true })).is("payments_approved_at", null).eq("check_status", "waiting").eq("status", "active").then((r) => r.count ?? 0)
      : Promise.resolve(0),
    canOpen(role, "support") ? (skip(demo) ? m.admin.from("support_tickets").select("id", { count: "exact", head: true }).not("school_id", "in", skip(demo)!) : m.admin.from("support_tickets").select("id", { count: "exact", head: true })).eq("status", "open").then((r) => r.count ?? 0) : Promise.resolve(0),
  ]);
  const badge: Record<string, number> = { approvals: checks, support: tickets };
  const nav = NAV.map((g) => ({
    ...g,
    items: g.items.filter((i) => canOpen(role, i.key)).map((i) => (badge[i.key] ? { ...i, label: `${i.label} (${badge[i.key]})` } : i)),
  })).filter((g) => g.items.length);
  return {
    admin: m.admin,
    user: m.user,
    fullName: m.fullName,
    role,
    can: (a: Ability) => can(role, a),
    nav,
    counts: { checks, tickets },
  };
}
export type PlatformCtx = Awaited<ReturnType<typeof requirePlatform>>;

/** Adds a line to the audit log (which can't be edited afterwards). */
export async function logPlatform(ctx: Pick<PlatformCtx, "admin" | "user" | "fullName">, action: string, kind: "view" | "money" | "access" | "other", schoolId: string | null, detail?: string | null) {
  const school = schoolId ? (await ctx.admin.from("schools").select("name").eq("id", schoolId).maybeSingle<{ name: string }>()).data?.name ?? null : null;
  await ctx.admin.from("platform_audit").insert({ actor_id: ctx.user.id, actor_name: ctx.fullName, action, kind, school_id: schoolId, school_name: school, detail: detail?.slice(0, 500) ?? null });
}

/** "5 Nov, 2:14pm" in Lagos time. */
export function lagosTime(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  const day = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", day: "numeric", month: "short" }).format(d);
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", hour: "numeric", minute: "2-digit", hour12: true }).format(d).replace(" ", "").toLowerCase();
  return `${day}, ${time}`;
}

/** "Now", "12 min ago", "2 days ago". */
export function ago(iso: string | null | undefined, now: number) {
  if (!iso) return "Never";
  const m = Math.round((now - Date.parse(iso)) / 60_000);
  if (m < 5) return "Now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}
