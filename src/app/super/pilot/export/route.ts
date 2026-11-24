import { csv, efficiencyFor, replyTimes, satisfactionFor, surveyResponses, usage } from "@/lib/pilot";
import { logPlatform, requirePlatform } from "@/lib/platform";
import { demoSchoolIds } from "@/lib/platform-data";
import { TASKS } from "@/lib/surveys";

// CSV downloads laid out like the pilot readiness scorecard's sheets, so they can be pasted in.

export async function GET(request: Request) {
  const ctx = await requirePlatform("pilot");
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") ?? "usage";
  const since = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get("since") ?? "") ? url.searchParams.get("since")! : new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  const pilotOnly = url.searchParams.get("all") !== "1";
  const demo = new Set(await demoSchoolIds(ctx.admin));
  const { data: schools } = await ctx.admin.from("schools").select("id, name, plan, status").order("name").returns<{ id: string; name: string; plan: string; status: string }[]>();
  const chosen = (schools ?? []).filter((s) => !demo.has(s.id) && s.status === "active" && (!pilotOnly || s.plan === "pilot"));
  const lines: string[] = [];

  if (kind === "usage") {
    const [rows, replies] = await Promise.all([usage(ctx.admin, since), replyTimes(ctx.admin, `${since}T00:00:00+01:00`, demo)]);
    const by = new Map(rows.map((r) => [r.school_id, r]));
    lines.push(csv(["School", "Families joined (%)", "Teachers active weekly (%)", "School days with register marked (%)", "Student records complete (%)", "Notices opened by parents (%)", "Fees paid online (%)", "Help requests this period", "Avg hours to first reply"]));
    for (const s of chosen) {
      const r = by.get(s.id);
      const rep = replies.school(s.id);
      lines.push(csv([s.name, r?.families_joined_pct, r?.teachers_active_pct, r?.register_days_pct, r?.records_complete_pct, r?.notices_opened_pct, r?.fees_online_pct, r?.help_requests ?? 0, rep.avgHours === null ? null : Math.round(rep.avgHours * 10) / 10]));
    }
  } else {
    const all = await surveyResponses(ctx.admin);
    if (kind === "efficiency") {
      lines.push(csv(["School", ...TASKS.flatMap(([, l]) => [`${l}: before (hrs/month)`, `${l}: now (hrs/month)`])]));
      for (const s of chosen) lines.push(csv([s.name, ...efficiencyFor(all.filter((r) => r.school_id === s.id)).flatMap((t) => [t.before, t.now])]));
    } else if (kind === "satisfaction") {
      lines.push(csv(["School", "Owner / proprietor (1–5)", "Principal / admin (1–5)", "Bursar (1–5)", "Teachers, average (1–5)", "Parents, average (1–5)", "Students, average (1–5)", "Would recommend, average (0–10)", "Will renew and pay?", "Fair price per term (owner's view)", "Most wanted change"]));
      for (const s of chosen) {
        const x = satisfactionFor(all.filter((r) => r.school_id === s.id));
        lines.push(csv([s.name, x.owner, x.principal, x.bursar, x.teachers, x.parents, x.students, x.recommend, x.renew, x.price, x.change]));
      }
    } else {
      const names = new Map(chosen.map((s) => [s.id, s.name]));
      const keys = [...new Set(all.flatMap((r) => Object.keys(r.answers)))].sort();
      lines.push(csv(["School", "Survey", "Role", ...keys]));
      for (const r of all.filter((x) => names.has(x.school_id))) lines.push(csv([names.get(r.school_id), r.survey === "end" ? "End of pilot" : "Baseline", r.role, ...keys.map((k) => r.answers[k] as string | number | undefined)]));
    }
  }

  await logPlatform(ctx, `Downloaded pilot ${kind} figures`, "other", null);
  return new Response("﻿" + lines.join("\r\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="simpliskool-pilot-${kind}-${since}.csv"`,
      "cache-control": "no-store",
    },
  });
}
