import { Flash } from "@/components/Flash";
import { ActionForm, SubmitButton } from "@/components/forms";
import { LinkTabs, Scroll, Stat, SuperShell } from "@/components/super";
import { Empty, Pill } from "@/components/ui";
import { requirePlatform } from "@/lib/platform";
import { demoSchoolIds, notDemo, nowMs, schoolRows, shortDay } from "@/lib/platform-data";
import { smsReady } from "@/lib/sms";
import { addSmsCredit, decideSender } from "../actions";

export const metadata = { title: "SMS and email — Simpliskool back office" };

const monthStart = () => {
  const d = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date());
  return new Date(`${d.slice(0, 8)}01T00:00:00+01:00`).toISOString();
};
const SENDER = { asked: { l: "Waiting for us", k: "warn" }, sent: { l: "With the SMS provider", k: "info" }, live: { l: "Live", k: "good" }, rejected: { l: "Rejected", k: "bad" } } as const;

export default async function SuperMessaging(props: { searchParams: Promise<{ tab?: string }> }) {
  const sp = await props.searchParams;
  const ctx = await requirePlatform("messaging");
  const now = nowMs();
  const tab = sp.tab === "sn" ? "sn" : "cr";
  const from = monthStart();
  const days30 = new Date(now - 30 * 86_400_000).toISOString();
  const demo = await demoSchoolIds(ctx.admin);
  const [rows, { data: notes }, { data: anns }, { data: recent }, { data: senders }] = await Promise.all([
    schoolRows(ctx.admin),
    notDemo(ctx.admin.from("notifications").select("school_id, channel, status"), demo).gte("created_at", from).limit(100000).returns<{ school_id: string; channel: string; status: string }[]>(),
    notDemo(ctx.admin.from("announcements").select("school_id, sms_sent, emailed"), demo).gte("created_at", from).limit(20000).returns<{ school_id: string; sms_sent: number | null; emailed: number | null }[]>(),
    notDemo(ctx.admin.from("notifications").select("school_id"), demo).eq("channel", "sms").eq("status", "sent").gte("created_at", days30).limit(100000).returns<{ school_id: string }[]>(),
    notDemo(ctx.admin.from("schools").select("id, name, sender_id, sender_status, sender_note, sender_asked_at"), demo, "id").neq("sender_status", "none").order("sender_asked_at", { ascending: false }).returns<{ id: string; name: string; sender_id: string | null; sender_status: keyof typeof SENDER; sender_note: string | null; sender_asked_at: string | null }[]>(),
  ]);
  const smsSent = (notes ?? []).filter((n) => n.channel === "sms" && n.status === "sent").length + (anns ?? []).reduce((a, x) => a + Number(x.sms_sent ?? 0), 0);
  const smsFailed = (notes ?? []).filter((n) => n.channel === "sms" && n.status === "failed").length;
  const emails = (notes ?? []).filter((n) => n.channel === "email" && n.status === "sent").length + (anns ?? []).reduce((a, x) => a + Number(x.emailed ?? 0), 0);
  const emailFailed = (notes ?? []).filter((n) => n.channel === "email" && n.status === "failed").length;
  const usedBy = new Map<string, number>();
  for (const n of notes ?? []) if (n.channel === "sms" && n.status === "sent") usedBy.set(n.school_id, (usedBy.get(n.school_id) ?? 0) + 1);
  for (const x of anns ?? []) usedBy.set(x.school_id, (usedBy.get(x.school_id) ?? 0) + Number(x.sms_sent ?? 0));
  const per30 = new Map<string, number>();
  for (const n of recent ?? []) per30.set(n.school_id, (per30.get(n.school_id) ?? 0) + 1);
  const waiting = (senders ?? []).filter((s) => s.sender_status === "asked").length;
  const runsOut = (credit: number, id: string) => {
    if (credit <= 0) return { l: "No credit", k: "bad" as const };
    const daily = (per30.get(id) ?? 0) / 30;
    if (!daily) return { l: "Not texting yet", k: "info" as const };
    const d = credit / daily;
    return d < 7 ? { l: "This week", k: "bad" as const } : d < 30 ? { l: `About ${Math.round(d / 7)} weeks`, k: "warn" as const } : d < 365 ? { l: `About ${Math.round(d / 30)} months`, k: "good" as const } : { l: "Over a year", k: "good" as const };
  };
  const list = rows.filter((r) => r.status === "active").sort((a, b) => a.sms_credit - b.sms_credit);

  return (
    <SuperShell ctx={ctx} active="messaging" title="SMS and email" sub="Sign-in codes are free to schools. Texts to parents use each school's SMS credit.">
      <Flash />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="SMS sent this month" value={smsSent.toLocaleString("en-NG")} sub={smsReady() ? "texts to parents (sign-in codes are counted by the provider)" : "TERMII_API_KEY isn't set: no texts are sent"} />
        <Stat label="SMS delivered" value={smsSent + smsFailed ? `${Math.round((smsSent / (smsSent + smsFailed)) * 1000) / 10}%` : "—"} sub={`${smsFailed} failed this month`} tone={smsFailed > smsSent / 10 ? "bad" : "plain"} />
        <Stat label="Emails sent this month" value={emails.toLocaleString("en-NG")} sub={`${emailFailed} failed`} />
        <Stat label="Sender names to approve" value={String(waiting)} />
      </div>
      <LinkTabs
        label="Messaging view"
        current={tab}
        tabs={[
          ["cr", "SMS credit by school", "/super/messaging"],
          ["sn", `Sender names${waiting ? ` (${waiting})` : ""}`, "/super/messaging?tab=sn"],
        ]}
      />
      {tab === "cr" ? (
        <Scroll label="SMS credit by school">
          <table className="tbl min-w-[860px]">
            <caption className="sr-only">SMS credit by school</caption>
            <thead>
              <tr>
                <th scope="col">School</th>
                <th scope="col" className="!text-right">
                  Credit left
                </th>
                <th scope="col" className="!text-right">
                  Used this month
                </th>
                <th scope="col">Runs out in</th>
                <th scope="col">{ctx.can("sms") ? "Add credit" : <span className="sr-only">Actions</span>}</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => {
                const ro = runsOut(r.sms_credit, r.id);
                return (
                  <tr key={r.id}>
                    <th scope="row" className="text-left font-bold">
                      {r.name}
                    </th>
                    <td className="text-right">{r.sms_credit.toLocaleString("en-NG")}</td>
                    <td className="text-right">{(usedBy.get(r.id) ?? 0).toLocaleString("en-NG")}</td>
                    <td>
                      <Pill kind={ro.k}>{ro.l}</Pill>
                    </td>
                    <td>
                      {ctx.can("sms") && (
                        <ActionForm action={addSmsCredit} className="flex flex-wrap items-center gap-2">
                          <input type="hidden" name="school_id" value={r.id} />
                          <label className="sr-only" htmlFor={`cr-${r.id}`}>
                            SMS to add for {r.name}
                          </label>
                          <input id={`cr-${r.id}`} name="credit" type="number" step="1" className="sk-input !min-h-[40px] !w-24" placeholder="1000" required />
                          <label className="sr-only" htmlFor={`cn-${r.id}`}>
                            Payment reference for {r.name}
                          </label>
                          <input id={`cn-${r.id}`} name="note" className="sk-input !min-h-[40px] !w-40" placeholder="Payment reference" required maxLength={200} />
                          <SubmitButton className="s-btn2 !min-h-[40px] !px-3" pending="Adding…">
                            Add<span className="sr-only"> credit for {r.name}</span>
                          </SubmitButton>
                        </ActionForm>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Scroll>
      ) : (
        <div className="flex flex-col gap-2.5">
          <p className="text-sm text-[#4A5A70]">A sender name is what parents see instead of &ldquo;Simpliskool&rdquo;, up to 11 letters. Owners ask for one in Settings. The SMS provider and the networks must approve each one, which usually takes a few days.</p>
          {(senders ?? []).length ? (
            <ul aria-label="Sender names" className="flex flex-col gap-2.5">
            {(senders ?? []).map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3.5 rounded-[18px] border border-[#E3EAF3] bg-white px-5 py-4">
                <span className="rounded-[10px] bg-[#EEF3F9] px-3 py-2 font-mono text-base font-extrabold text-[#173B70]">{s.sender_id}</span>
                <span className="min-w-[200px] flex-1">
                  <span className="block font-bold text-[#173B70]">{s.name}</span>
                  <span className="block text-[13px] text-[#4A5A70]">
                    Asked {shortDay(s.sender_asked_at)}
                    {s.sender_note ? ` · ${s.sender_note}` : ""}
                  </span>
                </span>
                <Pill kind={SENDER[s.sender_status]?.k ?? "info"}>{SENDER[s.sender_status]?.l ?? s.sender_status}</Pill>
                {ctx.can("sender") && (s.sender_status === "asked" || s.sender_status === "sent") && (
                  <div className="flex flex-wrap items-end gap-2">
                    <ActionForm action={decideSender} className="flex flex-wrap items-end gap-2">
                      <input type="hidden" name="school_id" value={s.id} />
                      <div>
                        <label className="label" htmlFor={`rj-${s.id}`}>
                          Reason, if rejecting
                        </label>
                        <input id={`rj-${s.id}`} name="note" className="sk-input !min-h-[40px]" maxLength={200} />
                      </div>
                      <button name="step" value="reject" className="s-btn2 !min-h-[40px]">
                        Reject<span className="sr-only"> {s.sender_id}</span>
                      </button>
                      {s.sender_status === "asked" ? (
                        <button name="step" value="send" className="s-btn !min-h-[40px]">
                          Send to provider<span className="sr-only"> {s.sender_id}</span>
                        </button>
                      ) : (
                        <button name="step" value="live" className="s-btn !min-h-[40px]">
                          Approved: mark live<span className="sr-only"> {s.sender_id}</span>
                        </button>
                      )}
                    </ActionForm>
                  </div>
                )}
              </li>
            ))}
            </ul>
          ) : (
            <Empty>No school has asked for a sender name yet.</Empty>
          )}
        </div>
      )}
    </SuperShell>
  );
}
