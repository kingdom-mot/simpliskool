import Link from "next/link";
import { Flash } from "@/components/Flash";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Box, SuperShell } from "@/components/super";
import { Empty, Pill } from "@/components/ui";
import { requirePlatform } from "@/lib/platform";
import { longDay, nameMatches, schoolRows, shortDay, type SchoolRow } from "@/lib/platform-data";
import { decideCheck, recordCheck } from "../actions";

export const metadata = { title: "New school checks — Simpliskool back office" };

type Check = { l: string; d: string; state: "ok" | "bad" | "wait" };
const ICON = { ok: { i: "✓", bg: "#0B7D6E", t: "passed" }, bad: { i: "!", bg: "#B42318", t: "needs attention" }, wait: { i: "…", bg: "#5C6B80", t: "not done yet" } };

export default async function SuperChecks(props: { searchParams: Promise<{ sel?: string }> }) {
  const sp = await props.searchParams;
  const ctx = await requirePlatform("approvals");
  const rows = await schoolRows(ctx.admin);
  const waiting = rows
    .filter((r) => r.status === "active" && !r.payments_approved_at)
    .sort((a, b) => (a.check_status === "asked" ? 1 : 0) - (b.check_status === "asked" ? 1 : 0) || Date.parse(a.created_at) - Date.parse(b.created_at));
  const recent = rows
    .filter((r) => r.payments_approved_at)
    .sort((a, b) => Date.parse(b.payments_approved_at!) - Date.parse(a.payments_approved_at!))
    .slice(0, 5);
  const ids = waiting.map((r) => r.id);
  const [{ data: accts }, { data: extra }, { data: team }] = await Promise.all([
    ids.length ? ctx.admin.from("school_accounts").select("school_id, real_check, real_checked_by, real_checked_at").in("school_id", ids).returns<{ school_id: string; real_check: string | null; real_checked_by: string | null; real_checked_at: string | null }[]>() : Promise.resolve({ data: [] }),
    ids.length ? ctx.admin.from("schools").select("id, cac_number, check_note").in("id", ids).returns<{ id: string; cac_number: string | null; check_note: string | null }[]>() : Promise.resolve({ data: [] }),
    ctx.admin.from("platform_team").select("user_id, profiles!platform_team_user_id_fkey(full_name)").returns<{ user_id: string; profiles: { full_name: string | null } | null }[]>(),
  ]);
  const who = new Map((team ?? []).map((t) => [t.user_id, t.profiles?.full_name ?? "Team member"]));
  const acct = new Map((accts ?? []).map((a) => [a.school_id, a]));
  const ext = new Map((extra ?? []).map((e) => [e.id, e]));

  const checksFor = (r: SchoolRow): Check[] => {
    const a = acct.get(r.id);
    const e = ext.get(r.id);
    const contact = r.owner_phone ?? r.owner_email;
    const match = nameMatches(r.name, r.payout_name);
    return [
      contact ? { l: `Owner ${r.owner_phone ? "phone" : "email"} confirmed`, d: r.last_active ? `${contact} · signed in with a code` : `${contact} · hasn't signed in yet`, state: r.last_active ? "ok" : "wait" } : { l: "Owner contact", d: "No owner yet", state: "bad" },
      { l: "Web address", d: `${r.slug}.simpliskool.com`, state: "ok" },
      !r.payout_account
        ? { l: "Bank account name", d: "No bank account added yet", state: "wait" }
        : !r.subaccount
          ? { l: "Bank account name", d: `${r.payout_bank} ••${r.payout_account.slice(-4)} · Paystack couldn't set up payouts to this account`, state: "bad" }
          : match === false
            ? { l: "Bank account name", d: `Account name is ${r.payout_name}, not the school`, state: "bad" }
            : { l: "Bank account name", d: `✓ ${r.payout_name} · ${r.payout_bank} ••${r.payout_account.slice(-4)}${r.payout_verified ? "" : " · name not confirmed by the bank"}`, state: r.payout_verified ? "ok" : "wait" },
      a?.real_check ? { l: "School looks real", d: `${a.real_check} · ${a.real_checked_by ? who.get(a.real_checked_by) : "team"} · ${shortDay(a.real_checked_at)}`, state: "ok" } : { l: "School looks real", d: "Not called or visited yet", state: "wait" },
      e?.cac_number ? { l: "CAC number", d: e.cac_number, state: "ok" } : { l: "CAC number", d: "Optional · not given", state: "wait" },
    ];
  };
  const status = (r: SchoolRow) => {
    if (r.check_status === "asked") return { l: "Waiting on school", k: "info" as const };
    const c = checksFor(r);
    if (c.some((x) => x.state === "bad")) return { l: "Problem", k: "bad" as const };
    if (!r.subaccount || c.slice(0, 4).some((x) => x.state === "wait")) return { l: "Incomplete", k: "warn" as const };
    return { l: "Ready", k: "good" as const };
  };
  const cur = waiting.find((r) => r.id === sp.sel) ?? waiting[0];
  const checks = cur ? checksFor(cur) : [];
  const mismatch = cur && cur.payout_name && nameMatches(cur.name, cur.payout_name) === false;

  return (
    <SuperShell ctx={ctx} active="approvals" title="New school checks" sub="Before a school can take payments online, check it's real and its bank account belongs to the school.">
      <Flash />
      {!cur ? (
        <Empty>No schools are waiting. Every school with a payout account has been checked.</Empty>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)]">
          <nav aria-label="Schools waiting">
            <ul className="flex flex-col gap-2.5">
              {waiting.map((r) => {
                const s = status(r);
                const on = r.id === cur.id;
                return (
                  <li key={r.id}>
                    <Link href={`/super/checks?sel=${r.id}`} aria-current={on ? "page" : undefined} className={`flex min-h-16 flex-col gap-1.5 rounded-2xl bg-white px-4 py-3.5 ${on ? "border-2 border-[#0B7D6E]" : "border border-[#E3EAF3]"}`}>
                      <span className="flex w-full justify-between gap-2">
                        <span className="text-[15px] font-extrabold text-[#173B70]">{r.name}</span>
                        <Pill kind={s.k}>{s.l}</Pill>
                      </span>
                      <span className="text-[13px] text-[#4A5A70]">
                        {r.address ?? r.slug} · signed up {shortDay(r.created_at)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <Box id="ck-h" className="order-first lg:order-none" title={cur.name} actions={<Link href={`/super/schools/${cur.id}`} className="s-link text-sm">Open school</Link>}>
            <ul className="flex flex-col">
              {checks.map((c) => (
                <li key={c.l} className="flex items-start gap-3 border-t border-[#EEF3F9] py-3 first:border-t-0">
                  <span aria-hidden="true" className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full text-sm font-black text-white" style={{ background: ICON[c.state].bg }}>
                    {ICON[c.state].i}
                  </span>
                  <span className="flex-1">
                    <span className="block font-bold text-[#173B70]">
                      {c.l}
                      <span className="sr-only">: {ICON[c.state].t}</span>
                    </span>
                    <span className="block text-sm text-[#4A5A70]">{c.d}</span>
                  </span>
                </li>
              ))}
            </ul>
            {mismatch && (
              <div role="note" className="rounded-xl bg-[#FEF3F2] px-3.5 py-3 text-sm font-semibold text-[#7A1A1A]">
                The bank account isn&apos;t in the school&apos;s name. Ask for a school account, or approve with a note if the owner runs the school as a sole proprietor.
              </div>
            )}
            {cur.check_status === "asked" && ext.get(cur.id)?.check_note && (
              <div role="note" className="rounded-xl bg-[#EEF3F9] px-3.5 py-3 text-sm text-[#173B70]">
                <strong>Asked the school:</strong> {ext.get(cur.id)?.check_note}
              </div>
            )}
            {ctx.can("approve") ? (
              <>
                <details className="rounded-xl border border-[#E3EAF3] px-3.5 py-2">
                  <summary className="flex min-h-[40px] cursor-pointer items-center font-bold text-c1">Record a call, visit or CAC number</summary>
                  <ActionForm action={recordCheck} className="mt-2 flex flex-col gap-3 pb-2">
                    <input type="hidden" name="school_id" value={cur.id} />
                    <div>
                      <label className="label" htmlFor="rc-how">
                        How did you check the school is real?
                      </label>
                      <input id="rc-how" name="how" className="sk-input" maxLength={200} placeholder="Called the owner · visited the school" />
                    </div>
                    <div>
                      <label className="label" htmlFor="rc-cac">
                        CAC number (optional)
                      </label>
                      <input id="rc-cac" name="cac" className="sk-input" maxLength={30} placeholder="RC 1487220" />
                    </div>
                    <SubmitButton className="s-btn2 self-start">Save check</SubmitButton>
                  </ActionForm>
                </details>
                <ActionForm action={decideCheck} className="flex flex-col gap-3">
                  <input type="hidden" name="school_id" value={cur.id} />
                  <div>
                    <label className="label" htmlFor="ck-note">
                      Note (the school sees this if you ask for changes)
                    </label>
                    <textarea id="ck-note" name="note" rows={3} className="sk-input" maxLength={500} />
                  </div>
                  <div className="flex flex-wrap justify-end gap-2.5">
                    <button name="do" value="ask" className="s-btn2">
                      Ask the school to fix
                    </button>
                    <button name="do" value="approve" className="s-btn">
                      Approve and turn on payments
                    </button>
                  </div>
                </ActionForm>
              </>
            ) : (
              <p className="text-sm font-semibold text-[#4A5A70]">Your role can see checks but not approve them.</p>
            )}
            <p className="text-sm text-[#4A5A70]">Approving turns on online payments. Parents&apos; payments are split by Paystack and paid into this bank account.</p>
          </Box>
        </div>
      )}
      {!!recent.length && (
        <Box id="rc-h" title="Recently approved">
          <ul>
            {recent.map((r) => (
              <li key={r.id} className="flex flex-wrap justify-between gap-2 border-t border-[#EEF3F9] py-2 text-sm first:border-t-0">
                <Link href={`/super/schools/${r.id}`} className="font-bold text-c1 hover:underline">
                  {r.name}
                </Link>
                <span className="text-[#4A5A70]">{longDay(r.payments_approved_at)}</span>
              </li>
            ))}
          </ul>
        </Box>
      )}
    </SuperShell>
  );
}
