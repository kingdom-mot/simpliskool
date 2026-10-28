import "server-only";
import { currentTerms, lagosToday, type GroupCtx } from "@/lib/group";

export type BranchStats = {
  id: string;
  name: string;
  term: string | null;
  students: number;
  capacity: number | null;
  billed: number;
  collected: number;
  owing: number;
  presentToday: number;
  markedToday: number;
  staff: number;
  clockedIn: number;
  lateStaff: number;
  average: number | null;
  principal: string | null;
  payrollWaiting: { id: string; net: number } | null;
  notesWaiting: number;
  newApplications: number;
};

const STAFF = ["owner", "admin", "principal", "bursar", "teacher"];

/** The numbers for every branch the person may see, this term and today. */
export async function branchStats(ctx: GroupCtx): Promise<BranchStats[]> {
  const { admin } = ctx;
  const terms = await currentTerms(ctx);
  const today = lagosToday();
  const month = `${today.slice(0, 7)}-01`;
  return Promise.all(
    ctx.branches.map(async (b) => {
      const term = terms.get(b.id);
      const [students, invoices, att, staff, clock, scores, principal, run, notes, apps, late] = await Promise.all([
        admin.from("students").select("id", { count: "exact", head: true }).eq("school_id", b.id).eq("status", "active"),
        term ? admin.from("invoices").select("total_kobo, paid_kobo, student_id").eq("term_id", term.id).returns<{ total_kobo: number; paid_kobo: number; student_id: string }[]>() : Promise.resolve({ data: [] as { total_kobo: number; paid_kobo: number; student_id: string }[] }),
        admin.from("attendance").select("status").eq("school_id", b.id).eq("date", today).returns<{ status: string }[]>(),
        admin.from("memberships").select("user_id, role").eq("school_id", b.id).in("role", STAFF).returns<{ user_id: string; role: string }[]>(),
        admin.from("staff_attendance").select("user_id, clock_in").eq("school_id", b.id).eq("date", today).not("clock_in", "is", null).returns<{ user_id: string; clock_in: string }[]>(),
        term ? admin.from("scores").select("total").eq("school_id", b.id).eq("term_id", term.id).returns<{ total: number }[]>() : Promise.resolve({ data: [] as { total: number }[] }),
        admin.from("memberships").select("profiles(full_name)").eq("school_id", b.id).eq("role", "principal").limit(1).returns<{ profiles: { full_name: string | null } | null }[]>(),
        admin.from("payroll_runs").select("id, status, payslips(net_kobo)").eq("school_id", b.id).eq("month", month).maybeSingle<{ id: string; status: string; payslips: { net_kobo: number }[] }>(),
        admin.from("lesson_notes").select("id", { count: "exact", head: true }).eq("school_id", b.id).eq("status", "submitted"),
        admin.from("admission_applications").select("id", { count: "exact", head: true }).eq("school_id", b.id).eq("status", "new"),
        admin.from("schools").select("staff_late_after").eq("id", b.id).single<{ staff_late_after: string }>(),
      ]);
      const inv = invoices.data ?? [];
      const marks = att.data ?? [];
      const sc = scores.data ?? [];
      const lateAfter = late.data?.staff_late_after?.slice(0, 5) ?? "07:45";
      const clocked = clock.data ?? [];
      const hm = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
      return {
        id: b.id,
        name: b.name,
        term: term?.label ?? null,
        students: students.count ?? 0,
        capacity: b.capacity,
        billed: inv.reduce((a, i) => a + Number(i.total_kobo), 0),
        collected: inv.reduce((a, i) => a + Number(i.paid_kobo), 0),
        owing: inv.filter((i) => i.total_kobo > i.paid_kobo).length,
        presentToday: marks.filter((m) => m.status !== "absent").length,
        markedToday: marks.length,
        staff: new Set((staff.data ?? []).map((m) => m.user_id)).size,
        clockedIn: new Set(clocked.map((c) => c.user_id)).size,
        lateStaff: clocked.filter((c) => hm(c.clock_in) > lateAfter).length,
        average: sc.length ? Math.round((sc.reduce((a, s) => a + Number(s.total), 0) / sc.length) * 10) / 10 : null,
        principal: principal.data?.[0]?.profiles?.full_name ?? null,
        payrollWaiting: run.data && run.data.status === "draft" && run.data.payslips.length ? { id: run.data.id, net: run.data.payslips.reduce((a, p) => a + Number(p.net_kobo), 0) } : null,
        notesWaiting: notes.count ?? 0,
        newApplications: apps.count ?? 0,
      };
    }),
  );
}
