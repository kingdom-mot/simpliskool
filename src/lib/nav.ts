import type { Role } from "@/lib/auth";

/** A menu item. `href` is null until that page is built; those show as "Soon". */
export type NavItem = { key: string; label: string; href: string | null };
export type NavGroup = { label: string; items: NavItem[] };

const ADMIN: NavGroup[] = [
  { label: "Overview", items: [{ key: "dashboard", label: "Dashboard", href: "/admin" }] },
  {
    label: "People",
    items: [
      { key: "students", label: "Students", href: "/admin/students" },
      { key: "parents", label: "Parents", href: null },
      { key: "staff", label: "Staff", href: "/admin/staff" },
      { key: "staffatt", label: "Staff attendance", href: null },
      { key: "admissions", label: "Admissions", href: null },
    ],
  },
  {
    label: "Academics",
    items: [
      { key: "classes", label: "Classes & subjects", href: "/admin/classes" },
      { key: "timetable", label: "Timetable", href: null },
      { key: "attendance", label: "Student attendance", href: "/admin/attendance" },
      { key: "lessonnotes", label: "Lesson note review", href: null },
      { key: "results", label: "Results", href: null },
      { key: "reportcards", label: "Report cards", href: null },
    ],
  },
  {
    label: "Finance",
    items: [
      { key: "fees", label: "Fee setup", href: null },
      { key: "payments", label: "Payments & defaulters", href: null },
      { key: "payroll", label: "Payroll", href: null },
    ],
  },
  {
    label: "Communication",
    items: [
      { key: "announcements", label: "Announcements", href: null },
      { key: "website", label: "School website", href: null },
    ],
  },
  {
    label: "School",
    items: [
      { key: "sessions", label: "Sessions & terms", href: "/admin/sessions" },
      { key: "settings", label: "Settings", href: null },
    ],
  },
];

// Same rules as the design: principals don't see payroll or settings; admins see less;
// bursars only see money screens.
const HIDE: Partial<Record<Role, string[]>> = {
  principal: ["payroll", "settings"],
  admin: ["payroll", "settings", "staffatt", "lessonnotes", "reportcards"],
};
const BURSAR_KEEP = ["dashboard", "students", "fees", "payments", "payroll"];

export function adminNav(role: Role): NavGroup[] {
  const allowed = (k: string) => (role === "bursar" ? BURSAR_KEEP.includes(k) : !(HIDE[role] ?? []).includes(k));
  return ADMIN.map((g) => ({ ...g, items: g.items.filter((i) => allowed(i.key)) })).filter((g) => g.items.length > 0);
}

export const TEACHER_NAV: NavGroup[] = [
  {
    label: "My day",
    items: [
      { key: "today", label: "Today", href: "/teacher" },
      { key: "classes", label: "My classes", href: null },
      { key: "timetable", label: "My timetable", href: null },
    ],
  },
  {
    label: "Attendance and results",
    items: [
      { key: "register", label: "Register", href: "/teacher/register" },
      { key: "scores", label: "Score entry", href: null },
      { key: "broadsheet", label: "Class broadsheet", href: null },
    ],
  },
  {
    label: "Teaching",
    items: [
      { key: "notes", label: "Lesson notes", href: null },
      { key: "homework", label: "Homework", href: null },
      { key: "marking", label: "Marking", href: null },
    ],
  },
  {
    label: "CBT and AI",
    items: [
      { key: "questions", label: "Question bank", href: null },
      { key: "cbt", label: "CBT tests", href: null },
      { key: "ai", label: "AI assistant", href: null },
    ],
  },
];

/** Bottom tabs for the phone-first parent and student portals. */
export type Tab = { key: string; label: string; href: string | null; icon: string };

export const PARENT_TABS: Tab[] = [
  { key: "home", label: "Home", href: "/parent", icon: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" },
  { key: "learning", label: "Learning", href: null, icon: "M4 19.5V5a2 2 0 0 1 2-2h14v16H6.5A2.5 2.5 0 0 0 4 21.5M8 7h8M8 11h6" },
  { key: "results", label: "Results", href: null, icon: "M4 20V10M10 20V4M16 20v-7M22 20H2" },
  { key: "fees", label: "Fees", href: null, icon: "M2 7h20v12H2zM2 11h20M6 15h4" },
  { key: "school", label: "School", href: null, icon: "M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" },
];

export const STUDENT_TABS: Tab[] = [
  { key: "home", label: "Home", href: "/student", icon: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" },
  { key: "timetable", label: "Timetable", href: null, icon: "M3 4h18v18H3zM16 2v4M8 2v4M3 10h18" },
  { key: "notes", label: "Notes", href: null, icon: "M4 19.5V5a2 2 0 0 1 2-2h14v16H6.5A2.5 2.5 0 0 0 4 21.5M8 7h8M8 11h6" },
  { key: "homework", label: "Homework", href: null, icon: "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" },
  { key: "results", label: "Results", href: null, icon: "M4 20V10M10 20V4M16 20v-7M22 20H2" },
];
