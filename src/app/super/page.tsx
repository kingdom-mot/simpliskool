import Link from "next/link";
import { Flash } from "@/components/Flash";
import { Box, LinkTabs, money, Scroll, Stat, SuperShell } from "@/components/super";
import { Pill } from "@/components/ui";
import { emailReady } from "@/lib/email";
import { paystackReady, paystackTestMode } from "@/lib/paystack";
import { ago, requirePlatform } from "@/lib/platform";
import { demoSchoolIds, health, lagosMidnight, notDemo, longDay, nameMatches, nowMs, parentsPct, schoolRows } from "@/lib/platform-data";
import { smsReady } from "@/lib/sms";

export const metadata = { title: "Platform overview — Simpliskool back office" };

const WEEK = 7 * 86_400_000;
/** Monday 00:00 Lagos time of the week containing `t`. */
function weekStart(t: number) {
  const lagos = new Date(t + 3600_000);
  const day = (lagos.getUTCDay() + 6) % 7;
  return Date.UTC(lagos.getUTCFullYear(), lagos.getUTCMonth(), lagos.getUTCDate() - day) - 3600_000;
}
const dayMonth = (t: number) => new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", day: "numeric", month: "short" }).format(new Date(t));

export default async function SuperOverview(props: { searchParams: Promise<{ m?: string }> }) {
  const sp = await props.searchParams;
  const ctx = await requirePlatform("overview");
  const now = nowMs();
  const first = weekStart(now) - 8 * WEEK;
  const demo = await demoSchoolIds(ctx.admin);
  const [rows, { data: terms }, active, { data: weekly }, { data: tickets }, { data: refunds }, { data: notes }] = await Promise.all([
    schoolRows(ctx.admin),
    notDemo(ctx.admin.from("terms").select("id"), demo).eq("is_current", true).returns<{ id: string }[]>(),
    ctx.admin.rpc("platform_active_since", { p_since: lagosMidnight() }).then((r) => Number(r.data) || 0),
    notDemo(ctx.admin.from("payments").select("amount_kobo, created_at, method"), demo).eq("status", "success").gte("created_at", new Date(first).toISOString()).limit(20000).returns<{ amount_kobo: number; created_at: string; method: string }[]>(),
    notDemo(ctx.admin.from("support_tickets").select("id, priority, created_at"), demo).eq("status", "open").returns<{ id: number; priority: string; created_at: string }[]>(),
    notDemo(ctx.admin.from("refund_requests").select("id"), demo).eq("status", "asked").returns<{ id: string }[]>(),
    notDemo(ctx.admin.from("notifications").select("channel, status"), demo).gte("created_at", new Date(now - WEEK).toISOString()).in("channel", ["email", "sms"]).limit(50000).returns<{ channel: string; status: string }[]>(),
  ]);
  const termIds = (terms ?? []).map((t) => t.id);
  const { data: termPays } = termIds.length
    ? await notDemo(ctx.admin.from("payments").select("amount_kobo, method, invoices!inner(term_id)"), demo).eq("status", "success").in("invoices.term_id", termIds).limit(50000).returns<{ amount_kobo: number; method: string }[]>()
    : { data: [] as { amount_kobo: number; method: string }[] };

  const live = rows.filter((r) => r.status === "active");
  const groups = new Map<string, number>();
  for (const r of live) if (r.group_id) groups.set(r.group_id, (groups.get(r.group_id) ?? 0) + 1);
  const single = live.filter((r) => !r.group_id).length;
  const students = live.reduce((a, r) => a + r.students, 0);
  const joined = live.reduce((a, r) => a + r.families_joined, 0);
  const termTotal = (termPays ?? []).reduce((a, p) => a + Number(p.amount_kobo), 0);
  const online = (termPays ?? []).filter((p) => p.method === "paystack").length;

  const m = sp.m === "cnt" ? "cnt" : "amt";
  const weeks = Array.from({ length: 9 }, (_, i) => first + i * WEEK);
  const bars = weeks.map((w) => {
    const inWeek = (weekly ?? []).filter((p) => {
      const t = Date.parse(p.created_at);
      return t >= w && t < w + WEEK;
    });
    return { w, amt: inWeek.reduce((a, p) => a + Number(p.amount_kobo), 0), cnt: inWeek.length };
  });
  const max = Math.max(1, ...bars.map((b) => (m === "amt" ? b.amt : b.cnt)));

  const toCheck = rows.filter((r) => r.status === "active" && !r.payments_approved_at && r.check_status === "waiting");
  const mismatched = toCheck.filter((r) => nameMatches(r.name, r.payout_name) === false).length;
  const urgent = (tickets ?? []).filter((t) => t.priority === "urgent").length;
  const oldest = (tickets ?? []).map((t) => t.created_at).sort()[0];
  const attention = [
    toCheck.length && { t: `${toCheck.length} new school${toCheck.length === 1 ? "" : "s"} to check`, d: mismatched ? `${mismatched} bank account name${mismatched === 1 ? " doesn't" : "s don't"} match the school` : "Check them before parents can pay online", href: "/super/checks", kind: "warn" },
    refunds?.length && { t: `${refunds.length} refund${refunds.length === 1 ? "" : "s"} asked for by schools`, d: "Refund the parent or decline", href: "/super/payments?tab=ds", kind: "bad" },
    tickets?.length && { t: `${tickets.length} open support request${tickets.length === 1 ? "" : "s"}`, d: `${urgent} urgent · oldest waiting ${ago(oldest, now).replace(" ago", "")}`, href: "/super/support", kind: "info" },
  ].filter(Boolean) as { t: string; d: string; href: string; kind: "warn" | "bad" | "info" }[];

  const sent = (ch: string) => (notes ?? []).filter((n) => n.channel === ch && n.status === "sent").length;
  const failed = (ch: string) => (notes ?? []).filter((n) => n.channel === ch && n.status === "failed").length;
  const rate = (ch: string) => (sent(ch) + failed(ch) ? `${Math.round((sent(ch) / (sent(ch) + failed(ch))) * 1000) / 10}% delivered this week` : "Nothing sent this week");
  const services = [
    { n: "Paystack", d: paystackReady() ? (paystackTestMode() ? "Test mode: no real money moves" : "Live payments and split payouts") : "PAYSTACK_SECRET_KEY not set", ok: paystackReady() },
    { n: "Supabase", d: "Database and sign-in", ok: true },
    { n: "Resend", d: emailReady() ? `Email · ${rate("email")}` : "RESEND_API_KEY not set", ok: emailReady() && failed("email") <= sent("email") / 10 },
    { n: "SMS provider (Termii)", d: smsReady() ? `Texts and alerts · ${rate("sms")}` : "TERMII_API_KEY not set", ok: smsReady() && failed("sms") <= sent("sms") / 10 },
    { n: "Vercel", d: "Website and app hosting", ok: true },
  ];
  const act = [...live].sort((a, b) => b.students - a.students).slice(0, 8);
  const PILL = { good: "good", warn: "warn", bad: "bad", info: "info" } as const;
  const BG = { warn: "bg-[#FFF6E3] text-[#5C3E00]", bad: "bg-[#FEF3F2] text-[#7A1A1A]", info: "bg-[#EEF3F9] text-[#173B70]" };

  return (
    <SuperShell
      ctx={ctx}
      active="overview"
      title="Platform overview"
      sub={longDay(new Date(now).toISOString())}
      actions={
        <>
          {ctx.can("notices") && (
            <Link className="s-btn2" href="/super/notices">
              Post a notice
            </Link>
          )}
          {ctx.can("school.add") && (
            <Link className="s-btn" href="/super/schools?add=1#add-h">
              + Add a school
            </Link>
          )}
        </>
      }
    >
      <Flash />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat tone="navy" label="Schools live" value={String(live.length)} sub={`${single} single school${single === 1 ? "" : "s"} · ${groups.size} group${groups.size === 1 ? "" : "s"}${groups.size ? ` of ${[...groups.values()].reduce((a, b) => a + b, 0)} branches` : ""}`} />
        <Stat label="Students" value={students.toLocaleString("en-NG")} sub={`${joined.toLocaleString("en-NG")} with a parent account (${students ? Math.round((joined / students) * 100) : 0}%)`} />
        <Stat label="Fees paid this term" value={money(termTotal)} sub={`${online.toLocaleString("en-NG")} payment${online === 1 ? "" : "s"} through Paystack`} />
        <Stat tone="good" label="Active today" value={active.toLocaleString("en-NG")} sub="people signed in" />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Box id="wk-h" title="Fees paid each week" actions={<LinkTabs label="Measure" current={m} tabs={[["amt", "Amount", "/super?m=amt"], ["cnt", "Number of payments", "/super?m=cnt"]]} />}>
          <div role="img" aria-label={`${m === "amt" ? "Fees paid" : "Number of payments"} each week for the last 9 weeks: ${bars.map((b) => `${dayMonth(b.w)} ${m === "amt" ? money(b.amt) : b.cnt}`).join(", ")}`} className="flex h-[220px] items-end gap-2 border-b border-[#E3EAF3] pt-2.5">
            {bars.map((b, i) => (
              <div key={b.w} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
                <span className="hidden text-[11px] font-extrabold text-[#173B70] sm:block sm:text-xs">{m === "amt" ? money(b.amt) : b.cnt}</span>
                <div className="w-full max-w-12 rounded-t-lg" style={{ height: `${Math.round(((m === "amt" ? b.amt : b.cnt) / max) * 170)}px`, background: i === bars.length - 1 ? "#0F9D8A" : "#173B70" }} />
              </div>
            ))}
          </div>
          <div aria-hidden="true" className="flex gap-2">
            {bars.map((b) => (
              <span key={b.w} className="min-w-0 flex-1 truncate text-center text-[10px] text-[#4A5A70] sm:text-xs">
                {dayMonth(b.w)}
              </span>
            ))}
          </div>
        </Box>
        <Box id="todo-h" title="Needs action">
          {attention.length ? (
            attention.map((a) => (
              <Link key={a.t} href={a.href} className={`block rounded-[14px] p-3.5 ${BG[a.kind]}`}>
                <span className="block font-extrabold">{a.t}</span>
                <span className="mt-1 block text-[13px]">{a.d}</span>
              </Link>
            ))
          ) : (
            <p className="rounded-xl bg-brand-cloud px-4 py-3 text-sm text-[#4A5A70]">Nothing needs action right now.</p>
          )}
        </Box>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Box id="act-h" title="Schools by activity">
          <Scroll label="Schools by activity">
            <table className="tbl min-w-[560px]">
              <caption className="sr-only">Largest schools and how much they use Simpliskool</caption>
              <thead>
                <tr>
                  <th scope="col">School</th>
                  <th scope="col" className="!text-right">
                    Students
                  </th>
                  <th scope="col">Parents joined</th>
                  <th scope="col">Last active</th>
                  <th scope="col">Health</th>
                </tr>
              </thead>
              <tbody>
                {act.map((r) => {
                  const h = health(r, now);
                  return (
                    <tr key={r.id}>
                      <td>
                        <Link href={`/super/schools/${r.id}`} className="font-extrabold text-c1 hover:underline">
                          {r.name}
                        </Link>
                        {r.group_name && <span className="block text-xs text-[#4A5A70]">{r.group_name}</span>}
                      </td>
                      <td className="text-right">{r.students.toLocaleString("en-NG")}</td>
                      <td>{parentsPct(r)}%</td>
                      <td>{ago(r.last_active, now)}</td>
                      <td>
                        <Pill kind={PILL[h.kind]}>{h.label}</Pill>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Scroll>
        </Box>
        <Box id="sys-h" title="Services">
          <ul className="flex flex-col">
            {services.map((s) => (
              <li key={s.n} className="flex items-center justify-between gap-2.5 border-t border-[#EEF3F9] py-2 first:border-t-0">
                <span>
                  <span className="block font-bold text-[#173B70]">{s.n}</span>
                  <span className="block text-[13px] text-[#4A5A70]">{s.d}</span>
                </span>
                <Pill kind={s.ok ? "good" : "warn"}>{s.ok ? "Working" : "Check"}</Pill>
              </li>
            ))}
          </ul>
          <Link href="/status" className="s-link text-sm">
            Full setup check
          </Link>
        </Box>
      </div>
    </SuperShell>
  );
}
