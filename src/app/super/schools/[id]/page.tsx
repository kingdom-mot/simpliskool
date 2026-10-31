import Link from "next/link";
import { notFound } from "next/navigation";
import { Flash } from "@/components/Flash";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Box, LinkTabs, money, Stat, SuperShell } from "@/components/super";
import { Pill } from "@/components/ui";
import { lagosTime, requirePlatform } from "@/lib/platform";
import { lagosMidnight, longDay, nameMatches, nowMs, parentsPct, schoolRows } from "@/lib/platform-data";
import { FEATURES, featureOnFor, getSettings, PLAN_LABEL, type FeatureKey, type PlanKey } from "@/lib/platform-settings";
import { changeOwnerSignin, saveSchoolPlan, startViewing, suspendSchool, unsuspendSchool } from "../../actions";

export const metadata = { title: "School — Simpliskool back office" };

const DAY = 86_400_000;
const dayLabel = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", weekday: "short", day: "numeric", month: "short" }).format(new Date(iso));
const lagosDate = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date(iso));

export default async function SuperSchool(props: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const ctx = await requirePlatform("schools");
  const now = nowMs();
  const r = (await schoolRows(ctx.admin)).find((x) => x.id === id);
  if (!r) notFound();
  const tab = ["pay", "plan", "acc"].includes(sp.tab ?? "") ? sp.tab! : "use";
  const a = ctx.admin;
  const since = (days: number) => new Date(now - days * DAY).toISOString();
  const today = lagosMidnight();

  const [{ data: school }, { data: acct }, { data: term }, { data: staffRoles }, { data: team }, settings] = await Promise.all([
    a.from("schools").select("features, check_note, cac_number, suspended_reason, payments_approved_at, payments_approved_by").eq("id", id).single<{ features: Partial<Record<FeatureKey, boolean>> | null; check_note: string | null; cac_number: string | null; suspended_reason: string | null; payments_approved_at: string | null; payments_approved_by: string | null }>(),
    a.from("school_accounts").select("team_note, account_manager, signed_up_by, billing_talk, real_check, real_checked_at").eq("school_id", id).maybeSingle<{ team_note: string | null; account_manager: string | null; signed_up_by: string | null; billing_talk: string; real_check: string | null; real_checked_at: string | null }>(),
    a.from("terms").select("id, starts_on").eq("school_id", id).eq("is_current", true).maybeSingle<{ id: string; starts_on: string | null }>(),
    a.from("memberships").select("role, profiles(full_name, phone, email)").eq("school_id", id).in("role", ["owner", "principal", "bursar"]).returns<{ role: string; profiles: { full_name: string | null; phone: string | null; email: string | null } | null }[]>(),
    a.from("platform_team").select("user_id, profiles!platform_team_user_id_fkey(full_name)").returns<{ user_id: string; profiles: { full_name: string | null } | null }[]>(),
    getSettings(),
  ]);
  const teamName = new Map((team ?? []).map((t) => [t.user_id, t.profiles?.full_name ?? "Team member"]));
  const termStart = term?.starts_on ? new Date(`${term.starts_on}T00:00:00+01:00`).toISOString() : since(100);

  let body: React.ReactNode = null;
  if (tab === "use") {
    const c = (q: PromiseLike<{ count: number | null }>) => Promise.resolve(q).then((x) => x.count ?? 0);
    const [marked7, markedToday, scores, onlineTerm, onlineSum, notesAll, notesOnTime, clockToday, clock7, cbt, hw, hwTeachers, payroll, classes] = await Promise.all([
      c(a.from("attendance").select("id", { count: "exact", head: true }).eq("school_id", id).gte("date", lagosDate(since(7)))),
      a.from("attendance").select("class_id").eq("school_id", id).eq("date", lagosDate(today)).limit(5000).returns<{ class_id: string | null }[]>().then((x) => new Set((x.data ?? []).map((y) => y.class_id)).size),
      term ? c(a.from("scores").select("id", { count: "exact", head: true }).eq("school_id", id).eq("term_id", term.id)) : Promise.resolve(0),
      c(a.from("payments").select("id", { count: "exact", head: true }).eq("school_id", id).eq("method", "paystack").eq("status", "success").gte("created_at", termStart)),
      a.from("payments").select("amount_kobo").eq("school_id", id).eq("method", "paystack").eq("status", "success").gte("created_at", termStart).limit(20000).returns<{ amount_kobo: number }[]>().then((x) => (x.data ?? []).reduce((s, p) => s + Number(p.amount_kobo), 0)),
      term ? c(a.from("lesson_notes").select("id", { count: "exact", head: true }).eq("school_id", id).eq("term_id", term.id).neq("status", "draft")) : Promise.resolve(0),
      term ? c(a.from("lesson_notes").select("id", { count: "exact", head: true }).eq("school_id", id).eq("term_id", term.id).eq("status", "approved")) : Promise.resolve(0),
      c(a.from("staff_attendance").select("id", { count: "exact", head: true }).eq("school_id", id).eq("date", lagosDate(today))),
      c(a.from("staff_attendance").select("id", { count: "exact", head: true }).eq("school_id", id).gte("date", lagosDate(since(7)))),
      c(a.from("cbt_tests").select("id", { count: "exact", head: true }).eq("school_id", id).gte("created_at", termStart)),
      c(a.from("homework").select("id", { count: "exact", head: true }).eq("school_id", id).gte("created_at", since(30))),
      a.from("homework").select("teacher_id").eq("school_id", id).gte("created_at", since(30)).limit(2000).returns<{ teacher_id: string }[]>().then((x) => new Set((x.data ?? []).map((y) => y.teacher_id)).size),
      c(a.from("payroll_runs").select("id", { count: "exact", head: true }).eq("school_id", id)),
      c(a.from("classes").select("id", { count: "exact", head: true }).eq("school_id", id)),
    ]);
    const usage = (n: number, daily = false) => (n === 0 ? { s: "Not used", k: "info" as const } : daily ? { s: "Daily", k: "good" as const } : { s: "In use", k: "good" as const });
    const feats = [
      { n: "Attendance", d: markedToday ? `Marked in ${markedToday} of ${classes} classes today` : `${marked7.toLocaleString("en-NG")} marks in the last 7 days`, ...(markedToday ? usage(1, true) : marked7 ? { s: "Some use", k: "warn" as const } : usage(0)) },
      { n: "Scores and report cards", d: `${scores.toLocaleString("en-NG")} scores entered this term`, ...usage(scores) },
      { n: "Online fee payments", d: `${onlineTerm.toLocaleString("en-NG")} payments this term`, ...usage(onlineTerm) },
      { n: "Lesson notes", d: notesAll ? `${notesAll} submitted this term · ${Math.round((notesOnTime / notesAll) * 100)}% approved` : "None this term", ...usage(notesAll) },
      { n: "Staff clock-in", d: clockToday ? `${clockToday} clocked in today` : `${clock7} clock-ins in the last 7 days`, ...(clockToday ? usage(1, true) : clock7 ? { s: "Some use", k: "warn" as const } : usage(0)) },
      { n: "CBT tests", d: `${cbt} test${cbt === 1 ? "" : "s"} this term`, ...(cbt >= 3 ? usage(1) : cbt ? { s: "Some use", k: "warn" as const } : usage(0)) },
      { n: "Homework", d: hw ? `${hw} in the last 30 days from ${hwTeachers} teacher${hwTeachers === 1 ? "" : "s"}` : "None in the last 30 days", ...(hwTeachers >= 5 ? usage(1) : hw ? { s: "Some use", k: "warn" as const } : usage(0)) },
      { n: "Payroll", d: payroll ? `${payroll} payroll run${payroll === 1 ? "" : "s"}` : "Not set up", ...usage(payroll) },
    ];
    const person = (role: string) => (staffRoles ?? []).filter((m) => m.role === role).map((m) => `${m.profiles?.full_name ?? "No name"}${m.profiles?.phone ? ` · ${m.profiles.phone}` : m.profiles?.email ? ` · ${m.profiles.email}` : ""}`);
    body = (
      <>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Students" value={r.students.toLocaleString("en-NG")} />
          <Stat label="Staff" value={r.staff.toLocaleString("en-NG")} />
          <Stat label="Parents joined" value={`${parentsPct(r)}%`} sub={`${r.families_joined.toLocaleString("en-NG")} of ${r.students.toLocaleString("en-NG")} students have a parent account`} />
          <Stat label="Fees paid online" value={money(onlineSum)} sub="this term" />
        </div>
        <Box id="ft-h" title="What they use">
          <ul className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]">
            {feats.map((f) => (
              <li key={f.n} className="flex items-center justify-between gap-2 rounded-xl bg-[#F5F8FC] px-3.5 py-3">
                <span>
                  <span className="block font-bold text-[#173B70]">{f.n}</span>
                  <span className="block text-[13px] text-[#4A5A70]">{f.d}</span>
                </span>
                <Pill kind={f.k}>{f.s}</Pill>
              </li>
            ))}
          </ul>
        </Box>
        <Box id="ct-h" title="Contacts">
          <dl className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(240px,1fr))]">
            {[
              ["Owner", person("owner").join("; ") || "—"],
              ["Principal", person("principal").join("; ") || "Not added"],
              ["Bursar", person("bursar").join("; ") || "Not added"],
              ["Signed up by", acct?.signed_up_by ? (teamName.get(acct.signed_up_by) ?? "Team member") : "The school itself"],
              ["Looked after by", acct?.account_manager ? (teamName.get(acct.account_manager) ?? "Team member") : "No one yet"],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-[13px] font-bold text-[#4A5A70]">{k}</dt>
                <dd className="mt-0.5 font-bold text-[#263449]">{v}</dd>
              </div>
            ))}
          </dl>
        </Box>
      </>
    );
  } else if (tab === "pay") {
    const [{ data: pays }, { data: refunds }] = await Promise.all([
      a.from("payments").select("amount_kobo, created_at").eq("school_id", id).eq("method", "paystack").eq("status", "success").gte("created_at", since(14)).returns<{ amount_kobo: number; created_at: string }[]>(),
      a.from("refund_requests").select("id, amount_kobo, reason, status, created_at").eq("school_id", id).order("created_at", { ascending: false }).limit(5).returns<{ id: string; amount_kobo: number; reason: string; status: string; created_at: string }[]>(),
    ]);
    const byDay = new Map<string, { n: number; v: number; iso: string }>();
    for (const p of pays ?? []) {
      const k = lagosDate(p.created_at);
      const e = byDay.get(k) ?? { n: 0, v: 0, iso: p.created_at };
      byDay.set(k, { n: e.n + 1, v: e.v + Number(p.amount_kobo), iso: e.iso });
    }
    const days = [...byDay.entries()].sort((x, y) => y[0].localeCompare(x[0]));
    const match = nameMatches(r.name, r.payout_name);
    body = (
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 xl:grid-cols-2">
        <Box id="pa-h" title="Payout account">
          {r.payout_account ? (
            <dl className="grid grid-cols-2 gap-3">
              <div>
                <dt className="text-[13px] font-bold text-[#4A5A70]">Bank</dt>
                <dd className="font-bold">
                  {r.payout_bank} ••{r.payout_account.slice(-4)}
                </dd>
              </div>
              <div>
                <dt className="text-[13px] font-bold text-[#4A5A70]">Name on account</dt>
                <dd className={`font-bold ${match === false ? "text-[#912018]" : "text-[#0B6B5A]"}`}>
                  {match === false ? "! " : "✓ "}
                  {r.payout_name}
                  {r.payout_verified ? "" : " (not confirmed by the bank)"}
                </dd>
              </div>
              <div>
                <dt className="text-[13px] font-bold text-[#4A5A70]">Paystack subaccount</dt>
                <dd className="font-mono text-[13px]">{r.subaccount ?? "Not created"}</dd>
              </div>
              <div>
                <dt className="text-[13px] font-bold text-[#4A5A70]">Online payments</dt>
                <dd className="font-bold">{r.payments_approved_at ? `On since ${longDay(r.payments_approved_at)}${school?.payments_approved_by ? ` · checked by ${teamName.get(school.payments_approved_by) ?? "the team"}` : ""}` : "Paused until checked"}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-[#4A5A70]">No payout account yet. The owner adds it in Settings.</p>
          )}
          <p className="text-sm text-[#4A5A70]">If the school changes this account, online payments pause until someone here checks the new account name.</p>
          {!r.payments_approved_at && ctx.can("approve") && (
            <Link href={`/super/checks?sel=${id}`} className="s-btn self-start">
              Check this school
            </Link>
          )}
        </Box>
        <Box id="ph-h" title="Paid online, last 14 days">
          {days.length ? (
            <ul>
              {days.map(([k, d]) => (
                <li key={k} className="flex justify-between gap-3 border-t border-[#EEF3F9] py-2.5 first:border-t-0">
                  <span>{dayLabel(d.iso)}</span>
                  <span className="text-[13px] text-[#4A5A70]">
                    {d.n} payment{d.n === 1 ? "" : "s"}
                  </span>
                  <strong>{money(d.v)}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[#4A5A70]">No online payments in the last 14 days.</p>
          )}
          <p className="text-sm text-[#4A5A70]">Paystack pays these into the school&apos;s account, usually the next working day. Exact payouts are under Payments and payouts.</p>
          {!!refunds?.length && (
            <>
              <h3 className="mt-2 font-bold text-c1">Refund requests</h3>
              <ul>
                {refunds.map((x) => (
                  <li key={x.id} className="flex justify-between gap-3 border-t border-[#EEF3F9] py-2 text-sm">
                    <span>
                      {money(Number(x.amount_kobo))} · {x.reason}
                    </span>
                    <Pill kind={x.status === "refunded" ? "good" : x.status === "declined" ? "info" : "warn"}>{x.status === "asked" ? "Waiting" : x.status === "refunded" ? "Refunded" : "Declined"}</Pill>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Box>
      </div>
    );
  } else if (tab === "plan") {
    const edit = ctx.can("school.edit");
    const shown = FEATURES.filter((f) => f.key !== "grp" || r.group_id);
    body = (
      <Box id="pl-h" title="Plan" className="max-w-[760px]">
        <ActionForm action={saveSchoolPlan} className="flex flex-col gap-3.5">
          <input type="hidden" name="school_id" value={id} />
          <fieldset disabled={!edit} className="flex flex-col gap-3.5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="pp">
                  Plan
                </label>
                <select id="pp" name="plan" className="sk-input" defaultValue={r.plan}>
                  {(["pilot", "single", "group"] as const).map((k) => (
                    <option key={k} value={k}>
                      {PLAN_LABEL[k]}
                      {k === "pilot" ? " (free)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="pe">
                  Pilot ends
                </label>
                <input id="pe" name="pilot_ends" type="date" className="sk-input" defaultValue={r.pilot_ends ?? settings.pilot_ends ?? ""} />
              </div>
            </div>
            <fieldset>
              <legend className="label">Features for this school</legend>
              <p className="mb-1.5 text-[13px] text-[#4A5A70]">Ticked follows the platform switch unless you change it here.</p>
              <div className="flex flex-wrap gap-x-5 gap-y-1">
                {shown.map((f) => (
                  <label key={f.key} className="flex min-h-[44px] items-center gap-2 text-sm font-semibold">
                    <input type="hidden" name={`shown_${f.key}`} value="1" />
                    <input type="checkbox" name={`f_${f.key}`} defaultChecked={featureOnFor(settings, school?.features, f.key)} className="h-5 w-5" />
                    {f.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <div>
              <label className="label" htmlFor="am">
                Looked after by
              </label>
              <select id="am" name="account_manager" className="sk-input" defaultValue={acct?.account_manager ?? ""}>
                <option value="">No one yet</option>
                {(team ?? []).map((t) => (
                  <option key={t.user_id} value={t.user_id}>
                    {t.profiles?.full_name ?? "Team member"}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="pn">
                Note for the team (the school never sees it)
              </label>
              <textarea id="pn" name="team_note" rows={3} className="sk-input" maxLength={1000} defaultValue={acct?.team_note ?? ""} />
            </div>
          </fieldset>
          {edit ? <SubmitButton>Save plan</SubmitButton> : <p className="text-sm text-[#4A5A70]">Your role can view this but not change it.</p>}
        </ActionForm>
      </Box>
    );
  } else {
    const { data: log } = await a.from("platform_audit").select("id, created_at, actor_name, action, detail").eq("school_id", id).order("created_at", { ascending: false }).limit(10).returns<{ id: number; created_at: string; actor_name: string | null; action: string; detail: string | null }[]>();
    body = (
      <>
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-3">
          <Box id="vw-h" title="View as this school">
            <p className="text-sm text-[#4A5A70]">See exactly what the owner sees, to help them. Read only: nothing can be changed. Every visit is in the audit log and the owner is emailed.</p>
            {ctx.can("view") && r.status === "active" ? (
              <ActionForm action={startViewing} className="flex flex-col gap-3">
                <input type="hidden" name="school_id" value={id} />
                <div>
                  <label className="label" htmlFor="vr">
                    Why are you viewing? (required)
                  </label>
                  <select id="vr" name="reason" className="sk-input">
                    <option>Helping with a support request</option>
                    <option>Checking a payment problem</option>
                    <option>Training the school</option>
                    <option>Checking the school is set up properly</option>
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="vt">
                    Support request number (optional)
                  </label>
                  <input id="vt" name="ticket" className="sk-input" maxLength={20} placeholder="#1042" />
                </div>
                <SubmitButton pending="Opening…">Start viewing ({settings.view_minutes === 60 ? 60 : 30} minutes)</SubmitButton>
              </ActionForm>
            ) : (
              <p className="text-sm font-semibold text-[#4A5A70]">{r.status !== "active" ? "Switch the school back on first." : "Your role can't view schools."}</p>
            )}
          </Box>
          <Box id="ow-h" title="Owner can't sign in">
            <p className="text-sm text-[#4A5A70]">Change the owner&apos;s sign-in phone or email after checking who they are by phone call. Old and new addresses are emailed.</p>
            {ctx.can("school.owner") ? (
              <ActionForm action={changeOwnerSignin} className="flex flex-col gap-3">
                <input type="hidden" name="school_id" value={id} />
                <div>
                  <label className="label" htmlFor="oc">
                    New email or phone
                  </label>
                  <input id="oc" name="contact" className="sk-input" required maxLength={120} />
                </div>
                <div>
                  <label className="label" htmlFor="oh">
                    How did you check it&apos;s them?
                  </label>
                  <input id="oh" name="how" className="sk-input" required maxLength={300} placeholder="Called the old number on file" />
                </div>
                <SubmitButton className="s-btn2">Change owner&apos;s sign-in</SubmitButton>
              </ActionForm>
            ) : (
              <p className="text-sm font-semibold text-[#4A5A70]">Ask support or a super admin.</p>
            )}
          </Box>
          <section aria-labelledby="sus-h" className="flex flex-col gap-3 rounded-[18px] border border-[#F3C7C3] bg-white p-[22px]">
            <h2 id="sus-h" className="text-lg !text-[#912018]">
              {r.status === "suspended" ? "School suspended" : "Suspend school"}
            </h2>
            {r.status === "suspended" ? (
              <>
                <p className="text-sm text-[#4A5A70]">Since {longDay(r.suspended_at)}. Reason: {school?.suspended_reason ?? "—"}</p>
                {ctx.can("school.suspend") && (
                  <form action={unsuspendSchool}>
                    <input type="hidden" name="school_id" value={id} />
                    <button className="s-btn">Switch the school back on</button>
                  </form>
                )}
              </>
            ) : (
              <>
                <p className="text-sm text-[#4A5A70]">Staff, parents and students can&apos;t sign in. Nothing is deleted. Parents can still pay outstanding fees.</p>
                {ctx.can("school.suspend") ? (
                  <ActionForm action={suspendSchool} className="flex flex-col gap-3">
                    <input type="hidden" name="school_id" value={id} />
                    <div>
                      <label className="label" htmlFor="sr">
                        Reason
                      </label>
                      <input id="sr" name="reason" className="sk-input" required maxLength={300} />
                    </div>
                    <div>
                      <label className="label" htmlFor="sc">
                        Type SUSPEND to confirm
                      </label>
                      <input id="sc" name="confirm" className="sk-input" required autoComplete="off" />
                    </div>
                    <SubmitButton className="s-btn-danger" pending="Suspending…">
                      Suspend school
                    </SubmitButton>
                  </ActionForm>
                ) : (
                  <p className="text-sm font-semibold text-[#4A5A70]">Only super admins can suspend a school.</p>
                )}
              </>
            )}
          </section>
        </div>
        <Box id="lg-h" title="Recent team actions for this school">
          {log?.length ? (
            <ul>
              {log.map((l) => (
                <li key={l.id} className="flex flex-wrap gap-x-3 border-t border-[#EEF3F9] py-2 text-sm first:border-t-0">
                  <span className="text-[#4A5A70]">{lagosTime(l.created_at)}</span>
                  <strong className="text-c1">{l.actor_name}</strong>
                  <span>{l.action}</span>
                  {l.detail && <span className="text-[#4A5A70]">· {l.detail}</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[#4A5A70]">Nothing yet.</p>
          )}
        </Box>
      </>
    );
  }

  const status = r.status === "suspended" ? { l: "Suspended", k: "bad" as const } : r.payments_approved_at ? { l: `Live · ${PLAN_LABEL[r.plan as PlanKey] ?? r.plan}`, k: "good" as const } : { l: `Not checked yet · ${PLAN_LABEL[r.plan as PlanKey] ?? r.plan}`, k: "warn" as const };
  return (
    <SuperShell
      ctx={ctx}
      active="schools"
      title={r.name}
      sub={
        <>
          <Link href="/super/schools" className="font-bold text-white underline">
            ← All schools
          </Link>{" "}
          · {[r.group_name, r.address, `${r.slug}.simpliskool.com`, `signed up ${longDay(r.created_at)}`].filter(Boolean).join(" · ")}
        </>
      }
      actions={<Pill kind={status.k}>{status.l}</Pill>}
    >
      <Flash />
      <LinkTabs
        label="School detail"
        current={tab}
        tabs={[
          ["use", "Usage", `/super/schools/${id}`],
          ["pay", "Payouts", `/super/schools/${id}?tab=pay`],
          ["plan", "Plan", `/super/schools/${id}?tab=plan`],
          ["acc", "Access and safety", `/super/schools/${id}?tab=acc`],
        ]}
      />
      {body}
    </SuperShell>
  );
}
