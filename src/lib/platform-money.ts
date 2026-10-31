import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

export type Range = "week" | "30" | "term";
export const RANGE_LABEL: Record<Range, string> = { week: "Last 7 days", "30": "Last 30 days", term: "Last 120 days" };
export function rangeStart(r: Range, now: number) {
  return new Date(now - (r === "week" ? 7 : r === "30" ? 30 : 120) * 86_400_000).toISOString();
}

export type PayRow = {
  id: string;
  at: string;
  reference: string;
  school_id: string;
  school: string;
  payer: string;
  channel: string | null;
  amount: number;
  charge: number;
  status: "Paid" | "Refunded" | "Failed" | "Cancelled";
};

/** Online payments (and failed attempts) across every school since `from`. */
export async function onlinePayments(admin: Admin, from: string, limit = 500): Promise<PayRow[]> {
  const [{ data: pays }, { data: failed }] = await Promise.all([
    admin
      .from("payments")
      .select("id, created_at, paid_at, paystack_reference, school_id, amount_kobo, fees_kobo, channel, status, voided_at, void_reason, schools(name)")
      .eq("method", "paystack")
      .gte("created_at", from)
      .order("created_at", { ascending: false })
      .limit(limit)
      .returns<{ id: string; created_at: string; paid_at: string | null; paystack_reference: string | null; school_id: string; amount_kobo: number; fees_kobo: number | null; channel: string | null; status: string; voided_at: string | null; void_reason: string | null; schools: { name: string } | null }[]>(),
    admin
      .from("payment_intents")
      .select("reference, created_at, school_id, amount_kobo, created_by, schools(name)")
      .eq("status", "failed")
      .gte("created_at", from)
      .order("created_at", { ascending: false })
      .limit(100)
      .returns<{ reference: string; created_at: string; school_id: string; amount_kobo: number; created_by: string; schools: { name: string } | null }[]>(),
  ]);
  const refs = (pays ?? []).map((p) => p.paystack_reference).filter((r): r is string => !!r);
  const { data: intents } = refs.length
    ? await admin.from("payment_intents").select("reference, profiles(full_name)").in("reference", refs).returns<{ reference: string; profiles: { full_name: string | null } | null }[]>()
    : { data: [] as { reference: string; profiles: { full_name: string | null } | null }[] };
  const payer = new Map((intents ?? []).map((i) => [i.reference, i.profiles?.full_name ?? "Parent"]));
  const failedIds = [...new Set((failed ?? []).map((f) => f.created_by))];
  const { data: people } = failedIds.length ? await admin.from("profiles").select("id, full_name").in("id", failedIds).returns<{ id: string; full_name: string | null }[]>() : { data: [] as { id: string; full_name: string | null }[] };
  const pName = new Map((people ?? []).map((p) => [p.id, p.full_name ?? "Parent"]));
  const out: PayRow[] = [
    ...(pays ?? []).map((p) => ({
      id: p.id,
      at: p.paid_at ?? p.created_at,
      reference: p.paystack_reference ?? "—",
      school_id: p.school_id,
      school: p.schools?.name ?? "",
      payer: payer.get(p.paystack_reference ?? "") ?? "Parent",
      channel: p.channel,
      amount: Number(p.amount_kobo),
      charge: Number(p.fees_kobo ?? 0),
      status: (p.voided_at ? (/refund/i.test(p.void_reason ?? "") ? "Refunded" : "Cancelled") : p.status === "success" ? "Paid" : "Failed") as PayRow["status"],
    })),
    ...(failed ?? []).map((f) => ({ id: f.reference, at: f.created_at, reference: f.reference, school_id: f.school_id, school: f.schools?.name ?? "", payer: pName.get(f.created_by) ?? "Parent", channel: null, amount: Number(f.amount_kobo), charge: 0, status: "Failed" as const })),
  ];
  return out.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}
