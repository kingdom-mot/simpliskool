import { SECTIONS, sectionOfClass } from "@/lib/nigeria";
import { TERM_NAME } from "@/lib/format";
import type { Role } from "@/lib/auth";

/** Who handles money: same rule as is_finance() in the database. */
export const FINANCE_ROLES: Role[] = ["owner", "admin", "bursar"];

export type FeeSection = "nursery" | "primary" | "jss" | "ss" | "other";

export const FEE_SECTIONS: { key: FeeSection; label: string }[] = [
  ...SECTIONS.map((s) => ({ key: s.key as FeeSection, label: s.label })),
  { key: "other", label: "Other classes" },
];

export function feeSectionOf(className: string): FeeSection {
  return sectionOfClass(className) ?? "other";
}

export const METHOD_LABEL: Record<string, string> = { transfer: "Bank transfer", cash: "Cash", pos: "POS", paystack: "Online (card or transfer)" };

/** "85,000" or "₦85,000.50" -> kobo. Null if it isn't a sensible amount. */
export function toKobo(input: string): number | null {
  const s = input.replace(/[₦,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const kobo = Math.round(Number(s) * 100);
  return Number.isSafeInteger(kobo) && kobo <= 100_000_000_000 ? kobo : null;
}

/** Kobo -> "85000" or "85000.50", for an amount input. */
export function koboInput(kobo: number): string {
  return kobo % 100 === 0 ? String(kobo / 100) : (kobo / 100).toFixed(2);
}

export type TermOption = { id: string; term_no: number; is_current: boolean; session: string };

export function termLabel(t: { term_no: number; session: string }) {
  return `${TERM_NAME[t.term_no]} ${t.session}`;
}

/** Newest first: by session name, then term number. */
export function sortTerms<T extends TermOption>(terms: T[]): T[] {
  return [...terms].sort((a, b) => (a.session === b.session ? b.term_no - a.term_no : b.session.localeCompare(a.session)));
}

/** All the school's terms (newest first) and the one to show. */
type DB = Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>;
export async function loadTerms(supabase: DB, schoolId: string, wanted?: string) {
  const { data } = await supabase
    .from("terms")
    .select("id, term_no, is_current, academic_sessions(name)")
    .eq("school_id", schoolId)
    .returns<{ id: string; term_no: number; is_current: boolean; academic_sessions: { name: string } | null }[]>();
  const terms = sortTerms(((data ?? []) as { id: string; term_no: number; is_current: boolean; academic_sessions: { name: string } | null }[]).map((t) => ({ id: t.id, term_no: t.term_no, is_current: t.is_current, session: t.academic_sessions?.name ?? "" })));
  const term = terms.find((t) => t.id === wanted) ?? terms.find((t) => t.is_current) ?? terms[0] ?? null;
  return { terms, term };
}
