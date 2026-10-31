import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;
export type AuditKind = "view" | "money" | "access" | "other";
export type AuditRow = { id: string; at: string; who: string; action: string; kind: AuditKind; school: string; detail: string };

/**
 * The back office's own log, plus the most sensitive things school owners do
 * (changing the payout account), newest first.
 */
export async function auditRows(admin: Admin, opts: { kinds: AuditKind[] | null; q: string; limit: number }): Promise<AuditRow[]> {
  let p = admin.from("platform_audit").select("id, created_at, actor_name, action, kind, detail, school_name").order("created_at", { ascending: false }).limit(opts.limit);
  if (opts.kinds) p = p.in("kind", opts.kinds);
  const wantMoney = !opts.kinds || opts.kinds.includes("money");
  const [{ data: own }, { data: school }] = await Promise.all([
    p.returns<{ id: number; created_at: string; actor_name: string | null; action: string; kind: AuditKind; detail: string | null; school_name: string | null }[]>(),
    wantMoney
      ? admin.from("audit_log").select("id, created_at, actor_id, action, school_id, schools(name)").eq("table_name", "school_payouts").order("created_at", { ascending: false }).limit(Math.min(200, opts.limit)).returns<{ id: number; created_at: string; actor_id: string | null; action: string; school_id: string | null; schools: { name: string } | null }[]>()
      : Promise.resolve({ data: [] as { id: number; created_at: string; actor_id: string | null; action: string; school_id: string | null; schools: { name: string } | null }[] }),
  ]);
  const ids = [...new Set((school ?? []).map((s) => s.actor_id).filter((x): x is string => !!x))];
  const { data: people } = ids.length ? await admin.from("profiles").select("id, full_name").in("id", ids).returns<{ id: string; full_name: string | null }[]>() : { data: [] as { id: string; full_name: string | null }[] };
  const name = new Map((people ?? []).map((x) => [x.id, x.full_name ?? "School staff"]));
  const rows: AuditRow[] = [
    ...(own ?? []).filter((r) => r.action !== "Wrong two-step code" || !opts.kinds).map((r) => ({ id: `p${r.id}`, at: r.created_at, who: r.actor_name ?? "Team member", action: r.action, kind: r.kind, school: r.school_name ?? "—", detail: r.detail ?? "" })),
    ...(school ?? []).map((r) => ({
      id: `s${r.id}`,
      at: r.created_at,
      who: `${r.actor_id ? name.get(r.actor_id) : "School"} (school)`,
      action: r.action === "DELETE" ? "Removed payout account" : r.action === "INSERT" ? "Added payout account" : "Changed payout account",
      kind: "money" as const,
      school: r.schools?.name ?? "—",
      detail: "Online payments pause until the new account is checked",
    })),
  ];
  const q = opts.q.trim().toLowerCase();
  return rows
    .filter((r) => !q || [r.who, r.action, r.school, r.detail].some((v) => v.toLowerCase().includes(q)))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, opts.limit);
}
