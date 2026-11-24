"use client";

import Link from "next/link";
import { useRef } from "react";
import type { Tab } from "@/lib/nav";

const MORE_ICON = "M4 6h16M4 12h16M4 18h16";

/**
 * App-style bottom tabs for phones (hidden on bigger screens), with a "More" tab that opens
 * the full menu as a sheet. The menu itself is passed in as children.
 */
export function PhoneTabs({ tabs, active, label, children }: { tabs: Tab[]; active: string; label: string; children: React.ReactNode }) {
  const sheet = useRef<HTMLDialogElement>(null);
  const onTab = tabs.some((t) => t.key === active);
  const tabCls = (on: boolean) => `flex min-h-[56px] w-full flex-col items-center justify-center gap-0.5 ${on ? "font-extrabold text-c1" : "font-semibold text-[#4A5A70]"}`;
  const icon = (d: string, on: boolean) => (
    <span className={`flex h-8 w-14 items-center justify-center rounded-full ${on ? "bg-[color-mix(in_srgb,var(--c1,#173B70)_12%,white)]" : ""}`}>
      <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d={d} />
      </svg>
    </span>
  );
  return (
    <>
      <nav aria-label={label} className="sticky bottom-0 z-30 w-full border-t border-[#E3EAF3] bg-white px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden print:hidden">
        <ul className="grid" style={{ gridTemplateColumns: `repeat(${tabs.length + 1}, minmax(0, 1fr))` }}>
          {tabs.map((t) => {
            const on = t.key === active;
            return (
              <li key={t.key}>
                <Link href={t.href ?? "#"} aria-current={on ? "page" : undefined} className={tabCls(on)}>
                  {icon(t.icon, on)}
                  <span className="text-xs">{t.label}</span>
                </Link>
              </li>
            );
          })}
          <li>
            <button type="button" aria-haspopup="dialog" onClick={() => sheet.current?.showModal()} className={tabCls(!onTab)}>
              {icon(MORE_ICON, !onTab)}
              <span className="text-xs">More</span>
            </button>
          </li>
        </ul>
      </nav>
      <dialog
        ref={sheet}
        aria-labelledby="more-h"
        className="m-0 mt-auto max-h-[85vh] w-full max-w-none overflow-y-auto rounded-t-[22px] bg-c1 p-0 text-white backdrop:bg-[#0A1F3D]/50 md:hidden"
        onClick={(e) => {
          // Close after choosing a page, or on a tap outside the sheet.
          const el = e.target as HTMLElement;
          if (el === sheet.current || el.closest("a")) sheet.current?.close();
        }}
      >
        <div className="flex flex-col gap-4 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto h-1.5 w-10 rounded-full bg-white/40" aria-hidden="true" />
          <div className="flex items-center justify-between">
            <h2 id="more-h" className="text-lg font-extrabold !text-white">
              Menu
            </h2>
            <button type="button" onClick={() => sheet.current?.close()} className="min-h-[44px] rounded-xl border border-white/40 px-3 text-sm font-bold text-white">
              Close
            </button>
          </div>
          {children}
        </div>
      </dialog>
    </>
  );
}
