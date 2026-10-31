import Link from "next/link";
import { Flash } from "@/components/Flash";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Box, LinkTabs, SuperShell } from "@/components/super";
import { Empty, Pill } from "@/components/ui";
import { ago, lagosTime, requirePlatform } from "@/lib/platform";
import { nowMs } from "@/lib/platform-data";
import { assignTicket, reopenTicket, teamReply } from "../actions";

export const metadata = { title: "Support inbox — Simpliskool back office" };

type Ticket = { id: number; school_id: string; subject: string; priority: string; status: string; assigned_to: string | null; last_from: string; created_at: string; updated_at: string; schools: { name: string } | null; profiles: { full_name: string | null } | null };
const PRI = { urgent: { l: "Urgent", k: "bad" }, normal: { l: "Normal", k: "info" }, low: { l: "Low", k: "good" } } as const;

export default async function SuperSupport(props: { searchParams: Promise<{ show?: string; t?: string }> }) {
  const sp = await props.searchParams;
  const ctx = await requirePlatform("support");
  const now = nowMs();
  const show = sp.show === "mine" || sp.show === "closed" ? sp.show : "open";
  let q = ctx.admin.from("support_tickets").select("id, school_id, subject, priority, status, assigned_to, last_from, created_at, updated_at, schools(name), profiles!support_tickets_opened_by_fkey(full_name)");
  q = show === "closed" ? q.eq("status", "closed") : q.eq("status", "open");
  if (show === "mine") q = q.eq("assigned_to", ctx.user.id);
  const [{ data: list }, { data: team }, { count: openCount }] = await Promise.all([
    q.order("updated_at", { ascending: false }).limit(100).returns<Ticket[]>(),
    ctx.admin.from("platform_team").select("user_id, profiles!platform_team_user_id_fkey(full_name)").returns<{ user_id: string; profiles: { full_name: string | null } | null }[]>(),
    ctx.admin.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "open"),
  ]);
  const tickets = [...(list ?? [])].sort((a, b) => (show === "closed" ? 0 : (a.priority === "urgent" ? 0 : 1) - (b.priority === "urgent" ? 0 : 1)) || Date.parse(b.updated_at) - Date.parse(a.updated_at));
  const who = new Map((team ?? []).map((t) => [t.user_id, t.profiles?.full_name ?? "Team member"]));
  let cur = tickets.find((t) => String(t.id) === sp.t);
  if (!cur && sp.t && /^\d+$/.test(sp.t)) {
    const { data } = await ctx.admin.from("support_tickets").select("id, school_id, subject, priority, status, assigned_to, last_from, created_at, updated_at, schools(name), profiles!support_tickets_opened_by_fkey(full_name)").eq("id", Number(sp.t)).maybeSingle<Ticket>();
    cur = data ?? undefined;
  }
  cur ??= tickets[0];
  const { data: msgs } = cur
    ? await ctx.admin.from("support_messages").select("id, author_name, from_team, internal, body, created_at").eq("ticket_id", cur.id).order("created_at").returns<{ id: string; author_name: string | null; from_team: boolean; internal: boolean; body: string; created_at: string }[]>()
    : { data: [] };
  const full = ctx.can("support");
  const href = (o: Record<string, string>) => `/super/support?${new URLSearchParams({ show, ...o })}`;

  return (
    <SuperShell ctx={ctx} active="support" title="Support inbox" sub={`${openCount ?? 0} open · reply within 4 working hours`}>
      <Flash />
      <LinkTabs
        label="Show"
        current={show}
        tabs={[
          ["open", "Open", "/super/support"],
          ["mine", "Assigned to me", "/super/support?show=mine"],
          ["closed", "Closed", "/super/support?show=closed"],
        ]}
      />
      {!cur ? (
        <Empty>{show === "closed" ? "No closed requests yet." : "No open requests. Schools ask for help from Get help in their portal."}</Empty>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
          <nav aria-label="Requests">
            <ul className="flex flex-col gap-2">
              {tickets.map((t) => {
                const on = t.id === cur!.id;
                return (
                  <li key={t.id}>
                    <Link href={href({ t: String(t.id) })} aria-current={on ? "page" : undefined} className={`flex flex-col gap-1 rounded-[14px] bg-white px-3.5 py-3 ${on ? "border-2 border-[#0B7D6E]" : "border border-[#E3EAF3]"}`}>
                      <span className="flex w-full justify-between gap-2">
                        <span className="text-sm font-extrabold text-[#173B70]">{t.schools?.name}</span>
                        <Pill kind={PRI[t.priority as keyof typeof PRI]?.k ?? "info"}>{PRI[t.priority as keyof typeof PRI]?.l ?? t.priority}</Pill>
                      </span>
                      <span className="text-sm text-[#263449]">{t.subject}</span>
                      <span className="text-xs text-[#4A5A70]">
                        #{t.id} · {ago(t.updated_at, now)} · {t.assigned_to ? who.get(t.assigned_to) : "Not assigned"}
                        {t.status === "open" && t.last_from === "school" ? " · waiting for us" : ""}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <Box
            id="th-h"
            className="order-first lg:order-none"
            title={cur.subject}
            actions={
              <Link href={`/super/schools/${cur.school_id}`} className="s-btn2 !min-h-[40px]">
                Open school
              </Link>
            }
          >
            <p className="-mt-2 text-sm text-[#4A5A70]">
              #{cur.id} · {cur.schools?.name} · {cur.profiles?.full_name ?? "School staff"} · opened {lagosTime(cur.created_at)}
              {cur.status === "closed" ? " · closed" : ""}
            </p>
            {full && (
              <ActionForm action={assignTicket} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="ticket_id" value={cur.id} />
                <div>
                  <label className="label" htmlFor="asg">
                    Assigned to
                  </label>
                  <select id="asg" name="assigned_to" className="sk-input !min-h-[40px] !w-auto" defaultValue={cur.assigned_to ?? ""}>
                    <option value="">No one</option>
                    {(team ?? []).map((t) => (
                      <option key={t.user_id} value={t.user_id}>
                        {t.profiles?.full_name ?? "Team member"}
                      </option>
                    ))}
                  </select>
                </div>
                <SubmitButton className="s-btn2 !min-h-[40px]" pending="Saving…">
                  Assign
                </SubmitButton>
              </ActionForm>
            )}
            <ol className="flex flex-col gap-2.5">
              {(msgs ?? []).map((m) => (
                <li key={m.id} className={`max-w-[85%] rounded-[14px] px-3.5 py-3 ${m.internal ? "self-end bg-[#FFF6E3]" : m.from_team ? "self-end bg-[#E7F6F2]" : "self-start bg-[#F5F8FC]"}`}>
                  <span className="block text-xs font-extrabold text-[#4A5A70]">
                    {m.author_name ?? (m.from_team ? "Simpliskool" : "School")}
                    {m.internal ? " (internal note)" : ""} · {lagosTime(m.created_at)}
                  </span>
                  <span className="mt-1 block whitespace-pre-wrap text-[15px] leading-relaxed">{m.body}</span>
                </li>
              ))}
            </ol>
            {cur.status === "closed" && full ? (
              <form action={reopenTicket}>
                <input type="hidden" name="ticket_id" value={cur.id} />
                <button className="s-btn2">Reopen request</button>
              </form>
            ) : (
              <ActionForm action={teamReply} resetOnSuccess className="flex flex-col gap-3">
                <input type="hidden" name="ticket_id" value={cur.id} />
                <div>
                  <label className="label" htmlFor="rp">
                    Reply
                  </label>
                  <textarea id="rp" name="body" rows={4} className="sk-input" maxLength={4000} placeholder="They'll get it by email and in the app" />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  {full ? (
                    <label className="flex min-h-[44px] items-center gap-2 text-sm font-semibold">
                      <input type="checkbox" name="internal" className="h-5 w-5" />
                      Internal note (the school won&apos;t see it)
                    </label>
                  ) : (
                    <span />
                  )}
                  <div className="flex flex-wrap gap-2.5">
                    {full && (
                      <button name="close" value="1" className="s-btn2">
                        Reply and close
                      </button>
                    )}
                    <SubmitButton pending="Sending…">Send reply</SubmitButton>
                  </div>
                </div>
              </ActionForm>
            )}
          </Box>
        </div>
      )}
    </SuperShell>
  );
}
