import Image from "next/image";
import Link from "next/link";
import type { NavGroup } from "@/lib/nav";
import { initials, schoolThemeStyle } from "@/lib/theme";
import { personInitials } from "@/lib/format";

export type ShellSchool = {
  name: string;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
};

export function SchoolBadge({ school, size = 36 }: { school: Pick<ShellSchool, "name" | "logo_url">; size?: number }) {
  if (school.logo_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={school.logo_url} alt="" width={size} height={size} className="flex-none rounded-[10px] bg-white object-contain p-0.5" style={{ width: size, height: size }} />
    );
  }
  return (
    <span aria-hidden="true" className="flex flex-none items-center justify-center rounded-[10px] bg-[#F4B740] text-[13px] font-extrabold text-[#1B2433]" style={{ width: size, height: size }}>
      {initials(school.name)}
    </span>
  );
}

function NavList({ groups, active }: { groups: NavGroup[]; active: string }) {
  return (
    <div className="flex flex-col gap-3.5">
      {groups.map((g) => (
        <div key={g.label} className="flex flex-col gap-0.5">
          <div className="px-3 pb-1 text-[11px] font-extrabold uppercase tracking-[0.08em] text-white">{g.label}</div>
          {g.items.map((i) =>
            i.key === active && i.href ? (
              <Link key={i.key} href={i.href} aria-current="page" className="flex min-h-[40px] items-center gap-2.5 rounded-[10px] bg-white px-3 py-2.5 text-sm font-extrabold text-c1">
                {i.label}
              </Link>
            ) : i.href ? (
              <Link key={i.key} href={i.href} className="flex min-h-[40px] items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-sm font-semibold text-white hover:bg-white/10">
                {i.label}
              </Link>
            ) : (
              <span key={i.key} aria-disabled="true" className="flex min-h-[40px] items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-sm font-semibold text-white">
                {i.label}
                <span className="ml-auto rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-bold text-white">Soon</span>
              </span>
            ),
          )}
        </div>
      ))}
    </div>
  );
}

/** Sidebar layout for the admin and teacher portals, in the school's own colours. */
export function PortalShell({
  school,
  roleLabel,
  fullName,
  groups,
  active,
  children,
}: {
  school: ShellSchool;
  roleLabel: string;
  fullName: string;
  groups: NavGroup[];
  active: string;
  children: React.ReactNode;
}) {
  return (
    <div style={schoolThemeStyle(school.primary_color, school.secondary_color)} className="min-h-screen bg-brand-cloud md:flex">
      <a className="sk-skip" href="#main">
        Skip to main content
      </a>
      <aside className="flex flex-col gap-4 bg-c1 px-3.5 py-4 text-white md:sticky md:top-0 md:h-screen md:w-[260px] md:flex-none md:gap-5 md:overflow-y-auto md:py-5">
        <div className="flex items-center justify-between gap-3">
          <Link href="/dashboard" className="block rounded-lg px-2 py-1" aria-label="Simpliskool home">
            <Image src="/simpliskool-logo.png" alt="Simpliskool" width={130} height={29} className="h-[26px] w-auto" />
          </Link>
          <form action="/auth/signout" method="post" className="md:hidden">
            <button className="min-h-[44px] rounded-xl border border-white/40 px-3 text-sm font-bold text-white hover:bg-white/10">Sign out</button>
          </form>
        </div>

        <Link href="/dashboard" className="flex items-center gap-2.5 rounded-[14px] bg-black/15 px-3 py-2.5 hover:bg-black/25">
          <SchoolBadge school={school} />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-bold">{school.name}</span>
            <span className="text-xs text-white">{roleLabel}</span>
          </span>
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 15l5 5 5-5M7 9l5-5 5 5" />
          </svg>
          <span className="sr-only">Switch school or role</span>
        </Link>

        {/* Phones: the menu folds away. */}
        <details className="group md:hidden">
          <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between rounded-xl border border-white/30 px-3 text-sm font-bold">
            Menu
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className="transition group-open:rotate-180">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </summary>
          <nav aria-label={`${roleLabel} menu`} className="mt-3">
            <NavList groups={groups} active={active} />
          </nav>
        </details>

        <nav aria-label={`${roleLabel} menu`} className="hidden md:block">
          <NavList groups={groups} active={active} />
        </nav>

        <div className="mt-auto hidden flex-col gap-2 md:flex">
          <Link href="/help" className="rounded-[10px] border border-white/25 px-3 py-2.5 text-sm font-semibold text-white hover:bg-white/10">
            Help and support
          </Link>
          <div className="flex items-center gap-2.5 px-1 pt-1">
            <span aria-hidden="true" className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-white text-xs font-extrabold text-c1">
              {personInitials(fullName)}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-semibold">{fullName}</span>
            <form action="/auth/signout" method="post">
              <button className="min-h-[40px] rounded-lg px-2 text-sm font-bold text-white underline-offset-2 hover:underline">Sign out</button>
            </form>
          </div>
        </div>
      </aside>

      <main id="main" className="min-w-0 flex-1 px-4 pb-12 pt-6 md:px-7">
        {children}
      </main>
    </div>
  );
}
