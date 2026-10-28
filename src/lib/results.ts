import type { Role } from "@/lib/auth";

/** Score parts and their maximum marks (same as the database check). */
export const PARTS = [
  { key: "ca1", label: "CA 1", max: 20 },
  { key: "ca2", label: "CA 2", max: 20 },
  { key: "exam", label: "Exam", max: 60 },
] as const;
export type PartKey = (typeof PARTS)[number]["key"];

/** Roles that can open admin results pages (owner, admin, principal). */
export const RESULTS_ADMIN: Role[] = ["owner", "admin", "principal"];

/** Behaviour and skills the class teacher rates from 1 (poor) to 5 (excellent). */
export const RATINGS = ["Punctuality", "Attentiveness", "Neatness", "Politeness", "Teamwork", "Leadership"] as const;

export type ScaleRow = { grade: string; min: number; max: number; remark: string | null };

export const DEFAULT_SCALE: ScaleRow[] = [
  { grade: "A", min: 70, max: 100, remark: "Excellent" },
  { grade: "B", min: 60, max: 69.99, remark: "Very good" },
  { grade: "C", min: 50, max: 59.99, remark: "Good" },
  { grade: "D", min: 45, max: 49.99, remark: "Fair" },
  { grade: "E", min: 40, max: 44.99, remark: "Pass" },
  { grade: "F", min: 0, max: 39.99, remark: "Fail" },
];

export function gradeOf(total: number | null | undefined, scale: ScaleRow[] = DEFAULT_SCALE) {
  if (total === null || total === undefined) return null;
  const sorted = [...scale].sort((a, b) => b.min - a.min);
  return sorted.find((g) => total >= g.min) ?? null;
}

/** Pill colour for a grade: pass marks green/amber, fail red. */
export function gradeKind(grade: string | null | undefined, scale: ScaleRow[] = DEFAULT_SCALE): "good" | "warn" | "bad" | "info" {
  if (!grade) return "info";
  const sorted = [...scale].sort((a, b) => b.min - a.min);
  const i = sorted.findIndex((g) => g.grade === grade);
  if (i === sorted.length - 1) return "bad";
  return i <= 1 ? "good" : "warn";
}

export function ordinal(n: number | null | undefined) {
  if (!n) return "—";
  const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : n % 10 === 1 ? "st" : n % 10 === 2 ? "nd" : n % 10 === 3 ? "rd" : "th";
  return `${n}${s}`;
}

export function fmtScore(n: number | null | undefined) {
  if (n === null || n === undefined) return "";
  return Number.isInteger(Number(n)) ? String(Number(n)) : Number(n).toFixed(1).replace(/\.0$/, "");
}

/** Short subject names for broadsheet columns. */
export function shortSubject(name: string) {
  const map: Record<string, string> = {
    "English Language": "English",
    Mathematics: "Maths",
    "Basic Science and Technology": "BST",
    "Basic Science": "B. Science",
    "Basic Technology": "B. Tech",
    "Social Studies": "Social St.",
    "Civic Education": "Civic",
    "Cultural and Creative Arts": "CCA",
    "Christian Religious Studies": "CRS",
    "Islamic Religious Studies": "IRS",
    "Physical and Health Education": "PHE",
    "Computer Studies": "Computer",
    "Agricultural Science": "Agric",
    "Further Mathematics": "F. Maths",
    "Literature in English": "Literature",
    "Financial Accounting": "Accounting",
    "Quantitative Reasoning": "Quant.",
    "Verbal Reasoning": "Verbal",
    "Home Economics": "Home Econ.",
    "Business Studies": "Business",
  };
  return map[name] ?? (name.length > 12 ? `${name.slice(0, 11)}.` : name);
}

export type ClassResults = {
  class_size: number;
  subjects: { id: string; name: string; teacher: string | null; teacher_email: string | null; submitted_at: string | null; scored: number; complete: number }[];
  students: {
    id: string;
    name: string;
    first_name: string;
    admission_no: string;
    scores: Record<string, { ca1: number | null; ca2: number | null; exam: number | null; total: number }>;
    average: number | null;
    position: number | null;
    subjects_scored: number;
    days: number;
    present: number;
    comment: string | null;
    principal_comment: string | null;
    ratings: Record<string, number> | null;
    released_at: string | null;
  }[];
};

export type StudentResult = {
  student: { id: string; name: string; first_name: string; admission_no: string; class: string; photo_url: string | null };
  term: { term_no: number; session: string; ends_on: string | null };
  school: { name: string; address: string | null; phone: string | null; email: string | null; logo_url: string | null; primary_color: string | null; secondary_color: string | null };
  subjects: { name: string; ca1: number | null; ca2: number | null; exam: number | null; total: number; grade: string | null; remark: string | null; position: number; class_average: number; highest: number }[];
  average: number | null;
  position: number | null;
  class_size: number;
  days: number;
  present: number;
  comment: string | null;
  principal_comment: string | null;
  ratings: Record<string, number> | null;
  class_teacher: string | null;
  scale: ScaleRow[];
  released_at: string | null;
};

/**
 * A starting comment from the student's own results (no AI): strongest and weakest
 * subjects and the average. The teacher reads and edits it before saving.
 */
export function suggestComment(first: string, subjects: { name: string; total: number }[], average: number | null, who: "teacher" | "principal" = "teacher") {
  if (!subjects.length || average === null) return "";
  const sorted = [...subjects].sort((a, b) => b.total - a.total);
  const best = sorted.slice(0, 2).map((s) => s.name);
  const weak = sorted[sorted.length - 1];
  if (who === "principal") {
    if (average >= 70) return `An excellent term, ${first}. Keep it up.`;
    if (average >= 55) return `A good term, ${first}. With more effort you can do even better.`;
    if (average >= 45) return `A fair result, ${first}. You can do much better with hard work.`;
    return `${first} needs to work much harder next term. We will support you.`;
  }
  const opening =
    average >= 70 ? `${first} has had an excellent term` : average >= 55 ? `${first} has worked well this term` : average >= 45 ? `${first} has made a fair effort this term` : `${first} found this term difficult`;
  const strong = best.length === 2 ? `especially in ${best[0]} and ${best[1]}` : `especially in ${best[0]}`;
  const work = weak && weak.total < 60 && !best.includes(weak.name) ? ` ${first} should give more attention to ${weak.name}.` : average >= 70 ? " Keep it up." : " Keep working hard.";
  return `${opening}, ${strong}.${work}`;
}
