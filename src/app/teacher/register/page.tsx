import Link from "next/link";
import { PortalShell } from "@/components/PortalShell";
import { OfflineReady } from "@/components/OfflineReady";
import { classLabel } from "@/components/admin";
import { Empty } from "@/components/ui";
import { requireSchool } from "@/lib/auth";
import { TEACHER_NAV } from "@/lib/nav";
import { RegisterForm } from "./RegisterForm";

type Status = "present" | "absent" | "late";

function lagosToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date());
}

export default async function RegisterPage(props: { searchParams: Promise<{ class?: string; date?: string }> }) {
  const sp = await props.searchParams;
  const { supabase, school, user, fullName } = await requireSchool(["teacher"]);

  // Form classes this teacher takes the register for.
  const { data: classes } = await supabase
    .from("classes")
    .select("id, name, arm")
    .eq("school_id", school.id)
    .eq("class_teacher_id", user.id)
    .order("level_order")
    .order("name")
    .order("arm");
  const cls = classes?.find((c) => c.id === sp.class) ?? classes?.[0];

  const today = lagosToday();
  const oldest = new Date(`${today}T12:00:00Z`);
  oldest.setUTCDate(oldest.getUTCDate() - 14);
  const minDate = oldest.toISOString().slice(0, 10);
  const dateChosen = !!sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) && sp.date <= today && sp.date >= minDate;
  const date = dateChosen ? sp.date! : today;

  let body: React.ReactNode;
  if (!cls) {
    body = <Empty>You aren&apos;t the class teacher of any class yet. The school admin sets class teachers under Classes and subjects.</Empty>;
  } else {
    const [{ data: students }, { data: marks }] = await Promise.all([
      supabase.from("students").select("id, first_name, last_name").eq("class_id", cls.id).eq("status", "active").order("last_name").order("first_name"),
      supabase.from("attendance").select("student_id, status").eq("class_id", cls.id).eq("date", date),
    ]);
    const saved: Record<string, Status> = {};
    for (const m of marks ?? []) saved[m.student_id] = m.status as Status;
    const label = classLabel(cls.name, cls.arm);

    body = (
      <>
        <form method="get" className="flex flex-wrap items-end gap-3 rounded-[18px] border border-[#E3EAF3] bg-white p-4">
          {(classes?.length ?? 0) > 1 && (
            <div className="min-w-[160px] flex-1">
              <label className="label" htmlFor="r-class">Class</label>
              <select className="sk-input sk-select" id="r-class" name="class" defaultValue={cls.id}>
                {classes!.map((c) => (
                  <option key={c.id} value={c.id}>
                    {classLabel(c.name, c.arm)}
                  </option>
                ))}
              </select>
            </div>
          )}
          {(classes?.length ?? 0) <= 1 && <input type="hidden" name="class" value={cls.id} />}
          <div className="min-w-[180px] flex-1">
            <label className="label" htmlFor="r-date">Date</label>
            <input className="sk-input" id="r-date" name="date" type="date" defaultValue={date} min={minDate} max={today} />
          </div>
          <button className="s-btn2">Open register</button>
        </form>
        {students?.length ? (
          <RegisterForm
            key={`${cls.id}-${date}`}
            classId={cls.id}
            className={label}
            date={date}
            dateChosen={dateChosen}
            students={students.map((s) => ({ id: s.id, name: `${s.first_name} ${s.last_name}` }))}
            saved={saved}
          />
        ) : (
          <Empty>No students in {label} yet.</Empty>
        )}
      </>
    );
  }

  return (
    <PortalShell school={school} roleLabel="Teacher" fullName={fullName} groups={TEACHER_NAV} active="register">
      <OfflineReady />
      <div className="flex flex-col gap-4">
        <div>
          <nav aria-label="Breadcrumb" className="text-sm text-[#4A5A70]">
            <Link href="/teacher" className="s-link">
              Today
            </Link>{" "}
            / Attendance
          </nav>
          <h1 className="mt-1 text-[30px] leading-tight !text-c1">Register{cls ? ` · ${classLabel(cls.name, cls.arm)}` : ""}</h1>
        </div>
        {body}
      </div>
    </PortalShell>
  );
}
