export const DAYS = [
  { n: 1, name: "Monday", short: "Mon" },
  { n: 2, name: "Tuesday", short: "Tue" },
  { n: 3, name: "Wednesday", short: "Wed" },
  { n: 4, name: "Thursday", short: "Thu" },
  { n: 5, name: "Friday", short: "Fri" },
] as const;

export type Period = { id: string; label: string; kind: "lesson" | "break"; starts_at: string; ends_at: string };

/** "08:40:00" -> "8:40" */
export function hm(t: string) {
  const [h, m] = t.split(":");
  return `${Number(h)}:${m}`;
}

/** Today's ISO day number in Lagos (1 = Monday). */
export function lagosDay(): number {
  const d = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "Africa/Lagos" }).format(new Date());
  return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(d) + 1;
}
export function lagosHM(): string {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Africa/Lagos" }).format(new Date());
}

/** Distinct, gentle cell colours so each subject is easy to spot on the grid. */
const TINTS = ["#E7F6F2", "#E8EFFE", "#FFF3D6", "#F3E8FF", "#FDE7F0", "#E3F6E8", "#FFE9DC", "#E6F4FB"];
export function subjectTint(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return TINTS[h % TINTS.length];
}
