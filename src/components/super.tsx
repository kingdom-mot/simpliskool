import Link from "next/link";
import { PageHero } from "@/components/admin";
import { PortalShell } from "@/components/PortalShell";
import { TEAM_ROLE_LABEL, type PlatformCtx } from "@/lib/platform";

const SHELL = { name: "Simpliskool back office", logo_url: null, primary_color: "#0A1F3D", secondary_color: "#0F9D8A" };

/** Side menu and header for the Dream Savvy back office. */
export function SuperShell({ ctx, active, title, sub, actions, crumb, children }: { ctx: PlatformCtx; active: string; title: string; sub?: React.ReactNode; actions?: React.ReactNode; crumb?: { label: string; href?: string }[]; children: React.ReactNode }) {
  return (
    <PortalShell school={SHELL} roleLabel={`Dream Savvy · ${TEAM_ROLE_LABEL[ctx.role]}`} fullName={ctx.fullName} groups={ctx.nav} active={active}>
      <div className="flex flex-col gap-5">
        <PageHero crumb={crumb} title={title} sub={sub} actions={actions} />
        {children}
      </div>
    </PortalShell>
  );
}

/** Links that look like tabs (each one is its own address, so back and refresh work). */
export function LinkTabs({ label, tabs, current }: { label: string; tabs: [string, string, string][]; current: string }) {
  return (
    <nav aria-label={label} className="flex flex-wrap gap-2">
      {tabs.map(([k, l, href]) => (
        <Link key={k} href={href} aria-current={current === k ? "page" : undefined} className={`flex min-h-[44px] items-center rounded-xl border-[1.5px] px-4 text-sm font-bold ${current === k ? "border-c1 bg-c1 text-white" : "border-[#DCE5F0] bg-white text-brand-slate"}`}>
          {l}
        </Link>
      ))}
    </nav>
  );
}

/** A table that scrolls sideways on phones. */
export function Scroll({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-[18px] border border-[#E3EAF3] bg-white" tabIndex={0} role="region" aria-label={`${label}: scroll sideways to see more`}>
      {children}
    </div>
  );
}

export function Stat({ label, value, sub, tone = "plain" }: { label: string; value: string; sub?: string; tone?: "plain" | "navy" | "good" | "bad" }) {
  const bg = tone === "navy" ? "bg-[#173B70] text-white border-transparent" : "bg-white border-[#E3EAF3]";
  const vc = tone === "navy" ? "text-white" : tone === "good" ? "text-[#0B6B5A]" : tone === "bad" ? "text-[#912018]" : "text-c1";
  return (
    <div className={`flex flex-col gap-1 rounded-[18px] border p-[18px] ${bg}`}>
      <span className={`text-[13px] font-bold ${tone === "navy" ? "text-[#DCE5F0]" : "text-[#4A5A70]"}`}>{label}</span>
      <span className={`font-heading text-[28px] font-black leading-tight ${vc}`}>{value}</span>
      {sub && <span className={`text-[13px] ${tone === "navy" ? "text-[#DCE5F0]" : "text-[#4A5A70]"}`}>{sub}</span>}
    </div>
  );
}

export function Box({ id, title, children, className = "", actions }: { id: string; title: string; children: React.ReactNode; className?: string; actions?: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className={`flex flex-col gap-3 rounded-[18px] border border-[#E3EAF3] bg-white p-[22px] ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={id} className="text-lg !text-c1">
          {title}
        </h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

/** "₦15.37m", "₦612,400". */
export function money(kobo: number) {
  const n = kobo / 100;
  if (Math.abs(n) >= 10_000_000) return `₦${(n / 1_000_000).toFixed(1)}m`;
  if (Math.abs(n) >= 1_000_000) return `₦${(n / 1_000_000).toFixed(2)}m`;
  return `₦${Math.round(n).toLocaleString("en-NG")}`;
}
