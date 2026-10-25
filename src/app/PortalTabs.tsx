"use client";

import { useRef, useState } from "react";

const ROLES = [
  {
    id: "admin",
    label: "Admin & proprietor",
    title: "See the whole school at a glance",
    desc: "Set up sessions, classes and staff once. Then watch fees, attendance and results update in real time.",
    panel: "Today at Bright Stars",
    points: ["Admissions, enrolment and student records", "Fee invoices, online payments and defaulter lists", "Approve and release results with one click", "Staff attendance, payroll and timetables"],
    rows: [["Fees collected this term", "₦18.4m of ₦25.9m"], ["Students present today", "617 of 642"], ["New admission forms", "9 waiting"], ["Results awaiting approval", "JSS 1–3"]],
  },
  {
    id: "teacher",
    label: "Teachers",
    title: "Classroom overview",
    desc: "Mark attendance in seconds, enter scores once, and the AI assistant helps with notes and comments.",
    panel: "Mrs Okafor · JSS 2A",
    points: ["Attendance that works offline", "Score entry with automatic grading", "Lesson notes approved by the principal", "Homework, CBT tests and AI help"],
    rows: [["Today’s attendance", "Not yet taken"], ["Mathematics CA 2 scores", "28 of 34 entered"], ["Lesson note, week 9", "Approved"], ["Next class", "Basic Science · 2:00pm"]],
  },
  {
    id: "parent",
    label: "Parents",
    title: "Parents stay in the loop, without the calls",
    desc: "One login for all their children. Results, fees, attendance and school news, right on their phone.",
    panel: "Mr Adebayo · 2 children",
    points: ["Pay fees online and download receipts", "View and download report cards", "Daily attendance and homework updates", "School announcements and events"],
    rows: [["Tolu · JSS 2", "Fees paid"], ["Kemi · Primary 4", "₦35,000 due"], ["First Term result", "Ready to view"], ["PTA meeting", "Sat, 14 Nov"]],
  },
  {
    id: "student",
    label: "Students",
    title: "Everything a student needs for the day",
    desc: "Timetable, homework, lesson notes and CBT practice in one simple space. Younger pupils sign in with a PIN.",
    panel: "Tolu Adebayo · JSS 2A",
    points: ["Today's timetable and homework", "Lesson notes from every subject", "CBT tests and practice quizzes", "Results history across terms"],
    rows: [["Next lesson", "English · 09:20"], ["Homework due", "2 this week"], ["CBT: Basic Science", "Opens Thu 10:00"], ["Last term average", "78.4%"]],
  },
  {
    id: "group",
    label: "School groups",
    title: "Run every branch from one dashboard",
    desc: "For proprietors with more than one campus: compare branches and spot problems early.",
    panel: "Bright Stars Group · 3 branches",
    points: ["Fees and enrolment across all branches", "Compare attendance and results", "Shared settings and report cards", "Approve payroll for every branch"],
    rows: [["Ikeja campus", "71% fees · 96% present"], ["Lekki campus", "68% fees · 94% present"], ["Abeokuta campus", "63% fees · 93% present"], ["Total students", "1,804"]],
  },
];

export function PortalTabs() {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const role = ROLES[active];

  function onKey(e: React.KeyboardEvent, i: number) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = (i + (e.key === "ArrowRight" ? 1 : ROLES.length - 1)) % ROLES.length;
    setActive(next);
    refs.current[next]?.focus();
  }

  return (
    <div>
      <div role="tablist" aria-label="Portals" className="mx-auto flex max-w-full flex-wrap justify-center gap-1.5 rounded-2xl bg-white/10 p-1.5 sm:w-fit">
        {ROLES.map((r, i) => (
          <button
            key={r.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="tab"
            id={`ptab-${r.id}`}
            aria-selected={i === active}
            aria-controls="portal-panel"
            tabIndex={i === active ? 0 : -1}
            onClick={() => setActive(i)}
            onKeyDown={(e) => onKey(e, i)}
            className={`min-h-[44px] rounded-xl px-4 text-[15px] ${i === active ? "bg-brand-teal font-extrabold text-[#0A1F3D]" : "font-semibold text-[#E3EAF3] hover:bg-white/10"}`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div id="portal-panel" role="tabpanel" aria-labelledby={`ptab-${role.id}`} className="mt-12 grid items-center gap-10 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <h3 className="text-3xl leading-tight !text-white md:text-4xl">{role.title}</h3>
          <p className="mt-4 text-lg leading-relaxed text-[#DCE5F0]">{role.desc}</p>
          <ul className="mt-6 space-y-3">
            {role.points.map((p) => (
              <li key={p} className="flex items-start gap-3 text-base text-white">
                <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3FD1B4" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="mt-px flex-none">
                  <circle cx="12" cy="12" r="10" />
                  <path d="m8 12 3 3 5-6" />
                </svg>
                {p}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white p-6 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.45)]">
          <div className="flex items-center justify-between gap-3 border-b border-[#EEF3F9] pb-4">
            <span className="font-heading text-lg font-extrabold text-brand-navy">{role.panel}</span>
            <span className="rounded-full bg-[#E7F6F2] px-3 py-1 text-xs font-extrabold text-[#0B6B5A]">Live example</span>
          </div>
          <dl className="divide-y divide-[#EEF3F9]">
            {role.rows.map(([k, v]) => (
              <div key={k} className="flex flex-wrap items-center justify-between gap-2 py-4">
                <dt className="text-[15px] text-[#4A5A70]">{k}</dt>
                <dd className="text-[15px] font-bold text-brand-navy">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}
