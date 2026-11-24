import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Box, Scroll, Stat, SuperShell } from "@/components/super";
import { Empty } from "@/components/ui";
import { replyTimes, surveyResponses, usage } from "@/lib/pilot";
import { requirePlatform } from "@/lib/platform";
import { demoSchoolIds } from "@/lib/platform-data";
import { getSettings } from "@/lib/platform-settings";
import { saveSurveySettings } from "./actions";

export const metadata = { title: "Pilot measures — Simpliskool back office" };

const lagosDay = (t: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date(t));
const nowMs = () => Date.now();
const pct = (v: number | null) => (v === null || v === undefined ? "—" : `${Math.round(Number(v))}%`);
const hrs = (v: number | null) => (v === null ? "—" : v < 1 ? `${Math.round(v * 60)} min` : `${v.toFixed(1)} h`);

export default async function SuperPilot(props: { searchParams: Promise<{ since?: string; all?: string }> }) {
  const sp = await props.searchParams;
  const ctx = await requirePlatform("pilot");
  const now = nowMs();
  const since = sp.since && /^\d{4}-\d{2}-\d{2}$/.test(sp.since) && sp.since <= lagosDay(now) ? sp.since : lagosDay(now - 30 * 864e5);
  const pilotOnly = sp.all !== "1";
  const demo = new Set(await demoSchoolIds(ctx.admin));
  const [rows, replies, responses, settings, { data: schools }, { data: fb }] = await Promise.all([
    usage(ctx.admin, since),
    replyTimes(ctx.admin, `${since}T00:00:00+01:00`, demo, now),
    surveyResponses(ctx.admin),
    getSettings(),
    ctx.admin.from("schools").select("id, name, plan, status").returns<{ id: string; name: string; plan: string; status: string }[]>(),
    ctx.admin.from("feedback").select("school_id, rating").gte("created_at", `${since}T00:00:00+01:00`).returns<{ school_id: string | null; rating: number | null }[]>(),
  ]);
  const info = new Map((schools ?? []).map((s) => [s.id, s]));
  const list = rows
    .filter((r) => !r.is_demo && info.get(r.school_id)?.status === "active" && (!pilotOnly || info.get(r.school_id)?.plan === "pilot"))
    .sort((a, b) => (info.get(a.school_id)?.name ?? "").localeCompare(info.get(b.school_id)?.name ?? ""));
  const answered = (id: string, s: string) => responses.filter((r) => r.school_id === id && r.survey === s).length;
  const fbCount = (id: string) => (fb ?? []).filter((f) => f.school_id === id).length;
  const q = (o: Record<string, string>) => `/super/pilot?${new URLSearchParams({ since, ...(pilotOnly ? {} : { all: "1" }), ...o })}`;
  const exp = (kind: string) => `/super/pilot/export?${new URLSearchParams({ kind, since, ...(pilotOnly ? {} : { all: "1" }) })}`;
  const a = replies.all;

  return (
    <SuperShell ctx={ctx} active="pilot" title="Pilot measures" sub="The figures for the pilot readiness scorecard: usage, record completeness, support reply times and the pilot surveys.">
      <form method="get" className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="pm-since">
            From
          </label>
          <input id="pm-since" name="since" type="date" className="sk-input py-2" defaultValue={since} max={lagosDay(now)} />
        </div>
        <label className="flex min-h-[44px] items-center gap-2 text-sm font-semibold text-[#263449]">
          <input type="checkbox" name="all" value="1" defaultChecked={!pilotOnly} className="h-5 w-5" /> Include schools not on the pilot plan
        </label>
        <button className="s-btn2">Show</button>
        <span className="flex flex-wrap gap-2 text-sm">
          {[7, 30, 90].map((d) => (
            <Link key={d} className="s-link" href={q({ since: lagosDay(now - d * 864e5) })}>
              Last {d} days
            </Link>
          ))}
        </span>
      </form>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Help requests" value={String(a.requests)} sub={`${a.answered} answered since ${since}`} />
        <Stat label="Typical first reply" value={hrs(a.medianHours)} sub={a.avgHours === null ? "no replies yet" : `median · average ${hrs(a.avgHours)}`} tone={a.medianHours !== null && a.medianHours <= 4 ? "good" : "plain"} />
        <Stat label="Replied within 4 working hours" value={a.within4 === null ? "—" : `${a.within4}%`} sub="Mon–Fri, 8am–5pm Lagos time" tone={a.within4 === null ? "plain" : a.within4 >= 90 ? "good" : "bad"} />
        <Stat label="Waiting for a first reply" value={String(a.waiting)} sub={a.oldestWaitHours === null ? "none waiting" : `oldest waiting ${hrs(a.oldestWaitHours)}`} tone={a.waiting ? "bad" : "good"} />
      </div>

      <Box
        id="pm-h"
        title={`Schools (${list.length})`}
        actions={
          <a className="s-btn2 !min-h-[40px]" href={exp("usage")}>
            Download for the scorecard (Usage sheet)
          </a>
        }
      >
        <p className="text-[13px] text-[#4A5A70]">
          Families joined: students with a parent who has signed in. Records complete: active students with a class, date of birth, admission number and a parent the school can reach. Registers: classes × school days with a register taken.
        </p>
        {list.length ? (
          <Scroll label="Pilot measures by school">
            <table className="tbl min-w-[1180px]">
              <caption className="sr-only">Pilot measures by school since {since}</caption>
              <thead>
                <tr>
                  <th scope="col">School</th>
                  <th scope="col">Students</th>
                  <th scope="col">Families joined</th>
                  <th scope="col">Teachers active this week</th>
                  <th scope="col">Registers taken</th>
                  <th scope="col">Records complete</th>
                  <th scope="col">Notices opened</th>
                  <th scope="col">Fees paid online</th>
                  <th scope="col">Help requests</th>
                  <th scope="col">First reply</th>
                  <th scope="col">Surveys (baseline / end)</th>
                  <th scope="col">Feedback</th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => {
                  const rep = replies.school(r.school_id);
                  return (
                    <tr key={r.school_id}>
                      <th scope="row">
                        <Link className="font-bold text-[#173B70] underline" href={`/super/schools/${r.school_id}#records-h`}>
                          {info.get(r.school_id)?.name}
                        </Link>
                      </th>
                      <td>{r.students}</td>
                      <td>{pct(r.families_joined_pct)}</td>
                      <td>{pct(r.teachers_active_pct)}</td>
                      <td>{pct(r.register_days_pct)}</td>
                      <td className={r.records_complete_pct !== null && r.records_complete_pct < 90 ? "font-bold text-[#912018]" : ""}>{pct(r.records_complete_pct)}</td>
                      <td>{pct(r.notices_opened_pct)}</td>
                      <td>{pct(r.fees_online_pct)}</td>
                      <td>{r.help_requests}</td>
                      <td>{hrs(rep.avgHours)}</td>
                      <td>
                        {answered(r.school_id, "baseline")} / {answered(r.school_id, "end")}
                      </td>
                      <td>{fbCount(r.school_id)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Scroll>
        ) : (
          <Empty>{pilotOnly ? "No active schools on the pilot plan yet. Tick the box to include every school." : "No active schools yet."}</Empty>
        )}
      </Box>

      <Box id="sv-h" title="Pilot surveys">
        <p className="text-sm text-[#263449]">
          <strong>Baseline survey:</strong> shown on people&apos;s home page for a school&apos;s first {settings.baseline_days} days: leaders give hours spent on admin, teachers give report-card time, parents say how they hear from the school today.{" "}
          <strong>End-of-pilot survey:</strong> shown to everyone while it&apos;s switched on: hours now, satisfaction, would recommend, and (owners) renewal and price.
        </p>
        <ActionForm action={saveSurveySettings} className="flex flex-wrap items-end gap-4">
          <label className="flex min-h-[44px] items-center gap-2 text-sm font-semibold text-[#263449]">
            <input type="checkbox" name="end_survey_open" value="1" defaultChecked={settings.end_survey_open} className="h-5 w-5" /> End-of-pilot survey is open
          </label>
          <div>
            <label className="label" htmlFor="sv-days">
              Show the baseline survey for (days after sign-up)
            </label>
            <input id="sv-days" name="baseline_days" inputMode="numeric" defaultValue={settings.baseline_days} className="sk-input max-w-[120px] py-2" />
          </div>
          <SubmitButton className="s-btn2" pending="Saving…">
            Save
          </SubmitButton>
        </ActionForm>
        <p className="text-sm text-[#263449]">{responses.length} answers so far. Download them in the scorecard&apos;s layout:</p>
        <div className="flex flex-wrap gap-2">
          <a className="s-btn2" href={exp("efficiency")}>
            Efficiency sheet (hours before and now)
          </a>
          <a className="s-btn2" href={exp("satisfaction")}>
            Satisfaction sheet
          </a>
          <a className="s-btn2" href={exp("answers")}>
            Every answer
          </a>
        </div>
      </Box>
    </SuperShell>
  );
}
