/** The usual Nigerian class structure and subjects, used by "Use the Nigerian template". */

export type Section = "nursery" | "primary" | "jss" | "ss";

export const SECTIONS: { key: Section; label: string; classes: string[] }[] = [
  { key: "nursery", label: "Nursery", classes: ["Creche", "Nursery 1", "Nursery 2"] },
  { key: "primary", label: "Primary", classes: ["Primary 1", "Primary 2", "Primary 3", "Primary 4", "Primary 5", "Primary 6"] },
  { key: "jss", label: "Junior secondary (JSS)", classes: ["JSS 1", "JSS 2", "JSS 3"] },
  { key: "ss", label: "Senior secondary (SS)", classes: ["SS 1", "SS 2", "SS 3"] },
];

export const SUBJECTS: Record<Section, string[]> = {
  nursery: ["Literacy", "Numeracy", "Basic Science", "Social Habits", "Health Habits", "Rhymes", "Creative Arts"],
  primary: [
    "English Language",
    "Mathematics",
    "Basic Science and Technology",
    "Social Studies",
    "Civic Education",
    "Cultural and Creative Arts",
    "Computer Studies",
    "Christian Religious Studies",
    "Islamic Religious Studies",
    "Yoruba",
    "French",
    "Physical and Health Education",
    "Verbal Reasoning",
    "Quantitative Reasoning",
  ],
  jss: [
    "English Language",
    "Mathematics",
    "Basic Science",
    "Basic Technology",
    "Social Studies",
    "Civic Education",
    "Business Studies",
    "Computer Studies",
    "Cultural and Creative Arts",
    "Agricultural Science",
    "Home Economics",
    "Christian Religious Studies",
    "Islamic Religious Studies",
    "French",
    "Yoruba",
    "Physical and Health Education",
  ],
  ss: [
    "English Language",
    "Mathematics",
    "Civic Education",
    "Biology",
    "Chemistry",
    "Physics",
    "Further Mathematics",
    "Economics",
    "Government",
    "Literature in English",
    "Geography",
    "Commerce",
    "Financial Accounting",
    "Agricultural Science",
    "Computer Studies",
    "Christian Religious Studies",
    "Islamic Religious Studies",
  ],
};

/** Sort position for a class name, so classes list from Creche to SS 3. */
export function levelOrder(name: string): number {
  const all = SECTIONS.flatMap((s) => s.classes);
  const i = all.findIndex((c) => c.toLowerCase() === name.trim().toLowerCase());
  if (i >= 0) return i + 1;
  const m = name.match(/(\d+)/);
  const n = m ? Number(m[1]) : 0;
  const lower = name.toLowerCase();
  if (/^(creche|kg|nursery|pre)/.test(lower)) return n;
  if (/^(primary|basic|pry|grade|year)/.test(lower)) return 3 + n;
  if (/^(jss|junior)/.test(lower)) return 9 + n;
  if (/^(ss|sss|senior)/.test(lower)) return 12 + n;
  return 50;
}

export function sectionOfClass(name: string): Section | null {
  const lower = name.toLowerCase();
  if (/^(creche|kg|nursery|pre)/.test(lower)) return "nursery";
  if (/^(primary|basic|pry|grade|year)/.test(lower)) return "primary";
  if (/^(jss|junior)/.test(lower)) return "jss";
  if (/^(ss|sss|senior)/.test(lower)) return "ss";
  return null;
}
