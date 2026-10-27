import type { CSSProperties } from "react";

/** The 20 colours a school can choose from. Each has at least 5:1 contrast with white. */
export const SCHOOL_PALETTE = [
  { name: "Maroon", hex: "#7A1F2B" },
  { name: "Crimson", hex: "#9F1239" },
  { name: "Red", hex: "#B42318" },
  { name: "Rose", hex: "#BE185D" },
  { name: "Burnt orange", hex: "#9A3412" },
  { name: "Brown", hex: "#7C2D12" },
  { name: "Mustard", hex: "#7A5300" },
  { name: "Olive", hex: "#4D5B12" },
  { name: "Forest green", hex: "#1E6B3A" },
  { name: "Emerald", hex: "#047857" },
  { name: "Ocean blue", hex: "#0E6BA8" },
  { name: "Royal blue", hex: "#1D4ED8" },
  { name: "Navy", hex: "#173B70" },
  { name: "Indigo", hex: "#3730A3" },
  { name: "Purple", hex: "#5B2A86" },
  { name: "Plum", hex: "#86198F" },
  { name: "Magenta", hex: "#A21CAF" },
  { name: "Charcoal", hex: "#334155" },
  { name: "Black", hex: "#111827" },
  { name: "Teal", hex: "#0B7D6E" },
] as const;

/** Simpliskool colours, used when a school has not chosen any. */
export const DEFAULT_MAIN = "#173B70";
export const DEFAULT_SECOND = "#0B7D6E";

const allowed = new Set<string>(SCHOOL_PALETTE.map((c) => c.hex));

function clean(hex: string | null | undefined): string | null {
  if (!hex) return null;
  const h = hex.toUpperCase();
  return allowed.has(h) ? h : null;
}

/**
 * The school's two colours. No colours chosen gives Simpliskool navy and teal. One colour
 * gives that colour as the main colour with Simpliskool teal as the second, unless the one
 * colour is teal itself, in which case navy is the second.
 */
export function schoolColours(primary?: string | null, secondary?: string | null) {
  const main = clean(primary) ?? clean(secondary);
  const second = main && clean(secondary) && clean(secondary) !== main ? clean(secondary)! : null;
  const c1 = main ?? DEFAULT_MAIN;
  const c2 = second ?? (c1 === DEFAULT_SECOND ? DEFAULT_MAIN : DEFAULT_SECOND);
  return { c1, c2, chosen: [main, second].filter(Boolean).length };
}

/** CSS variables for a page or section in the school's colours. */
export function schoolThemeStyle(primary?: string | null, secondary?: string | null): CSSProperties {
  const { c1, c2 } = schoolColours(primary, secondary);
  return { ["--c1" as string]: c1, ["--c2" as string]: c2 } as CSSProperties;
}

/** Two-letter initials for a school badge, e.g. "Bright Stars College" -> "BS". */
export function initials(name: string): string {
  const words = name.replace(/[^A-Za-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  const skip = new Set(["the", "of", "and", "school", "college", "academy", "schools"]);
  const main = words.filter((w) => !skip.has(w.toLowerCase()));
  const use = (main.length ? main : words).slice(0, 2);
  return use.map((w) => w[0]!.toUpperCase()).join("") || "S";
}
