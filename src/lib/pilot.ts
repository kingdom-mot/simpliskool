import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { TASKS, type SurveyKey } from "@/lib/surveys";

type Admin = ReturnType<typeof createAdminClient>;
const HOUR = 3_600_000;
const LAGOS = HOUR; // Lagos is UTC+1 all year.

/** Working hours between two times: Monday to Friday, 8am to 5pm Lagos time. */
export function workingHours(from: number, to: number): number {
  if (to <= from) return 0;
  let total = 0;
  const startDay = Math.floor((from + LAGOS) / (24 * HOUR));
  const endDay = Math.floor((to + LAGOS) / (24 * HOUR));
  for (let d = startDay; d <= endDay; d++) {
    const dow = new Date(d * 24 * HOUR).getUTCDay(); // day of week of the Lagos date
    if (dow === 0 || dow === 6) continue;
    const open = d * 24 * HOUR - LAGOS + 8 * HOUR;
    const close = d * 24 * HOUR - LAGOS + 17 * HOUR;
    total += Math.max(0, Math.min(to, close) - Math.max(from, open));
  }
  return total / HOUR;
}

export type ReplyStats = { requests: number; answered: number; avgHours: number | null; medianHours: number | null; within4: number | null; waiting: number; oldestWaitHours: number | null };

/** First-reply times for help requests since a date, overall and per school. */
export async function replyTimes(admin: Admin, since: string, skip: Set<string>, now = Date.now()) {
  const { data } = await admin.rpc("platform_support_times", { p_since: since });
  const rows = ((data ?? []) as { ticket_id: number; school_id: string; created_at: string; first_reply_at: string | null; status: string }[]).filter((r) => !skip.has(r.school_id));
  const stats = (list: typeof rows): ReplyStats => {
    const answered = list.filter((r) => r.first_reply_at);
    const clock = answered.map((r) => (Date.parse(r.first_reply_at!) - Date.parse(r.created_at)) / HOUR).sort((a, b) => a - b);
    const work = answered.map((r) => workingHours(Date.parse(r.created_at), Date.parse(r.first_reply_at!)));
    const waiting = list.filter((r) => !r.first_reply_at && r.status === "open");
    return {
      requests: list.length,
      answered: answered.length,
      avgHours: clock.length ? clock.reduce((a, b) => a + b, 0) / clock.length : null,
      medianHours: clock.length ? clock[Math.floor((clock.length - 1) / 2)] : null,
      within4: work.length ? Math.round((100 * work.filter((h) => h <= 4).length) / work.length) : null,
      waiting: waiting.length,
      oldestWaitHours: waiting.length ? Math.max(...waiting.map((r) => (now - Date.parse(r.created_at)) / HOUR)) : null,
    };
  };
  const bySchool = new Map<string, typeof rows>();
  for (const r of rows) bySchool.set(r.school_id, [...(bySchool.get(r.school_id) ?? []), r]);
  return { all: stats(rows), school: (id: string) => stats(bySchool.get(id) ?? []) };
}

export type Usage = { school_id: string; is_demo: boolean; students: number; families_joined_pct: number | null; teachers_active_pct: number | null; register_days_pct: number | null; records_complete_pct: number | null; notices_opened_pct: number | null; fees_online_pct: number | null; help_requests: number };

export async function usage(admin: Admin, since: string): Promise<Usage[]> {
  const { data } = await admin.rpc("platform_pilot_usage", { p_since: since });
  return ((data ?? []) as Usage[]).map((u) => ({ ...u, students: Number(u.students), help_requests: Number(u.help_requests) }));
}

type Resp = { school_id: string; role: string; survey: SurveyKey; answers: Record<string, string | number> };
export async function surveyResponses(admin: Admin): Promise<Resp[]> {
  const { data } = await admin.from("survey_responses").select("school_id, role, survey, answers").limit(20000).returns<Resp[]>();
  return data ?? [];
}

const LEADERS = ["owner", "admin", "principal", "bursar"];
const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);
const nums = (rs: Resp[], key: string) => rs.map((r) => Number(r.answers[key])).filter((n) => Number.isFinite(n));

/** Before and now hours per task for one school (averaged across the school's leaders). */
export function efficiencyFor(rs: Resp[]) {
  const before = rs.filter((r) => r.survey === "baseline" && LEADERS.includes(r.role));
  const now = rs.filter((r) => r.survey === "end" && LEADERS.includes(r.role));
  return TASKS.map(([id]) => ({ before: avg(nums(before, `h_${id}`)), now: avg(nums(now, `h_${id}`)) }));
}

/** End-of-pilot satisfaction for one school, in the scorecard's columns. */
export function satisfactionFor(rs: Resp[]) {
  const end = rs.filter((r) => r.survey === "end");
  const by = (roles: string[]) => avg(nums(end.filter((r) => roles.includes(r.role)), "satisfaction"));
  const owner = end.find((r) => r.role === "owner");
  return {
    owner: by(["owner"]),
    principal: by(["principal", "admin"]),
    bursar: by(["bursar"]),
    teachers: by(["teacher"]),
    parents: by(["parent"]),
    students: by(["student"]),
    recommend: avg(nums(end, "recommend")),
    renew: owner ? String(owner.answers.renew ?? "") : "",
    price: owner ? String(owner.answers.price ?? "") : "",
    change: owner ? String(owner.answers.change ?? "") : "",
  };
}

/** One CSV line. */
export function csv(cells: (string | number | null | undefined)[]) {
  return cells.map((c) => (c === null || c === undefined ? "" : /[",\n]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : String(c))).join(",");
}
