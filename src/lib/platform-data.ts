import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

export type SchoolRow = {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  status: string;
  plan: string;
  created_at: string;
  group_id: string | null;
  group_name: string | null;
  owner_id: string | null;
  owner_name: string | null;
  owner_email: string | null;
  owner_phone: string | null;
  students: number;
  families_joined: number;
  staff: number;
  last_active: string | null;
  payout_bank: string | null;
  payout_account: string | null;
  payout_name: string | null;
  payout_verified: boolean | null;
  subaccount: string | null;
  payments_approved_at: string | null;
  check_status: string;
  sms_credit: number;
  sender_id: string | null;
  sender_status: string;
  pilot_ends: string | null;
  suspended_at: string | null;
};

/** Every school with the figures the back office needs. */
export async function schoolRows(admin: Admin): Promise<SchoolRow[]> {
  const { data, error } = await admin.rpc("platform_schools");
  if (error) throw new Error(`Run database file 0018_platform.sql in Supabase first (${error.message})`);
  return ((data ?? []) as SchoolRow[]).map((r) => ({ ...r, students: Number(r.students), families_joined: Number(r.families_joined), staff: Number(r.staff) }));
}

export const parentsPct = (r: SchoolRow) => (r.students ? Math.round((r.families_joined / r.students) * 100) : 0);

/** Healthy / Low use / At risk, from when anyone last signed in and how many parents joined. */
export function health(r: SchoolRow, now: number): { label: string; kind: "good" | "warn" | "bad" | "info" } {
  if (r.status === "suspended") return { label: "Suspended", kind: "info" };
  if (!r.payments_approved_at && r.check_status !== "approved" && r.students === 0) return { label: "To check", kind: "warn" };
  const days = r.last_active ? (now - Date.parse(r.last_active)) / 86_400_000 : Infinity;
  if (days >= 7) return { label: "At risk", kind: "bad" };
  if (days >= 2 || (r.students >= 20 && parentsPct(r) < 50)) return { label: "Low use", kind: "warn" };
  return { label: "Healthy", kind: "good" };
}

/** Does the bank account name look like the school's name? (Shared words, ignoring "LTD", "SCHOOL" and so on.) */
export function nameMatches(school: string, account: string | null) {
  if (!account) return null;
  const skip = new Set(["LTD", "LIMITED", "SCHOOL", "SCHOOLS", "COLLEGE", "ACADEMY", "THE", "AND", "INTERNATIONAL", "NURSERY", "PRIMARY", "OF", "&"]);
  const words = (s: string) => new Set(s.toUpperCase().replace(/[^A-Z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !skip.has(w)));
  const a = words(school);
  const b = words(account);
  if (!a.size) return true;
  return [...a].some((w) => b.has(w));
}

/** Payout account status for the schools list. */
export function payoutState(r: SchoolRow): { label: string; kind: "good" | "warn" | "bad" | "info" } {
  if (!r.payout_account) return { label: "Not added", kind: "info" };
  if (!r.subaccount) return { label: "Not working", kind: "bad" };
  if (!r.payments_approved_at) return nameMatches(r.name, r.payout_name) === false ? { label: "Name mismatch", kind: "bad" } : { label: "To check", kind: "warn" };
  return { label: "Verified", kind: "good" };
}

export const lagosMidnight = () => {
  const d = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date());
  return new Date(`${d}T00:00:00+01:00`).toISOString();
};
export const nowMs = () => Date.now();

/** "14 August 2026". */
export function longDay(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
}
export function shortDay(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}

export const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};
