// Search and pagination helpers shared by list pages.
// Lists that already come back whole (from one database call) are searched and
// split into pages here; lists read straight from a table use `range` instead.

export const PAGE_SIZE = 25;

/** Page number from the address bar ("?page=3"); anything odd becomes 1. */
export function pageNum(v: string | undefined | null): number {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n > 1 ? n : 1;
}

/** Search text from the address bar, trimmed and kept to a sensible length. */
export function searchText(v: string | undefined | null): string {
  return (v ?? "").trim().slice(0, 80);
}

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
const digits = (s: string) => s.replace(/\D/g, "");

/**
 * True when every word typed appears somewhere in the fields (any order,
 * ignoring case and accents). Phone numbers match with or without spaces,
 * "+234" or a leading 0: typing "0803 555" finds "+2348035550101".
 */
export function matches(q: string, ...fields: (string | number | null | undefined)[]): boolean {
  const words = fold(q).split(" ").filter(Boolean);
  if (!words.length) return true;
  const hay = fold(fields.filter((f) => f !== null && f !== undefined && f !== "").join(" "));
  const nums = fields.map((f) => digits(String(f ?? ""))).filter((d) => d.length >= 4);
  return words.every((w) => {
    if (hay.includes(w)) return true;
    const d = digits(w);
    if (d.length < 3 || d.length !== w.replace(/[\s+()-]/g, "").length) return false;
    const local = d.replace(/^0/, "");
    return nums.some((n) => n.includes(d) || (local.length >= 3 && n.includes(local)));
  });
}

export type Paged<T> = { rows: T[]; page: number; pages: number; total: number; from: number; to: number; size: number };

/** Cuts a whole list into one page. A page past the end shows the last page. */
export function paginate<T>(all: T[], page: number, size = PAGE_SIZE): Paged<T> {
  const total = all.length;
  const pages = Math.max(1, Math.ceil(total / size));
  const p = Math.min(Math.max(1, page), pages);
  const start = (p - 1) * size;
  const rows = all.slice(start, start + size);
  return { rows, page: p, pages, total, from: total ? start + 1 : 0, to: start + rows.length, size };
}

/** Page details for a list read with `range` (the database counts the total). */
export function pagedFromCount<T>(rows: T[], page: number, total: number, size = PAGE_SIZE): Paged<T> {
  const pages = Math.max(1, Math.ceil(total / size));
  const start = (page - 1) * size;
  return { rows, page, pages, total, from: rows.length ? start + 1 : 0, to: start + rows.length, size };
}

/** `range(from, to)` for a page, for lists read straight from a table. */
export function rangeOf(page: number, size = PAGE_SIZE): [number, number] {
  return [(page - 1) * size, page * size - 1];
}

/** Search text made safe to put inside a PostgREST `or(...ilike...)` filter. */
export function ilikeSafe(q: string): string {
  return q.replace(/[%_,()*\\:."']/g, " ").replace(/\s+/g, " ").trim();
}

/** Builds a link to the same page with some settings changed; empty ones are left out. */
export function linkTo(path: string, params: Record<string, string | number | null | undefined | false>): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === null || v === undefined || v === false || v === "") continue;
    if (k === "page" && Number(v) <= 1) continue;
    u.set(k, String(v));
  }
  const s = u.toString();
  return s ? `${path}?${s}` : path;
}
