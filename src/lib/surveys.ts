// The pilot surveys: a baseline in a school's first weeks, and one at the end of the pilot.
// The questions match the columns of the pilot readiness scorecard (Efficiency and
// Satisfaction sheets), so answers can be pasted straight in.

export type SurveyKey = "baseline" | "end";
export type Group = "leader" | "teacher" | "parent" | "student";

export type Question =
  | { id: string; kind: "hours"; label: string; hint?: string }
  | { id: string; kind: "scale"; label: string; low: string; high: string; max: 5 | 10; min?: 0 | 1 }
  | { id: string; kind: "choice"; label: string; options: string[] }
  | { id: string; kind: "text"; label: string; optional?: boolean; placeholder?: string };

/** The admin tasks timed before and after (same names as the scorecard's Efficiency sheet). */
export const TASKS = [
  ["registers", "Attendance registers"],
  ["reports", "Scores & report cards"],
  ["fees", "Fee records & receipts"],
  ["comms", "Parent communication"],
  ["admin", "Admin reports & timetable"],
] as const;

export const groupOf = (role: string): Group | null =>
  role === "owner" || role === "admin" || role === "principal" || role === "bursar" ? "leader" : role === "teacher" ? "teacher" : role === "parent" ? "parent" : role === "student" ? "student" : null;

const hours = (when: "now" | "before"): Question[] =>
  TASKS.map(([id, label]) => ({ id: `h_${id}`, kind: "hours", label, hint: when === "before" ? "Staff hours a month across the whole school, before Simpliskool" : "Staff hours a month across the whole school, now" }));
const satisfied = (label = "How satisfied are you with Simpliskool overall?"): Question => ({ id: "satisfaction", kind: "scale", label, low: "Very unhappy", high: "Very happy", max: 5 });
const recommend: Question = { id: "recommend", kind: "scale", label: "How likely are you to recommend Simpliskool to another school or parent?", low: "Not at all", high: "Definitely", max: 10, min: 0 };

export const SURVEYS: Record<SurveyKey, { title: string; intro: string; questions: Partial<Record<Group, Question[]>> }> = {
  baseline: {
    title: "Help us measure the difference (2 minutes)",
    intro: "Before Simpliskool changes how you work, tell us how things are today. At the end of the pilot we'll ask again and show you the time saved.",
    questions: {
      leader: [
        ...hours("before"),
        { id: "problems", kind: "text", label: "What are the three biggest problems in running the school today?", placeholder: "e.g. Chasing fees, slow report cards, parents not getting messages" },
        { id: "fees_today", kind: "text", label: "How do you track fees and who owes today?", optional: true, placeholder: "e.g. A notebook and an Excel sheet" },
      ],
      teacher: [
        { id: "h_reports_class", kind: "hours", label: "Hours to work out scores and write report cards for one class, each term", hint: "Your best guess" },
        { id: "register_today", kind: "choice", label: "How do you mark the register today?", options: ["Paper register", "Excel or a spreadsheet", "Another app", "We don't keep a daily register"] },
        { id: "time_sink", kind: "text", label: "What paperwork takes most of your time?", optional: true },
      ],
      parent: [
        { id: "hear_today", kind: "choice", label: "How do you usually hear about your child's results, attendance and fees?", options: ["Paper notes or report card", "WhatsApp", "Phone calls", "Visiting the school", "Another app"] },
        { id: "satisfaction_before", kind: "scale", label: "How happy are you with how the school keeps you informed today?", low: "Very unhappy", high: "Very happy", max: 5 },
      ],
    },
  },
  end: {
    title: "How did the pilot go? (3 minutes)",
    intro: "Thank you for piloting Simpliskool. Your answers decide what we improve next.",
    questions: {
      leader: [
        ...hours("now"),
        satisfied(),
        recommend,
        { id: "renew", kind: "choice", label: "Will the school continue and pay for Simpliskool next term?", options: ["Yes", "Maybe", "No"] },
        { id: "price", kind: "text", label: "What price per term feels fair for your school?", optional: true, placeholder: "e.g. ₦150,000" },
        { id: "change", kind: "text", label: "What one change would make Simpliskool indispensable?", optional: true },
      ],
      teacher: [
        { id: "h_reports_class", kind: "hours", label: "Hours to work out scores and write report cards for one class, each term, now", hint: "Your best guess" },
        satisfied(),
        recommend,
        { id: "change", kind: "text", label: "What one change would help you most?", optional: true },
      ],
      parent: [
        satisfied(),
        { id: "easy", kind: "scale", label: "How easy is it to see your child's results, attendance and fees?", low: "Very hard", high: "Very easy", max: 5 },
        recommend,
        { id: "paid_online", kind: "choice", label: "Have you paid school fees online with Simpliskool?", options: ["Yes", "Not yet", "No, I prefer to pay at the school or bank"] },
        { id: "change", kind: "text", label: "What would make the parent app better?", optional: true },
      ],
      student: [satisfied("How much do you like using Simpliskool?"), { id: "easy", kind: "scale", label: "How easy is it to see your timetable, homework and tests?", low: "Very hard", high: "Very easy", max: 5 }],
    },
  },
};

/** Reads a submitted survey form into answers, or returns what's missing. */
export function readAnswers(survey: SurveyKey, group: Group, fd: FormData): { answers: Record<string, string | number> } | { error: string } {
  const qs = SURVEYS[survey].questions[group] ?? [];
  const answers: Record<string, string | number> = {};
  for (const q of qs) {
    const raw = String(fd.get(q.id) ?? "").trim();
    if (q.kind === "hours") {
      const n = Number(raw.replace(/,/g, ""));
      if (raw === "" || !Number.isFinite(n) || n < 0 || n > 5000) return { error: `Enter a number of hours for "${q.label}" (0 if none).` };
      answers[q.id] = Math.round(n * 10) / 10;
    } else if (q.kind === "scale") {
      const n = Number(raw);
      const min = q.min ?? 1;
      if (raw === "" || !Number.isInteger(n) || n < min || n > q.max) return { error: `Choose an answer for "${q.label}".` };
      answers[q.id] = n;
    } else if (q.kind === "choice") {
      if (!q.options.includes(raw)) return { error: `Choose an answer for "${q.label}".` };
      answers[q.id] = raw;
    } else {
      if (!raw && !q.optional) return { error: `Please answer "${q.label}".` };
      if (raw) answers[q.id] = raw.slice(0, 1000);
    }
  }
  return { answers };
}
