import Link from "next/link";
import { PortalShell } from "@/components/PortalShell";
import { requireSchool, ROLE_LABEL, type Role } from "@/lib/auth";
import { adminNav } from "@/lib/nav";

/** Roles that can change the school's setup (classes, students, terms, staff). */
export const SETUP_ROLES: Role[] = ["owner", "admin", "principal"];

export async function requireAdminPage(roles: Role[] = SETUP_ROLES) {
  return requireSchool(roles);
}

/** Admin portal page frame: shell, breadcrumb, title and action buttons. */
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
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <nav aria-label="Breadcrumb" className="text-sm text-[#4A5A70]">
              <Link href="/admin" className="s-link">
                Dashboard
              </Link>
              {crumb.map((c) => (
                <span key={c.label}>
                  {" / "}
                  {c.href ? (
                    <Link href={c.href} className="s-link">
                      {c.label}
                    </Link>
                  ) : (
                    c.label
                  )}
                </span>
              ))}
            </nav>
            <h1 className="mt-1 text-[30px] leading-tight !text-c1">
              {title}
              {count !== undefined && <span className="ml-2 align-middle text-lg font-bold text-[#4A5A70]">{count}</span>}
            </h1>
          </div>
          {actions && <div className="flex flex-wrap gap-2.5">{actions}</div>}
        </div>
        {children}
      </div>
    </PortalShell>
  );
}

export function Panel({ title, id, children, actions, className = "" }: { title: string; id: string; children: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return (
    <section aria-labelledby={id} className={`flex flex-col gap-4 rounded-[18px] border border-[#E3EAF3] bg-white p-[22px] ${className}`}>
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
