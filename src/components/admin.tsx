import Link from "next/link";
import { PortalShell } from "@/components/PortalShell";
import { requireSchool, ROLE_LABEL, type Role } from "@/lib/auth";
import { adminNav } from "@/lib/nav";
import { SCHOOL_GRADIENT, TONES, TONE_CYCLE } from "@/components/ui";

/** Roles that can change the school's setup (classes, students, terms, staff). */
export const SETUP_ROLES: Role[] = ["owner", "admin", "principal"];

export async function requireAdminPage(roles: Role[] = SETUP_ROLES) {
  return requireSchool(roles);
}

/** Page header in the school's colours, with breadcrumb, title and actions. Used by admin and teacher pages. */
export function PageHero({ crumb, title, count, actions, sub }: { crumb?: { label: string; href?: string }[]; title: string; count?: number; actions?: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="page-hero relative overflow-hidden rounded-[22px] px-[22px] py-5 text-white" style={{ background: SCHOOL_GRADIENT }}>
      <span aria-hidden="true" className="pointer-events-none absolute -right-10 -top-14 h-44 w-44 rounded-full bg-white/10" />
      <span aria-hidden="true" className="pointer-events-none absolute -bottom-16 right-32 h-36 w-36 rounded-full bg-white/[0.07]" />
      <div className="relative flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          {crumb && (
            <nav aria-label="Breadcrumb" className="text-sm text-white">
              <Link href="/admin" className="font-semibold text-white underline underline-offset-2">
                Dashboard
              </Link>
              {crumb.map((c) => (
                <span key={c.label}>
                  {" / "}
                  {c.href ? (
                    <Link href={c.href} className="font-semibold text-white underline underline-offset-2">
                      {c.label}
                    </Link>
                  ) : (
                    c.label
                  )}
                </span>
              ))}
            </nav>
          )}
          {sub && <p className="text-sm text-white">{sub}</p>}
          <h1 className="mt-1 text-[30px] leading-tight !text-white">
            {title}
            {count !== undefined && <span className="ml-2 rounded-full bg-white/20 px-2.5 py-0.5 align-middle text-lg font-bold text-white">{count}</span>}
          </h1>
        </div>
        {actions && <div className="flex flex-wrap items-end gap-2.5">{actions}</div>}
      </div>
    </div>
  );
}

/** Admin portal page frame: shell, colourful header with breadcrumb, title and action buttons. */
export function AdminPage({
  ctx,
  active,
  crumb,
  title,
  count,
  actions,
  children,
}: {
  ctx: Awaited<ReturnType<typeof requireSchool>>;
  active: string;
  crumb: { label: string; href?: string }[];
  title: string;
  count?: number;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <PortalShell school={ctx.school} roleLabel={ROLE_LABEL[ctx.membership.role]} fullName={ctx.fullName} groups={adminNav(ctx.membership.role)} active={active}>
      <div className="flex flex-col gap-5">
        <PageHero crumb={crumb} title={title} count={count} actions={actions} />
        {children}
      </div>
    </PortalShell>
  );
}

/** Each panel gets a coloured top edge from the dashboard tones, so pages feel bright but stay readable. */
function toneFor(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return TONES[TONE_CYCLE[h % TONE_CYCLE.length]];
}

export function Panel({ title, id, children, actions, className = "" }: { title: string; id: string; children: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return (
    <section aria-labelledby={id} className={`flex flex-col gap-4 rounded-[18px] border border-t-[5px] border-[#E3EAF3] bg-white p-[22px] ${className}`} style={{ borderTopColor: toneFor(id).icon }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={id} className="flex items-center gap-2.5 text-lg !text-c1">
          <span aria-hidden="true" className="h-3 w-3 flex-none rounded-full" style={{ background: toneFor(id).bar }} />
          {title}
        </h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

/** "JSS 2" + "A" -> "JSS 2A", same rule as the database. */
export function classLabel(name: string, arm: string | null | undefined) {
  const a = (arm ?? "").trim();
  return `${name}${a.length <= 2 ? "" : " "}${a}`.trim();
}

/** Group classes by section for display: Nursery, Primary, Junior secondary, Senior secondary, Other. */
export function sectionOf(name: string): string {
  const n = name.toLowerCase();
  if (/^(creche|kg|kindergarten|nursery|pre-?nursery|reception)/.test(n)) return "Nursery";
  if (/^(primary|basic|pry|grade|year)/.test(n)) return "Primary";
  if (/^(jss|junior)/.test(n)) return "Junior secondary";
  if (/^(ss|sss|senior)/.test(n)) return "Senior secondary";
  return "Other";
}
export const SECTION_ORDER = ["Nursery", "Primary", "Junior secondary", "Senior secondary", "Other"];
