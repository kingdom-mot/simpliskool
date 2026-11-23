import Link from "next/link";
import type { Paged } from "@/lib/paging";

/**
 * A search box for a list. It is an ordinary form, so it works on every phone
 * and the search stays in the address bar (back, refresh and sharing work).
 * `keep` holds the page's other settings (tab, term, class…) so searching keeps them.
 */
export function SearchBar({
  id,
  label,
  placeholder,
  q,
  keep = {},
  clearHref,
  className = "",
  compact = false,
}: {
  id: string;
  label: string;
  placeholder: string;
  q: string;
  keep?: Record<string, string | number | null | undefined | false>;
  clearHref?: string;
  className?: string;
  compact?: boolean;
}) {
  return (
    <form method="get" role="search" aria-label={label} className={`flex flex-wrap items-end gap-2 ${className}`}>
      {Object.entries(keep).map(([k, v]) => (v === null || v === undefined || v === false || v === "" ? null : <input key={k} type="hidden" name={k} value={String(v)} />))}
      <div className={compact ? "min-w-[180px] flex-1" : "min-w-[220px] flex-1"}>
        <label className="label" htmlFor={id}>
          {label}
        </label>
        <input id={id} name="q" type="search" className="sk-input py-2" defaultValue={q} placeholder={placeholder} autoComplete="off" enterKeyHint="search" />
      </div>
      <button className="s-btn2">Search</button>
      {q && clearHref && (
        <Link href={clearHref} className="s-link flex min-h-[44px] items-center text-sm">
          Clear search
        </Link>
      )}
    </form>
  );
}

/** "Showing 26–50 of 212" with Previous, page numbers and Next. Hidden when everything fits on one page. */
export function Pager<T>({ p, href, label = "Pages", noun = "" }: { p: Paged<T>; href: (page: number) => string; label?: string; noun?: string }) {
  if (p.pages <= 1) return null;
  const nums = pageWindow(p.page, p.pages);
  return (
    <nav aria-label={label} className="flex flex-wrap items-center justify-between gap-3 border-t border-[#EEF3F9] pt-4 text-sm text-[#4A5A70]">
      <span>
        Showing {p.from}–{p.to} of {p.total}
        {noun ? ` ${noun}` : ""}
      </span>
      <span className="flex flex-wrap items-center gap-1.5">
        {p.page > 1 ? (
          <Link className="s-btn2" href={href(p.page - 1)} rel="prev">
            Previous
          </Link>
        ) : (
          <span className="s-btn2 opacity-50" aria-disabled="true">
            Previous
          </span>
        )}
        {nums.map((n, i) =>
          n === 0 ? (
            <span key={`gap${i}`} aria-hidden="true" className="px-1">
              …
            </span>
          ) : n === p.page ? (
            <span key={n} aria-current="page" className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-c1 px-2 font-bold text-white">
              <span className="sr-only">Page </span>
              {n}
            </span>
          ) : (
            <Link key={n} href={href(n)} className="hidden min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border-[1.5px] border-[#DCE5F0] bg-white px-2 font-bold text-brand-slate hover:border-c1 sm:flex">
              <span className="sr-only">Page </span>
              {n}
            </Link>
          ),
        )}
        {p.page < p.pages ? (
          <Link className="s-btn2" href={href(p.page + 1)} rel="next">
            Next
          </Link>
        ) : (
          <span className="s-btn2 opacity-50" aria-disabled="true">
            Next
          </span>
        )}
      </span>
    </nav>
  );
}

/** Page numbers to show: first, last, and two either side of the current one; 0 marks a gap. */
function pageWindow(cur: number, last: number): number[] {
  const out: number[] = [];
  for (let n = 1; n <= last; n++) {
    if (n === 1 || n === last || Math.abs(n - cur) <= 1) out.push(n);
    else if (out[out.length - 1] !== 0) out.push(0);
  }
  return out;
}

/** The line shown when a search finds nothing. */
export function noMatch(q: string, what: string) {
  return `No ${what} match “${q}”. Check the spelling or try part of the name.`;
}
