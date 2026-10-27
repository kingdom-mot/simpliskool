/** Shared between the upload page (browser) and the import action (server). */

export type ImportRow = {
  row: number;
  first_name: string;
  last_name: string;
  other_names?: string;
  gender?: string;
  date_of_birth?: string;
  class?: string;
  admission_no?: string;
  parent_name?: string;
  parent_phone?: string;
  parent_email?: string;
  relationship?: string;
};

export type ImportProblem = { row: number; name: string; problem: string };

/** Template columns, in order. The upload page also accepts close variants of these headings. */
export const COLUMNS: { key: keyof Omit<ImportRow, "row">; heading: string; required: string; example: string; aliases: string[] }[] = [
  { key: "first_name", heading: "First name", required: "Yes", example: "Tolu", aliases: ["firstname", "first", "given name"] },
  { key: "last_name", heading: "Surname", required: "Yes", example: "Adebayo", aliases: ["last name", "lastname", "surname", "family name"] },
  { key: "other_names", heading: "Other names", required: "No", example: "Oluwaseun", aliases: ["middle name", "othernames", "middle names"] },
  { key: "class", heading: "Class", required: "Yes", example: "JSS 2A", aliases: ["class name", "class arm", "form"] },
  { key: "gender", heading: "Gender", required: "No", example: "Male", aliases: ["sex"] },
  { key: "date_of_birth", heading: "Date of birth", required: "No", example: "14/03/2014", aliases: ["dob", "birthday", "birth date", "date of birth (dd/mm/yyyy)"] },
  { key: "admission_no", heading: "Admission number", required: "No (we create one)", example: "BS/2026/118", aliases: ["admission no", "admission no.", "adm no", "reg no", "admission"] },
  { key: "parent_name", heading: "Parent name", required: "No", example: "Kunle Adebayo", aliases: ["parent", "guardian", "guardian name", "parent full name"] },
  { key: "parent_phone", heading: "Parent phone", required: "Phone or email to link a parent", example: "08031234567", aliases: ["phone", "parent phone number", "guardian phone", "phone number"] },
  { key: "parent_email", heading: "Parent email", required: "No", example: "kunle@gmail.com", aliases: ["email", "guardian email", "parent email address"] },
  { key: "relationship", heading: "Relationship", required: "No", example: "Father", aliases: ["relation", "parent relationship"] },
];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Which column index holds which field, based on the heading row. */
export function mapHeadings(headings: string[]): Partial<Record<keyof Omit<ImportRow, "row">, number>> {
  const out: Partial<Record<keyof Omit<ImportRow, "row">, number>> = {};
  headings.forEach((h, i) => {
    const n = norm(h ?? "");
    if (!n) return;
    const col = COLUMNS.find((c) => norm(c.heading) === n || c.aliases.some((a) => norm(a) === n));
    if (col && out[col.key] === undefined) out[col.key] = i;
  });
  return out;
}

/** Excel dates arrive as Date objects, numbers or text such as 14/03/2014. Returns yyyy-mm-dd or "" or null if unreadable. */
export function toIsoDate(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return "";
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  if (typeof v === "number" && v > 1000 && v < 80000) {
    const d = new Date(Date.UTC(1899, 11, 30) + v * 86400000);
    return d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return valid(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/); // Nigerian order: day/month/year
  if (m) {
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    return valid(y, +m[2], +m[1]);
  }
  return null;
}
function valid(y: number, mo: number, d: number): string | null {
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}

export function toGender(v: string | undefined): "male" | "female" | "" | null {
  const g = (v ?? "").trim().toLowerCase();
  if (!g) return "";
  if (["m", "male", "boy"].includes(g)) return "male";
  if (["f", "female", "girl"].includes(g)) return "female";
  return null;
}

/** "jss 2 a", "JSS2A" and "JSS 2A" all match the class JSS 2A. */
export function classKey(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, "");
}
