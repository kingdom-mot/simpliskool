// The privacy policy, terms of use and data processing agreement.
// When the wording of the terms or the agreement changes, change LEGAL_VERSION: school owners are
// then asked to accept the new version, and the date of each acceptance is kept as proof.

export const LEGAL_VERSION = "2026-11-23";
export const LEGAL_UPDATED = "23 November 2026";
export const COMPANY = "Dream Savvy Solutions";
export const COMPANY_PLACE = "Lagos, Nigeria";
/** Where privacy questions and requests to Dream Savvy go. */
export const PRIVACY_EMAIL = "enquiries@simpliskool.com";

/** The outside services that process data for Simpliskool (sub-processors). */
export const SUBPROCESSORS = [
  { name: "Supabase", what: "Database, file storage and sign-in", data: "All school records", where: "Outside Nigeria (cloud data centre)" },
  { name: "Vercel", what: "Runs the Simpliskool website and app", data: "Pages as they are shown; request logs", where: "Outside Nigeria (global network)" },
  { name: "Paystack", what: "Online fee payments", data: "Payer name, email, amount, reference", where: "Nigeria and outside Nigeria" },
  { name: "Termii", what: "Text messages (SMS)", data: "Phone numbers and message text", where: "Nigeria" },
  { name: "Resend", what: "Emails", data: "Email addresses and message text", where: "Outside Nigeria" },
  { name: "Anthropic", what: "Optional AI writing help for teachers", data: "A student's first name and results (report comments only); lesson topics", where: "Outside Nigeria" },
] as const;

export const DOCS = [
  { href: "/privacy", label: "Privacy policy" },
  { href: "/terms", label: "Terms of use" },
  { href: "/dpa", label: "Data processing agreement" },
] as const;

/** Full address of a legal page, for links from school websites (which run on their own subdomain). */
export function legalUrl(path: string) {
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "simpliskool.com";
  return `${root.startsWith("localhost") ? "http" : "https"}://${root}${path}`;
}
