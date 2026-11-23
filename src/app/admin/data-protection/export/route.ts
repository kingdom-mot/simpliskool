import writeXlsxFile from "write-excel-file/node";
import { requireSchool } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

// Everything the school holds in Simpliskool, as one Excel file (right to data portability,
// and so a school can always take its records with it). Owner only; every download is logged.

type Admin = ReturnType<typeof createAdminClient>;
type Cell = string | number | Date | null;

/** Reads every row of a query, 1,000 at a time (the database's limit per request). */
async function every<T>(make: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await make(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

const naira = (kobo: number | null | undefined) => (kobo == null ? null : Math.round(kobo) / 100);
const date = (iso: string | null | undefined) => (iso ? new Date(iso.length === 10 ? `${iso}T12:00:00+01:00` : iso) : null);
const head = (cols: string[]) => cols.map((value) => ({ value, fontWeight: "bold" as const }));

export async function GET() {
  const { school, user, fullName } = await requireSchool(["owner"]);
  const admin: Admin = createAdminClient();
  const id = school.id;

  const [classes, subjects, classSubjects, terms, sessions, students, guardians, members, attendance, scores, invoices, payments, announcements, applications] = await Promise.all([
    every<{ id: string; name: string; arm: string; class_teacher_id: string | null }>((a, b) => admin.from("classes").select("id, name, arm, class_teacher_id").eq("school_id", id).order("level_order").range(a, b)),
    every<{ id: string; name: string }>((a, b) => admin.from("subjects").select("id, name").eq("school_id", id).range(a, b)),
    every<{ id: string; class_id: string; subject_id: string }>((a, b) => admin.from("class_subjects").select("id, class_id, subject_id").eq("school_id", id).range(a, b)),
    every<{ id: string; session_id: string; term_no: number }>((a, b) => admin.from("terms").select("id, session_id, term_no").eq("school_id", id).range(a, b)),
    every<{ id: string; name: string }>((a, b) => admin.from("academic_sessions").select("id, name").eq("school_id", id).range(a, b)),
    every<{ id: string; admission_no: string; first_name: string; last_name: string; other_names: string | null; class_id: string | null; gender: string | null; date_of_birth: string | null; status: string; admitted_on: string | null; state_of_origin: string | null; blood_group: string | null; address: string | null }>((a, b) =>
      admin.from("students").select("id, admission_no, first_name, last_name, other_names, class_id, gender, date_of_birth, status, admitted_on, state_of_origin, blood_group, address").eq("school_id", id).order("admission_no").range(a, b),
    ),
    every<{ student_id: string; user_id: string; relationship: string | null }>((a, b) => admin.from("guardians").select("student_id, user_id, relationship").eq("school_id", id).range(a, b)),
    every<{ user_id: string; role: string; created_at: string }>((a, b) => admin.from("memberships").select("user_id, role, created_at").eq("school_id", id).range(a, b)),
    every<{ student_id: string; class_id: string | null; date: string; status: string; excused: boolean | null }>((a, b) => admin.from("attendance").select("student_id, class_id, date, status, excused").eq("school_id", id).order("date").order("id").range(a, b)),
    every<{ student_id: string; class_subject_id: string; term_id: string; ca1: number | null; ca2: number | null; ca3: number | null; exam: number | null; total: number | null }>((a, b) =>
      admin.from("scores").select("student_id, class_subject_id, term_id, ca1, ca2, ca3, exam, total").eq("school_id", id).order("id").range(a, b),
    ),
    every<{ id: string; student_id: string; term_id: string; total_kobo: number; paid_kobo: number; balance_kobo: number }>((a, b) => admin.from("invoices").select("id, student_id, term_id, total_kobo, paid_kobo, balance_kobo").eq("school_id", id).order("created_at").range(a, b)),
    every<{ invoice_id: string; amount_kobo: number; method: string; receipt_no: string | null; reference: string | null; paystack_reference: string | null; paid_at: string | null; created_at: string; voided_at: string | null; void_reason: string | null }>((a, b) =>
      admin.from("payments").select("invoice_id, amount_kobo, method, receipt_no, reference, paystack_reference, paid_at, created_at, voided_at, void_reason").eq("school_id", id).order("created_at").range(a, b),
    ),
    every<{ title: string; body: string; audience: string; kind: string; created_at: string }>((a, b) => admin.from("announcements").select("title, body, audience, kind, created_at").eq("school_id", id).order("created_at").range(a, b)),
    every<{ ref_no: number | null; child_name: string; class_applied: string | null; parent_name: string; parent_phone: string; parent_email: string | null; status: string; created_at: string }>((a, b) =>
      admin.from("admission_applications").select("ref_no, child_name, class_applied, parent_name, parent_phone, parent_email, status, created_at").eq("school_id", id).order("created_at").range(a, b),
    ),
  ]);

  // People's names and contacts, read in batches of 100.
  const ids = [...new Set([...guardians.map((g) => g.user_id), ...members.map((m) => m.user_id), ...classes.map((c) => c.class_teacher_id).filter((x): x is string => !!x)])];
  const people = new Map<string, { full_name: string | null; email: string | null; phone: string | null }>();
  for (let i = 0; i < ids.length; i += 100) {
    const { data } = await admin.from("profiles").select("id, full_name, email, phone").in("id", ids.slice(i, i + 100)).returns<{ id: string; full_name: string | null; email: string | null; phone: string | null }[]>();
    for (const p of data ?? []) people.set(p.id, p);
  }

  const cls = new Map(classes.map((c) => [c.id, `${c.name}${c.arm ? ` ${c.arm}` : ""}`]));
  const stu = new Map(students.map((s) => [s.id, s]));
  const subj = new Map(subjects.map((s) => [s.id, s.name]));
  const cs = new Map(classSubjects.map((c) => [c.id, c]));
  const sess = new Map(sessions.map((s) => [s.id, s.name]));
  const termName = new Map(terms.map((t) => [t.id, `${["", "First", "Second", "Third"][t.term_no] ?? `Term ${t.term_no}`} term ${sess.get(t.session_id) ?? ""}`.trim()]));
  const inv = new Map(invoices.map((i) => [i.id, i]));
  const name = (sid: string) => {
    const s = stu.get(sid);
    return s ? `${s.first_name} ${s.last_name}` : "";
  };
  const adm = (sid: string) => stu.get(sid)?.admission_no ?? "";
  const roles = new Map<string, string[]>();
  for (const m of members) roles.set(m.user_id, [...(roles.get(m.user_id) ?? []), m.role]);
  const staff = [...roles].filter(([, r]) => r.some((x) => x !== "parent" && x !== "student"));

  const sheets: { sheet: string; data: Cell[][] | ({ value: string; fontWeight: "bold" } | Cell)[][]; stickyRowsCount: number }[] = [
    {
      sheet: "About this file",
      stickyRowsCount: 0,
      data: [
        [{ value: `${school.name}: all records in Simpliskool`, fontWeight: "bold" }],
        [`Downloaded ${new Date().toLocaleString("en-GB", { timeZone: "Africa/Lagos" })} by ${fullName}.`],
        ["This file contains personal data, including children's data. Keep it safe and share it only with people who need it."],
        ["Each sheet is one kind of record. Money is in naira."],
      ],
    },
    {
      sheet: "Students",
      stickyRowsCount: 1,
      data: [head(["Admission no.", "First name", "Last name", "Other names", "Class", "Gender", "Date of birth", "Status", "Admitted on", "State of origin", "Blood group", "Address"]), ...students.map((s) => [s.admission_no, s.first_name, s.last_name, s.other_names, s.class_id ? (cls.get(s.class_id) ?? "") : "", s.gender, date(s.date_of_birth), s.status, date(s.admitted_on), s.state_of_origin, s.blood_group, s.address])],
    },
    {
      sheet: "Parents",
      stickyRowsCount: 1,
      data: [head(["Parent", "Phone", "Email", "Relationship", "Child", "Child's admission no."]), ...guardians.map((g) => { const p = people.get(g.user_id); return [p?.full_name ?? "", p?.phone ? `+${p.phone.replace(/^\+/, "")}` : "", p?.email ?? "", g.relationship, name(g.student_id), adm(g.student_id)]; })],
    },
    {
      sheet: "Staff",
      stickyRowsCount: 1,
      data: [head(["Name", "Email", "Phone", "Role", "Joined"]), ...staff.map(([uid, r]) => { const p = people.get(uid); return [p?.full_name ?? "", p?.email ?? "", p?.phone ? `+${p.phone.replace(/^\+/, "")}` : "", r.join(", "), date(members.find((m) => m.user_id === uid)?.created_at)]; })],
    },
    {
      sheet: "Classes",
      stickyRowsCount: 1,
      data: [head(["Class", "Class teacher", "Subjects"]), ...classes.map((c) => [cls.get(c.id) ?? c.name, c.class_teacher_id ? (people.get(c.class_teacher_id)?.full_name ?? "") : "", classSubjects.filter((x) => x.class_id === c.id).map((x) => subj.get(x.subject_id) ?? "").join(", ")])],
    },
    {
      sheet: "Attendance",
      stickyRowsCount: 1,
      data: [head(["Date", "Admission no.", "Student", "Class", "Status", "Excused"]), ...attendance.map((a) => [date(a.date), adm(a.student_id), name(a.student_id), a.class_id ? (cls.get(a.class_id) ?? "") : "", a.status, a.excused ? "Yes" : ""])],
    },
    {
      sheet: "Scores",
      stickyRowsCount: 1,
      data: [head(["Term", "Class", "Subject", "Admission no.", "Student", "CA 1", "CA 2", "CA 3", "Exam", "Total"]), ...scores.map((s) => { const c = cs.get(s.class_subject_id); return [termName.get(s.term_id) ?? "", c ? (cls.get(c.class_id) ?? "") : "", c ? (subj.get(c.subject_id) ?? "") : "", adm(s.student_id), name(s.student_id), s.ca1, s.ca2, s.ca3, s.exam, s.total]; })],
    },
    {
      sheet: "Invoices",
      stickyRowsCount: 1,
      data: [head(["Term", "Admission no.", "Student", "Total (₦)", "Paid (₦)", "Balance (₦)"]), ...invoices.map((i) => [termName.get(i.term_id) ?? "", adm(i.student_id), name(i.student_id), naira(i.total_kobo), naira(i.paid_kobo), naira(i.balance_kobo)])],
    },
    {
      sheet: "Payments",
      stickyRowsCount: 1,
      data: [head(["Date", "Receipt", "Admission no.", "Student", "Amount (₦)", "Method", "Reference", "Cancelled", "Why cancelled"]), ...payments.map((p) => { const i = inv.get(p.invoice_id); return [date(p.paid_at ?? p.created_at), p.receipt_no, i ? adm(i.student_id) : "", i ? name(i.student_id) : "", naira(p.amount_kobo), p.method, p.reference ?? p.paystack_reference, p.voided_at ? "Yes" : "", p.void_reason]; })],
    },
    {
      sheet: "Announcements",
      stickyRowsCount: 1,
      data: [head(["Date", "Title", "Sent to", "Kind", "Message"]), ...announcements.map((a) => [date(a.created_at), a.title, a.audience, a.kind, a.body])],
    },
    {
      sheet: "Admission applications",
      stickyRowsCount: 1,
      data: [head(["Date", "Reference", "Child", "Class applied for", "Parent", "Phone", "Email", "Status"]), ...applications.map((a) => [date(a.created_at), `APP-${String(a.ref_no ?? 0).padStart(4, "0")}`, a.child_name, a.class_applied, a.parent_name, a.parent_phone, a.parent_email, a.status])],
    },
  ];

  const buffer = await writeXlsxFile(
    sheets.map((s) => ({ ...s, data: s.data.map((row) => row.map((c) => (c instanceof Date ? { value: c, type: Date, format: "dd mmm yyyy" } : c))) })) as Parameters<typeof writeXlsxFile>[0],
  ).toBuffer();

  await admin.from("audit_log").insert({ school_id: id, actor_id: user.id, table_name: "school", action: "EXPORT", details: { note: "Downloaded all school data", rows: students.length } });

  const file = `${school.name.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "")}-all-data-${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new Response(new Uint8Array(buffer), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${file}"`,
      "cache-control": "no-store",
    },
  });
}
