import Link from "next/link";
import { Flash } from "@/components/Flash";
import { GroupShell } from "@/components/GroupShell";
import { Bar, Empty, StatCard, ICONS } from "@/components/ui";
import { naira, pct } from "@/lib/format";
import { requireGroup } from "@/lib/group";
import { branchStats } from "@/lib/group-stats";
import { openBranch } from "./actions";

export const metadata = { title: "Group overview" };

const COLOURS = ["#173B70", "#0B7D6E", "#B7791F", "#7C3AED", "#BE185D", "#0369A1"];

export default async function GroupOverview(props: { searchParams: Promise<{ metric?: string }> }) {
  const sp = await props.searchParams;
  const ctx = await requireGroup("overview");
  const s = await branchStats(ctx);
  const sum = (f: (x: (typeof s)[number]) => number) => s.reduce((a, x) => a + f(x), 0);
  const students = sum((x) => x.students);
  const billed = sum((x) => x.billed);
  const collected = sum((x) => x.collected);
  const present = sum((x) => x.presentToday);
  const marked = sum((x) => x.markedToday);
  const staff = sum((x) => x.staff);
  const clocked = sum((x) => x.clockedIn);
  const late = sum((x) => x.lateStaff);
  const showMoney = ctx.role !== "academic";
  const showAcad = ctx.role !== "finance";
  const metrics = [
    showMoney && ["fees", "Fees"],
    ["att", "Attendance"],
    showAcad && ["res", "Results"],
    ["enr", "Enrolment"],
  ].filter(Boolean) as [string, string][];
  const metric = metrics.find((m) => m[0] === sp.metric)?.[0] ?? metrics[0][0];
  const rows = s.map((b, i) => {
    const c = COLOURS[i % COLOURS.length];
    if (metric === "fees") return { b: b.name, v: `${pct(b.collected, b.billed)}%`, w: pct(b.collected, b.billed), n: b.billed ? `${naira(b.collected)} of ${naira(b.billed)}` : "No bills this term yet", c };
    if (metric === "att") return { b: b.name, v: b.markedToday ? `${pct(b.presentToday, b.markedToday)}%` : "—", w: pct(b.presentToday, b.markedToday), n: b.markedToday ? `${b.presentToday} of ${b.markedToday} present today` : "No registers yet today", c };
    if (metric === "res") return { b: b.name, v: b.average === null ? "—" : String(b.average), w: Math.round(b.average ?? 0), n: "Average total score this term", c };
    return { b: b.name, v: String(b.students), w: b.capacity ? pct(b.students, b.capacity) : 0, n: b.capacity ? `${pct(b.students, b.capacity)}% of ${b.capacity} places` : "Add the number of places under Branches", c };
  });
  const attention = [
    ...(ctx.role === "proprietor" || ctx.role === "finance"
      ? s.filter((b) => b.payrollWaiting).map((b) => ({ t: `${b.name}: payroll waiting for approval`, d: `${naira(b.payrollWaiting!.net)} net pay`, href: "/group/payroll" }))
      : []),
    ...(showMoney ? s.filter((b) => b.billed && pct(b.collected, b.billed) < 60).map((b) => ({ t: `${b.name}: fees behind`, d: `${pct(b.collected, b.billed)}% collected this term`, href: "/group/finance" })) : []),
    ...(showAcad ? s.filter((b) => b.notesWaiting >= 5).map((b) => ({ t: `${b.name}: ${b.notesWaiting} lesson notes waiting for the principal`, d: "Each principal reviews their own branch's notes", href: "/group/academics" })) : []),
    ...(showAcad ? s.filter((b) => b.newApplications > 0).map((b) => ({ t: `${b.name}: ${b.newApplications} new application${b.newApplications === 1 ? "" : "s"}`, d: "Waiting for the branch to review", href: "/group/admissions" })) : []),
  ];

  return (
    <GroupShell ctx={ctx} active="overview" title="Group overview" sub={`All ${s.length} branch${s.length === 1 ? "" : "es"}${s[0]?.term ? ` · ${s[0].term}` : ""}`} actions={ctx.role === "proprietor" ? <Link className="s-btn" href="/group/branches#add-h">+ Add a branch</Link> : undefined}>
      <Flash />
      {!s.length ? (
        <Empty>No branches yet.</Empty>
      ) : (
        <>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard tone="blue" icon={ICONS.users} label="Students" value={students.toLocaleString("en-NG")} sub={`across ${s.length} branch${s.length === 1 ? "" : "es"}`} />
            {showMoney && <StatCard tone="teal" icon={ICONS.cash} label="Fees collected" value={naira(collected)} sub={`${pct(collected, billed)}% of ${naira(billed)} billed`} percent={pct(collected, billed)} />}
            <StatCard tone="green" icon={ICONS.check} label="Students present today" value={marked ? `${pct(present, marked)}%` : "—"} sub={marked ? `${present} of ${marked} marked` : "No registers yet today"} />
            <StatCard tone="amber" icon={ICONS.clock} label="Staff clocked in today" value={`${clocked} / ${staff}`} sub={`${late} late · marked by each principal`} />
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 xl:grid-cols-[1.4fr_1fr]">
            <section aria-labelledby="cmp-h" className="flex flex-col gap-3 rounded-[18px] border border-t-[5px] border-[#E3EAF3] border-t-c2 bg-white p-[22px]">
              <h2 id="cmp-h" className="text-lg !text-c1">
                Compare branches
              </h2>
              <nav aria-label="Compare by" className="flex flex-wrap gap-2">
                {metrics.map(([k, l]) => (
                  <Link key={k} href={`/group?metric=${k}`} aria-current={metric === k ? "page" : undefined} className={`flex min-h-[44px] items-center rounded-xl border-[1.5px] px-4 text-sm font-bold ${metric === k ? "border-c1 bg-c1 text-white" : "border-[#DCE5F0] bg-white text-brand-slate"}`}>
                    {l}
                  </Link>
                ))}
              </nav>
              <ul className="flex flex-col gap-3">
                {rows.map((r) => (
                  <li key={r.b} className="flex flex-col gap-1">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="font-bold text-brand-slate">{r.b}</span>
                      <span className="font-heading text-lg font-black" style={{ color: r.c }}>
                        {r.v}
                      </span>
                    </div>
                    <Bar value={r.w} fill={r.c} label={`${r.b}: ${r.v}`} />
                    <span className="text-xs text-[#4A5A70]">{r.n}</span>
                  </li>
                ))}
              </ul>
            </section>
            <section aria-labelledby="att-h" className="flex flex-col gap-3 rounded-[18px] border border-t-[5px] border-[#E3EAF3] border-t-[#B7791F] bg-white p-[22px]">
              <h2 id="att-h" className="text-lg !text-c1">
                Needs your attention
              </h2>
              {attention.length ? (
                <ul className="flex flex-col gap-2">
                  {attention.map((a) => (
                    <li key={a.t}>
                      <Link href={a.href} className="flex flex-col rounded-xl bg-[#FFFBF0] p-3 hover:bg-[#FFF6E3]">
                        <span className="text-sm font-bold text-brand-slate">{a.t}</span>
                        <span className="text-xs text-[#5C4310]">{a.d}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty>Nothing needs you right now.</Empty>
              )}
            </section>
          </div>

          <section aria-labelledby="br-h" className="flex flex-col gap-3">
            <h2 id="br-h" className="text-lg !text-c1">
              Branches
            </h2>
            <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2 xl:grid-cols-3">
              {s.map((b) => (
                <li key={b.id} className="flex flex-col gap-2 rounded-[18px] border border-[#E3EAF3] bg-white p-4">
                  <span className="font-heading text-lg font-extrabold text-c1">{b.name}</span>
                  <span className="text-sm text-[#4A5A70]">Principal: {b.principal ?? "not added yet"}</span>
                  <dl className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-brand-cloud p-2">
                      <dt className="text-[11px] font-bold uppercase text-[#4A5A70]">Students</dt>
                      <dd className="font-heading font-black text-c1">{b.students}</dd>
                    </div>
                    {showMoney && (
                      <div className="rounded-lg bg-brand-cloud p-2">
                        <dt className="text-[11px] font-bold uppercase text-[#4A5A70]">Fees paid</dt>
                        <dd className="font-heading font-black text-c1">{b.billed ? `${pct(b.collected, b.billed)}%` : "—"}</dd>
                      </div>
                    )}
                    <div className="rounded-lg bg-brand-cloud p-2">
                      <dt className="text-[11px] font-bold uppercase text-[#4A5A70]">Present</dt>
                      <dd className="font-heading font-black text-c1">{b.markedToday ? `${pct(b.presentToday, b.markedToday)}%` : "—"}</dd>
                    </div>
                  </dl>
                  {ctx.role === "proprietor" && (
                    <form action={openBranch}>
                      <input type="hidden" name="school_id" value={b.id} />
                      <button className="s-btn2">
                        Open branch →<span className="sr-only"> {b.name}</span>
                      </button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </GroupShell>
  );
}
