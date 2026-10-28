export type SitePage = "about" | "admissions" | "news" | "gallery" | "contact";
export type Website = {
  pages?: Partial<Record<SitePage, boolean>>;
  headline?: string;
  intro?: string;
  hero_url?: string;
  hero_alt?: string;
  about_text?: string;
  highlights?: { title: string; text: string }[];
  admissions_open?: boolean;
  admission_classes?: string[];
  admission_requirements?: string;
};

export const SITE_PAGES: { key: "home" | SitePage; label: string }[] = [
  { key: "home", label: "Home" },
  { key: "about", label: "About us" },
  { key: "admissions", label: "Admissions" },
  { key: "news", label: "News and events" },
  { key: "gallery", label: "Gallery" },
  { key: "contact", label: "Contact" },
];

export const DEFAULT_HIGHLIGHTS = [
  { title: "Attentive teaching", text: "Form teachers who know each child and follow their progress closely." },
  { title: "Parents kept in the loop", text: "Attendance, results and school news on your phone, any time." },
  { title: "Simple fees and records", text: "Clear invoices and receipts, and report cards you can download." },
];

export function asWebsite(v: unknown): Website {
  return v && typeof v === "object" ? (v as Website) : {};
}
export const pageOn = (w: Website, p: SitePage) => w.pages?.[p] !== false;
