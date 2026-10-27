import Link from "next/link";
import { PortalShell } from "@/components/PortalShell";
import { Bar, Card, Empty, ICONS, Icon, Pill, SCHOOL_GRADIENT, StatCard, TONES, TONE_CYCLE } from "@/components/ui";
import { ROLE_LABEL, type Role } from "@/lib/auth";
import type { ShellSchool } from "@/components/PortalShell";
import { dayTile, firstName, greeting, longDate, naira, pct, shortDay, TERM_NAME, when } from "@/lib/format";
import { adminNav } from "@/lib/nav";

export type AdminData = {
  today: string;
  term: { term_no: number; session: string; week: number | null } | null;
  students: number;
  new_students: number;
  classes: number;
  classes_marked: number;
  unmarked_classes: string[];
  present: number;
  marked: number;
  week: { date: string; present: number; marked: number }[];
  fees: { total: number; paid: number; owing: number; owing_half: number };
  fee_by_class: { name: string; total: number; paid: number }[];
  subject_classes: number;
  subject_classes_scored: number;
  new_applications: number;
  setup: { session: boolean; classes: boolean; subjects: boolean; fees: boolean; staff: boolean; students: boolean };
  payments: { name: string; class: string; method: string; amount: number; at: string }[];
  announcements: { title: string; audience: string; at: string }[];
};

const METHOD: Record<string, string> = { paystack: "Online", transfer: "Transfer", cash: "Cash", pos: "POS" };

export function AdminView({ school, role, fullName, d }: { school: ShellSchool & { slug: string }; role: Role; fullName: string; d: AdminData | null }) {
  const membership = { role };
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "simpliskool.com";
  const today = d?.today ?? new Date().toISOString().slice(0, 10);

  const setup = [
    { label: "Set the current session and term", done: !!d?.setup.session },
    { label: "Create classes and arms", done: !!d?.setup.classes },
    { label: "Add subjects", done: !!d?.setup.subjects },
    { label: "Set this term's fees", done: !!d?.setup.fees },
    { label: "Invite teachers and bursar", done: !!d?.setup.staff },
    { label: "Add students and parents", done: !!d?.setup.students },
  ];
  const doneCount = setup.filter((s) => s.done).length;
  const next = setup.filter((s) => !s.done).slice(0, 2).map((s) => s.label.toLowerCase());
  const isFinance = ["owner", "admin", "bursar"].includes(membership.role);

  const termLine = d?.term ? `${d.term.session} ${TERM_NAME[d.term.term_no]}${d.term.week ? ` · Week ${d.term.week}` : ""}` : "No current term set";
  const presentPct = pct(d?.present ?? 0, d?.students ?? 0);
  const feePct = pct(d?.fees.paid ?? 0, d?.fees.total ?? 0);
  const scorePct = pct(d?.subject_classes_scored ?? 0, d?.subject_classes ?? 0);

  const tasks: { tag: string; kind: "warn" | "info" | "bad"; text: string }[] = [];
  if (d?.new_applications) tasks.push({ tag: "Admissions", kind: "info", text: `${d.new_applications} new application${d.new_applications === 1 ? "" : "s"} from your website` });
  if (d?.unmarked_classes.length) tasks.push({ tag: "Attendance", kind: "warn", text: `${d.unmarked_classes.length} class${d.unmarked_classes.length === 1 ? " has" : "es have"} not taken today's register` });
  if (isFinance && d?.fees.owing_half) tasks.push({ tag: "Fees", kind: "bad", text: `${d.fees.owing_half} student${d.fees.owing_half === 1 ? " owes" : "s owe"} more than half their fees` });
  if (d && d.subject_classes > d.subject_classes_scored && d.term) tasks.push({ tag: "Results", kind: "warn", text: `${d.subject_classes - d.subject_classes_scored} subject class${d.subject_classes - d.subject_classes_scored === 1 ? " has" : "es have"} no scores yet` });

  return (
    <PortalShell school={school} roleLabel={ROLE_LABEL[membership.role]} fullName={fullName} groups={adminNav(membership.role)} active="dashboard">
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm text-[#4A5A70]">
              {longDate(today)} · {termLine}
            </p>
            <h1 className="mt-1 text-[30px] leading-tight !text-c1">
              {greeting()}, {firstName(fullName)}
            </h1>
          </div>
          <a className="text-sm font-bold text-c2 underline underline-offset-2" href={`https://${school.slug}.${rootDomain}`}>
            Your school website
          </a>
        </div>

        {doneCount < setup.length && (
          <section aria-labelledby="setup-h" className="flex flex-wrap items-center justify-between gap-4 rounded-[20px] px-[22px] py-5 text-white" style={{ background: SCHOOL_GRADIENT }}>
            <div className="flex min-w-[260px] flex-1 flex-col gap-2">
              <h2 id="setup-h" className="text-lg !text-white">
                Finish setting up your school · {doneCount} of {setup.length} done
              </h2>
              <Bar value={pct(doneCount, setup.length)} fill="#FFFFFF" track="rgba(255,255,255,0.25)" label="Setup progress" />
              <p className="text-sm text-white">Next: {next.join(", then ")}.</p>
            </div>
          </section>
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard tone="teal" icon={ICONS.users} label="Students enrolled" value={String(d?.students ?? 0)} sub={d?.new_students ? `${d.new_students} new this term` : "Active students"} />
          <StatCard
            tone="blue"
            icon={ICONS.check}
            label="Present today"
            value={d?.marked ? `${presentPct}%` : "—"}
            percent={d?.marked ? presentPct : 0}
            sub={d?.marked ? `${d.present} of ${d.students} marked present` : "No registers taken yet today"}
          />
          {isFinance ? (
            <StatCard
              tone="amber"
              icon={ICONS.cash}
              label="Fees collected"
              value={naira(d?.fees.paid, true)}
              percent={feePct}
              sub={d?.fees.total ? `${feePct}% of ${naira(d.fees.total, true)} invoiced` : "No fees invoiced this term"}
            />
          ) : (
            <StatCard tone="amber" icon={ICONS.book} label="Classes" value={String(d?.classes ?? 0)} sub={`${d?.classes_marked ?? 0} registers taken today`} />
          )}
          <StatCard
            tone="purple"
            icon={ICONS.chart}
            label="Scores entered"
            value={d?.subject_classes ? `${scorePct}%` : "—"}
            percent={scorePct}
            sub={d?.subject_classes ? `${d.subject_classes_scored} of ${d.subject_classes} subject classes started` : "No subjects assigned yet"}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          {isFinance ? (
            <Card labelledBy="fee-h" className="flex flex-col gap-3.5">
              <h2 id="fee-h" className="text-lg !text-c1">
                Fee collection by class
              </h2>
              {d?.fee_by_class.length ? (
                <ul className="flex flex-col gap-3">
                  {d.fee_by_class.map((f, i) => {
                    const p = pct(f.paid, f.total);
                    return (
                      <li key={f.name} className="grid grid-cols-[72px_minmax(0,1fr)_48px] items-center gap-3 text-sm">
                        <span className="font-bold text-c1">{f.name}</span>
                        <Bar value={p} fill={TONES[TONE_CYCLE[i % TONE_CYCLE.length]].bar} height={12} label={`${f.name} fees paid`} />
                        <span className="text-right font-bold">{p}%</span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <Empty>Fee collection shows here once this term&apos;s invoices are sent.</Empty>
              )}
            </Card>
          ) : (
            <Card labelledBy="ann-h" className="flex flex-col gap-3">
              <h2 id="ann-h" className="text-lg !text-c1">
                Latest announcements
              </h2>
              {d?.announcements.length ? (
                d.announcements.map((a) => (
                  <div key={a.at + a.title} className="border-b border-[#EEF3F9] pb-2.5">
                    <div className="font-bold text-c1">{a.title}</div>
                    <div className="text-[13px] text-[#4A5A70]">{when(a.at, today)}</div>
                  </div>
                ))
              ) : (
                <Empty>No announcements yet.</Empty>
              )}
            </Card>
          )}

          <Card labelledBy="att-h" className="flex flex-col gap-3.5">
            <h2 id="att-h" className="text-lg !text-c1">
              Attendance this week
            </h2>
            <ol className="flex h-[160px] items-end gap-3" aria-label="Share of students present each day">
              {(d?.week ?? []).map((w, i) => {
                const p = pct(w.present, w.marked);
                const friday = i === 4;
                return (
                  <li key={w.date} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                    <span className="text-xs font-extrabold text-c1">{w.marked ? `${p}%` : "—"}</span>
                    <span
                      aria-hidden="true"
                      className="block w-full rounded-t-lg rounded-b-[3px]"
                      style={{
                        height: w.marked ? `${Math.max(8, p * 0.9)}%` : "6px",
                        background: !w.marked ? "#E3EAF3" : friday ? "linear-gradient(180deg,#FDE68A 0%,#F59E0B 55%,#EA580C 100%)" : "linear-gradient(180deg,#5EEAD4 0%,#2EC4B6 35%,#3B82F6 100%)",
                      }}
                    />
                    <span className="text-xs text-[#4A5A70]">
                      {shortDay(w.date)}
                      <span className="sr-only">: {w.marked ? `${p}% present` : "no registers"}</span>
                    </span>
                  </li>
                );
              })}
            </ol>
            {d?.unmarked_classes.length ? (
              <p className="text-[13px] text-[#4A5A70]">
                {d.unmarked_classes.length} class{d.unmarked_classes.length === 1 ? " has" : "es have"} not taken today&apos;s register: {d.unmarked_classes.slice(0, 4).join(", ")}
                {d.unmarked_classes.length > 4 ? "…" : "."}
              </p>
            ) : null}
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card labelledBy="todo-h" className="flex flex-col gap-3">
            <h2 id="todo-h" className="text-lg !text-c1">
              Needs your attention
            </h2>
            {tasks.length ? (
              tasks.map((t) => (
                <div key={t.tag} className="flex items-center gap-3 rounded-[14px] bg-brand-cloud p-3">
                  <Pill kind={t.kind}>{t.tag}</Pill>
                  <span className="flex-1 text-sm font-bold text-c1">{t.text}</span>
                </div>
              ))
            ) : (
              <Empty>Nothing needs you right now.</Empty>
            )}
          </Card>

          {isFinance ? (
            <Card labelledBy="pay-h" className="flex flex-col gap-1.5">
              <h2 id="pay-h" className="mb-1 text-lg !text-c1">
                Recent payments
              </h2>
              {d?.payments.length ? (
                d.payments.map((p) => (
                  <div key={p.at + p.name} className="flex justify-between gap-2.5 border-b border-[#EEF3F9] py-2.5">
                    <div>
                      <div className="text-sm font-bold text-c1">{p.name}</div>
                      <div className="text-[13px] text-[#4A5A70]">
                        {[p.class, METHOD[p.method] ?? p.method, when(p.at, today)].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                    <div className="text-sm font-extrabold text-[#0B6B5A]">{naira(p.amount)}</div>
                  </div>
                ))
              ) : (
                <Empty>Payments appear here as parents pay.</Empty>
              )}
            </Card>
          ) : (
            <Card labelledBy="set-h" className="flex flex-col gap-2.5">
              <h2 id="set-h" className="text-lg !text-c1">
                School setup
              </h2>
              <SetupList items={setup} />
            </Card>
          )}

          <Card labelledBy="cal-h" className="flex flex-col gap-2.5">
            <h2 id="cal-h" className="text-lg !text-c1">
              {isFinance ? "Latest announcements" : "Coming up"}
            </h2>
            {d?.announcements.length ? (
              d.announcements.map((a, i) => {
                const t = TONES[(["teal", "blue", "amber", "purple"] as const)[i % 4]];
                const tile = dayTile(a.at);
                return (
                  <div key={a.at + a.title} className="flex items-center gap-3">
                    <span className="w-[52px] flex-none rounded-xl py-1.5 text-center" style={{ background: t.tint, color: t.fg }}>
                      <span className="block text-[11px] font-extrabold">{tile.m}</span>
                      <span className="block font-heading text-xl font-black">{tile.d}</span>
                    </span>
                    <span className="text-sm font-semibold">{a.title}</span>
                  </div>
                );
              })
            ) : (
              <Empty>Announcements you send will show here.</Empty>
            )}
          </Card>
        </div>

        {isFinance && doneCount < setup.length && (
          <Card labelledBy="set2-h" className="flex flex-col gap-2.5">
            <h2 id="set2-h" className="text-lg !text-c1">
              School setup · {doneCount} of {setup.length} done
            </h2>
            <SetupList items={setup} />
          </Card>
        )}

        <p className="text-sm text-[#4A5A70]">
          More admin pages are being built: students, attendance, results and fees will open from the menu as each one goes live.{" "}
          <Link href="/help" className="font-bold text-c2 underline underline-offset-2">
            Get help
          </Link>
        </p>
      </div>
    </PortalShell>
  );
}

function SetupList({ items }: { items: { label: string; done: boolean }[] }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((s) => (
        <li key={s.label} className="flex items-center gap-2.5 text-[15px]">
          {s.done ? (
            <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-c2 text-white">
              <Icon d="M20 6 9 17l-5-5" size={14} width={3.2} />
            </span>
          ) : (
            <span className="h-5 w-5 flex-none rounded-full border-2 border-[#C9D6EA]" />
          )}
          <span className={s.done ? "text-[#4A5A70] line-through" : ""}>
            {s.label}
            <span className="sr-only">{s.done ? " (done)" : " (to do)"}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
