import Link from "next/link";
import type { Tab } from "@/lib/nav";
import { schoolThemeStyle } from "@/lib/theme";
import { SCHOOL_GRADIENT } from "@/components/ui";
import { SchoolBadge, type ShellSchool } from "@/components/PortalShell";

/** Phone-first layout for parents and students: school-coloured header and bottom tabs. */
export function MobileShell({
  school,
  title,
  subtitle,
  tabs,
  active,
  overlap = false,
  children,
}: {
  school: ShellSchool;
  title: string;
  subtitle?: string;
  tabs: Tab[];
  active: string;
  /** Pull the first card up over the header, as on the student home. */
  overlap?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div style={schoolThemeStyle(school.primary_color, school.secondary_color)} className="flex min-h-screen flex-col bg-brand-cloud">
      <a className="sk-skip" href="#main">
        Skip to main content
      </a>
      <header className={`px-4 pt-3.5 text-white ${overlap ? "pb-16" : "pb-5"}`} style={{ background: SCHOOL_GRADIENT }}>
        <div className="mx-auto flex max-w-[640px] items-center justify-between gap-2.5">
          <Link href="/dashboard" className="flex min-w-0 items-center gap-2.5">
            <SchoolBadge school={school} size={34} />
            <span className="truncate text-[15px] font-bold">{school.name}</span>
          </Link>
          <form action="/auth/signout" method="post">
            <button className="min-h-[44px] rounded-xl bg-white/15 px-3 text-sm font-bold text-white hover:bg-white/25">Sign out</button>
          </form>
        </div>
        <div className="mx-auto mt-4 max-w-[640px]">
          <h1 className="text-2xl !text-white">{title}</h1>
          {subtitle && <p className="mt-1 text-[15px] text-white">{subtitle}</p>}
        </div>
      </header>

      <main id="main" className={`mx-auto flex w-full max-w-[640px] flex-1 flex-col gap-3.5 px-4 pb-6 ${overlap ? "-mt-12" : "pt-4"}`}>
        {children}
      </main>

      <nav aria-label="Main" className="sticky bottom-0 mx-auto w-full max-w-[640px] border-t border-[#E3EAF3] bg-white px-2 pb-2 pt-1.5">
        <ul className="grid grid-cols-5">
          {tabs.map((t) => {
            const on = t.key === active;
            const inner = (
              <>
                <span className={`flex h-8 w-14 items-center justify-center rounded-full ${on ? "bg-[color-mix(in_srgb,var(--c1,#173B70)_12%,white)]" : ""}`}>
                  <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d={t.icon} />
                  </svg>
                </span>
                <span className="text-xs">{t.label}</span>
                {!t.href && <span className="sr-only"> (coming soon)</span>}
              </>
            );
            const cls = `flex min-h-[56px] flex-col items-center justify-center gap-0.5 ${on ? "font-extrabold text-c1" : "font-semibold text-[#4A5A70]"}`;
            return (
              <li key={t.key}>
                {t.href ? (
                  <Link href={t.href} aria-current={on ? "page" : undefined} className={cls}>
                    {inner}
                  </Link>
                ) : (
                  <span aria-disabled="true" className={cls}>
                    {inner}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
