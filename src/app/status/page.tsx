import Link from "next/link";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Setup check · Simpliskool", robots: { index: false } };

type Check = { label: string; ok: boolean | null; detail?: string; fix?: string };

const MISSING_FN = /PGRST202|Could not find the function|does not exist/i;

async function fnExists(admin: ReturnType<typeof createAdminClient>, name: string, args: Record<string, unknown>) {
  const { error } = await admin.rpc(name, args);
  if (!error) return { ok: true };
  if (MISSING_FN.test(`${error.code} ${error.message}`)) return { ok: false, detail: "Not found in the database" };
  return { ok: true, detail: `Exists (test call said: ${error.message.slice(0, 80)})` };
}

/** A setup check anyone can open: shows which settings and database updates are in place. Shows no private data. */
export default async function StatusPage(props: { searchParams: Promise<{ problem?: string }> }) {
  const { problem } = await props.searchParams;
  const h = await headers();
  const host = h.get("host") ?? "";
  const env: Check[] = [
    { label: "NEXT_PUBLIC_SUPABASE_URL", ok: !!process.env.NEXT_PUBLIC_SUPABASE_URL, fix: "Vercel → Settings → Environment Variables" },
    { label: "NEXT_PUBLIC_SUPABASE_ANON_KEY", ok: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, fix: "Vercel → Settings → Environment Variables" },
    { label: "SUPABASE_SERVICE_ROLE_KEY (server only)", ok: !!process.env.SUPABASE_SERVICE_ROLE_KEY, fix: "Supabase → Project Settings → API → service_role key, then add it in Vercel" },
    { label: "NEXT_PUBLIC_ROOT_DOMAIN", ok: !!process.env.NEXT_PUBLIC_ROOT_DOMAIN, detail: process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "not set (defaults to simpliskool.com)" },
    { label: "RESEND_API_KEY (absence emails)", ok: !!process.env.RESEND_API_KEY, fix: "resend.com → API Keys, then add it in Vercel (the same key used for Supabase SMTP works)" },
    { label: "ANTHROPIC_API_KEY (optional: AI comment suggestions)", ok: process.env.ANTHROPIC_API_KEY ? true : null, detail: process.env.ANTHROPIC_API_KEY ? "AI suggestions are on" : "Not set: teachers get suggestions built from the scores instead" },
    { label: "NEXT_PUBLIC_SITE_URL", ok: !!process.env.NEXT_PUBLIC_SITE_URL, detail: process.env.NEXT_PUBLIC_SITE_URL ?? "not set" },
  ];

  const db: Check[] = [];
  let admin: ReturnType<typeof createAdminClient> | null = null;
  try {
    admin = createAdminClient();
  } catch {
    db.push({ label: "Database connection", ok: false, detail: "Needs SUPABASE_SERVICE_ROLE_KEY to check the database" });
  }
  if (admin) {
    const { error: e1 } = await admin.from("schools").select("id", { head: true, count: "exact" });
    const denied = (m?: string) => /permission denied/i.test(m ?? "");
    db.push({
      label: "0001 foundation (tables)",
      ok: !e1,
      detail: e1 ? `${e1.code ?? ""} ${e1.message || "No access to the tables"}`.trim() : undefined,
      fix: e1 ? (denied(e1.message) || !e1.message ? "Run 0008_grants.sql in the Supabase SQL Editor (gives the app permission to use its tables)" : "Run 0001_foundation.sql") : undefined,
    });
    if (!e1) {
      const { error: e2 } = await admin.from("memberships").select("id").eq("role", "principal").limit(1);
      db.push({ label: "0002 principal role", ok: !e2, detail: e2 ? "Missing: run 0002 on its own" : undefined });
      const f3 = await fnExists(admin, "verify_student_pin", { p_school_slug: "-", p_admission_no: "-", p_pin: "0000" });
      db.push({ label: "0003 sign-in and principal", ...f3 });
      const { error: e4 } = await admin.from("schools").select("primary_color").is("primary_color", null).limit(1);
      db.push({ label: "0004 school colours", ok: !e4, detail: e4?.message });
      const zero = "00000000-0000-0000-0000-000000000000";
      db.push({ label: "0005 dashboards", ...(await fnExists(admin, "admin_dashboard", { p_school: zero })) });
      db.push({ label: "0006 admin setup", ...(await fnExists(admin, "staff_list", { p_school: zero })) });
      const f7 = await fnExists(admin, "attendance_overview", { p_school: zero, p_date: "2026-01-01" });
      db.push({ label: "0007 attendance and notifications", ...f7 });
      const { error: e9 } = await admin.from("schools").select("motto").limit(1);
      const { error: b9 } = await admin.storage.getBucket("school-logos");
      const f10 = await fnExists(admin, "fee_overview", { p_school: zero, p_term: zero, p_class: null });
      db.push({ label: "0010 fees and payments", ...f10 });
      db.push({ label: "0012 timetable, announcements, mark split", ...(await fnExists(admin, "assessment_parts", { p_school: zero })) });
      db.push({ label: "0011 scores and results", ...(await fnExists(admin, "class_results", { p_class: zero, p_term: zero })) });
      db.push({ label: "0009 school settings (motto, logo storage)", ok: !e9 && !b9, detail: e9 || b9 ? "Missing: run 0009_school_settings.sql, then 0008_grants.sql again" : undefined });
    }
  }

  // The signed-in person (if any): can we read their schools?
  const me: Check[] = [];
  try {
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) me.push({ label: "Signed in", ok: null, detail: "Not signed in. Sign in, then open this page again to check your account." });
    else {
      me.push({ label: "Signed in", ok: true, detail: auth.user.email ?? auth.user.phone ?? "" });
      const { data, error } = await supabase.from("memberships").select("role, schools(name, slug)").eq("user_id", auth.user.id);
      me.push({
        label: "Your schools",
        ok: !error,
        fix: error && /permission denied/i.test(error.message) ? "Run 0008_grants.sql in the Supabase SQL Editor" : undefined,
        detail: error ? `Error reading your schools: ${error.message}` : data?.length ? data.map((m) => `${(m.schools as unknown as { name: string } | null)?.name ?? "?"} (${m.role})`).join(", ") : "None yet: create a school at /onboarding",
      });
    }
  } catch (e) {
    me.push({ label: "Signed in", ok: false, detail: e instanceof Error ? e.message : "Couldn't check" });
  }

  const sections: [string, Check[]][] = [
    ["Vercel settings", env],
    ["Database updates (Supabase SQL files)", db],
    ["Your account", me],
  ];

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-3xl">Setup check</h1>
      {problem && (
        <p role="alert" className="mt-4 rounded-xl bg-[#FEF3F2] px-4 py-3 text-[15px] font-semibold text-[#912018]">
          {problem === "memberships" ? "We couldn't load your schools from the database, so you were brought here instead of the dashboard." : "Your account is linked to a school we can't open."} The red items below show what needs fixing.
        </p>
      )}
      <p className="mt-2 text-[15px] text-[#4A5A70]">
        This page is open to anyone and shows only whether things are set up, never keys or data. You are on <strong>{host}</strong>.
      </p>
      {sections.map(([title, list]) => (
        <section key={title} aria-labelledby={title} className="mt-6 rounded-2xl border border-[#E3EAF3] bg-white p-5">
          <h2 id={title} className="text-lg">
            {title}
          </h2>
          <ul className="mt-3 divide-y divide-[#EEF3F9]">
            {list.map((c) => (
              <li key={c.label} className="flex items-start gap-3 py-2.5">
                <span aria-hidden="true" className={`mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full text-sm font-black text-white ${c.ok === null ? "bg-[#6B7A90]" : c.ok ? "bg-[#0B7D6E]" : "bg-[#B42318]"}`}>
                  {c.ok === null ? "–" : c.ok ? "✓" : "!"}
                </span>
                <span className="min-w-0">
                  <span className="block font-bold text-brand-navy [overflow-wrap:anywhere]">
                    {c.label}
                    <span className="sr-only">{c.ok === null ? ": not checked" : c.ok ? ": OK" : ": problem"}</span>
                  </span>
                  {c.detail && <span className="block text-sm text-[#4A5A70] [overflow-wrap:anywhere]">{c.detail}</span>}
                  {c.ok === false && c.fix && <span className="block text-sm text-[#912018]">Fix: {c.fix}</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p className="mt-6 text-sm">
        <Link className="font-bold text-brand-teal-dark underline" href="/dashboard">
          Go to your dashboard
        </Link>
      </p>
    </main>
  );
}
