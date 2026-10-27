const TZ = "Africa/Lagos";

/** "Good morning" / "Good afternoon" / "Good evening" in Lagos time. */
export function greeting(now = new Date()): string {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: TZ }).format(now));
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** "Tuesday, 3 November" */
export function longDate(d: Date | string = new Date()): string {
  const date = typeof d === "string" ? new Date(`${d}T12:00:00+01:00`) : d;
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: TZ }).format(date);
}

/** "Mon" for a yyyy-mm-dd date */
export function shortDay(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: TZ }).format(new Date(`${iso}T12:00:00+01:00`));
}

/** "3 Nov" or "9:12am" if today */
export function when(iso: string, todayIso?: string): string {
  const d = new Date(iso);
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
  if (todayIso && day === todayIso) {
    return new Intl.DateTimeFormat("en-GB", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: TZ })
      .format(d)
      .replace(" ", "")
      .toLowerCase();
  }
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: TZ }).format(d);
}

/** Month and day parts for a calendar tile. */
export function dayTile(iso: string): { m: string; d: string } {
  const d = new Date(iso);
  return {
    m: new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: TZ }).format(d).toUpperCase(),
    d: new Intl.DateTimeFormat("en-GB", { day: "numeric", timeZone: TZ }).format(d),
  };
}

/** Naira from kobo. Large amounts are shortened: ₦18.4m, ₦850k. */
export function naira(kobo: number | null | undefined, short = false): string {
  const n = Math.round((kobo ?? 0) / 100);
  if (short && n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}m`;
  if (short && n >= 10_000) return `₦${Math.round(n / 1000)}k`;
  return `₦${n.toLocaleString("en-NG")}`;
}

export function pct(part: number, whole: number): number {
  if (!whole) return 0;
  return Math.round((part / whole) * 100);
}

/** "09:20" -> "9:20am" */
export function clock(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")}${suffix}`;
}

export const TERM_NAME = ["", "First Term", "Second Term", "Third Term"];

export function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] || full;
}

export function personInitials(full: string): string {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "U";
}
