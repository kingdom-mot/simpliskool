import Link from "next/link";

/**
 * Colourful data tones used on every dashboard, whatever the school's own colours are.
 * Text colours are dark enough for 4.5:1 on their own tinted backgrounds.
 */
export const TONES = {
  teal: { bg: "linear-gradient(160deg,#E6FAF6,#CFF3EC)", tint: "#E6FAF6", border: "#A7E6DA", icon: "#0B7D6E", fg: "#0B5E52", bar: "linear-gradient(90deg,#2EC4B6,#0F9D8A)", blob: "rgba(15,157,138,0.12)" },
  blue: { bg: "linear-gradient(160deg,#EDF4FF,#D9E7FF)", tint: "#EDF4FF", border: "#B9D1FB", icon: "#1D4ED8", fg: "#1E3A8A", bar: "linear-gradient(90deg,#60A5FA,#2563EB)", blob: "rgba(37,99,235,0.10)" },
  amber: { bg: "linear-gradient(160deg,#FFF8E6,#FFEDC2)", tint: "#FFF8E6", border: "#F7D88A", icon: "#B45309", fg: "#7A3E00", bar: "linear-gradient(90deg,#FCD34D,#F59E0B)", blob: "rgba(245,158,11,0.14)" },
  purple: { bg: "linear-gradient(160deg,#F6EEFF,#EADBFF)", tint: "#F6EEFF", border: "#D6BCFB", icon: "#6D28D9", fg: "#4C1D95", bar: "linear-gradient(90deg,#C084FC,#7C3AED)", blob: "rgba(124,58,237,0.10)" },
  pink: { bg: "linear-gradient(160deg,#FFF0F6,#FFDDEB)", tint: "#FFF0F6", border: "#F9C2DA", icon: "#BE185D", fg: "#831843", bar: "linear-gradient(90deg,#F9A8D4,#DB2777)", blob: "rgba(219,39,119,0.10)" },
  green: { bg: "linear-gradient(160deg,#ECFDF3,#D3F8E2)", tint: "#ECFDF3", border: "#A6EBC3", icon: "#15803D", fg: "#14532D", bar: "linear-gradient(90deg,#86EFAC,#16A34A)", blob: "rgba(22,163,74,0.10)" },
} as const;
export type Tone = keyof typeof TONES;
export const TONE_CYCLE: Tone[] = ["teal", "blue", "purple", "pink", "amber", "green"];

export const ICONS = {
  users: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  check: "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
  cash: "M2 6h20v12H2zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M6 12h.01M18 12h.01",
  chart: "M3 3v18h18M7 16l4-4 3 3 5-6",
  book: "M4 19.5V5a2 2 0 0 1 2-2h14v16H6.5A2.5 2.5 0 0 0 4 21.5M8 7h8M8 11h6",
  clock: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2",
  bell: "M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0",
  chevron: "M9 18l6-6-6-6",
};

export function Icon({ d, size = 20, className, stroke = "currentColor", width = 2.2 }: { d: string; size?: number; className?: string; stroke?: string; width?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d={d} />
    </svg>
  );
}

/** A bar that fills to `value` percent. */
export function Bar({ value, fill, track = "#EEF3F9", height = 8, label }: { value: number; fill: string; track?: string; height?: number; label?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <span
      role={label ? "progressbar" : undefined}
      aria-label={label}
      aria-valuenow={label ? v : undefined}
      aria-valuemin={label ? 0 : undefined}
      aria-valuemax={label ? 100 : undefined}
      className="block overflow-hidden rounded-full"
      style={{ height, background: track }}
    >
      <span className="block rounded-full" style={{ height, width: `${v}%`, background: fill }} />
    </span>
  );
}

/** Colourful headline number card. */
export function StatCard({ tone, icon, label, value, sub, percent, href }: { tone: Tone; icon: string; label: string; value: string; sub: string; percent?: number; href?: string }) {
  const t = TONES[tone];
  const body = (
    <>
      <span aria-hidden="true" className="absolute -right-[18px] -top-[18px] h-[92px] w-[92px] rounded-full" style={{ background: t.blob }} />
      <span className="relative flex items-center gap-2.5">
        <span className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-xl text-white" style={{ background: t.icon }}>
          <Icon d={icon} />
        </span>
        <span className="text-[13px] font-extrabold" style={{ color: t.fg }}>
          {label}
        </span>
      </span>
      <span className="relative font-heading text-[32px] font-black leading-tight" style={{ color: t.fg }}>
        {value}
      </span>
      {percent !== undefined && (
        <span className="relative">
          <Bar value={percent} fill={t.bar} track="#FFFFFF" />
        </span>
      )}
      <span className="relative text-[13px] text-[#34445A]">{sub}</span>
    </>
  );
  const cls = "relative flex flex-col gap-1.5 overflow-hidden rounded-[18px] border p-5";
  const style = { background: t.bg, borderColor: t.border };
  return href ? (
    <Link href={href} className={cls} style={style}>
      {body}
    </Link>
  ) : (
    <div className={cls} style={style}>
      {body}
    </div>
  );
}

export function Card({ children, className = "", labelledBy }: { children: React.ReactNode; className?: string; labelledBy?: string }) {
  return (
    <section aria-labelledby={labelledBy} className={`rounded-[18px] border border-[#E3EAF3] bg-white p-[22px] ${className}`}>
      {children}
    </section>
  );
}

const PILL = {
  good: "bg-[#E7F6F2] text-[#0B6B5A]",
  warn: "bg-[#FFF6E3] text-[#7A5300]",
  bad: "bg-[#FEF3F2] text-[#912018]",
  info: "bg-[#EEF3F9] text-[#173B70]",
};
export function Pill({ kind, children }: { kind: keyof typeof PILL; children: React.ReactNode }) {
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-extrabold ${PILL[kind]}`}>{children}</span>;
}

/** Gradient from the school's main colour to its second colour. White text stays readable. */
export const SCHOOL_GRADIENT = "linear-gradient(120deg, var(--c1,#173B70) 0%, color-mix(in srgb, var(--c1,#173B70) 55%, var(--c2,#0B7D6E)) 60%, var(--c2,#0B7D6E) 100%)";

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl bg-brand-cloud px-4 py-3 text-sm text-[#4A5A70]">{children}</p>;
}
