import Link from "next/link";
import { AdminPage, Panel, requireAdminPage } from "@/components/admin";
import { Flash } from "@/components/Flash";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Empty, Pill } from "@/components/ui";
import { openTicket, replyToTeam } from "./actions";

export const metadata = { title: "Get help — Simpliskool" };

type T = { id: number; subject: string; status: string; priority: string; last_from: string; created_at: string; updated_at: string };
const when = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(iso));

export default async function HelpPage(props: { searchParams: Promise<{ t?: string }> }) {
  const sp = await props.searchParams;
  const ctx = await requireAdminPage(["owner", "admin", "principal", "bursar"]);
  const { data: tickets, error } = await ctx.supabase.from("support_tickets").select("id, subject, status, priority, last_from, created_at, updated_at").eq("school_id", ctx.school.id).order("updated_at", { ascending: false }).limit(50).returns<T[]>();
  const cur = (tickets ?? []).find((t) => String(t.id) === sp.t);
  const { data: msgs } = cur
    ? await ctx.supabase.from("support_messages").select("id, author_name, from_team, body, created_at").eq("ticket_id", cur.id).order("created_at").returns<{ id: string; author_name: string | null; from_team: boolean; body: string; created_at: string }[]>()
    : { data: [] };

  return (
    <AdminPage ctx={ctx} active="help" crumb={[{ label: "Get help" }]} title="Get help">
      <Flash />
      {error ? (
        <Empty>Help requests aren&apos;t switched on yet. Email support@simpliskool.com and we&apos;ll get back to you.</Empty>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
          <div className="flex flex-col gap-5">
            <Panel id="new-h" title="Ask the Simpliskool team">
              <ActionForm action={openTicket} className="flex flex-col gap-3">
                <div>
                  <label className="label" htmlFor="hp-sub">
                    What do you need help with?
                  </label>
                  <input id="hp-sub" name="subject" className="sk-input" required minLength={3} maxLength={140} placeholder="Report cards show the wrong position" />
                </div>
                <div>
                  <label className="label" htmlFor="hp-body">
                    Tell us more
                  </label>
                  <textarea id="hp-body" name="body" rows={5} className="sk-input" required minLength={5} maxLength={4000} placeholder="Which class, which student, what you expected to see" />
                </div>
                <label className="flex min-h-[44px] items-center gap-2 text-sm font-semibold">
                  <input type="checkbox" name="urgent" className="h-5 w-5" />
                  It&apos;s urgent (parents or payments are affected)
                </label>
                <SubmitButton className="s-btn self-start" pending="Sending…">
                  Send request
                </SubmitButton>
              </ActionForm>
              <p className="text-sm text-[#4A5A70]">We usually reply within 4 working hours. You&apos;ll get the reply by email and here.</p>
            </Panel>
            <Panel id="my-h" title="Your requests">
              {tickets?.length ? (
                <ul className="flex flex-col gap-2">
                  {tickets.map((t) => (
                    <li key={t.id}>
                      <Link href={`/admin/help?t=${t.id}`} aria-current={cur?.id === t.id ? "page" : undefined} className={`flex flex-col gap-1 rounded-xl px-3.5 py-3 ${cur?.id === t.id ? "border-2 border-c2 bg-white" : "border border-[#E3EAF3] bg-white"}`}>
                        <span className="flex justify-between gap-2">
                          <span className="font-bold text-c1">{t.subject}</span>
                          <Pill kind={t.status === "closed" ? "info" : t.last_from === "team" ? "good" : "warn"}>{t.status === "closed" ? "Done" : t.last_from === "team" ? "Replied" : "Waiting for Simpliskool"}</Pill>
                        </span>
                        <span className="text-xs text-[#4A5A70]">
                          #{t.id} · {when(t.updated_at)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty>No requests yet.</Empty>
              )}
            </Panel>
          </div>
          {cur && (
            <Panel id="th-h" title={`#${cur.id}: ${cur.subject}`}>
              <ol className="flex flex-col gap-2.5">
                {(msgs ?? []).map((m) => (
                  <li key={m.id} className={`max-w-[85%] rounded-[14px] px-3.5 py-3 ${m.from_team ? "self-start bg-[#E7F6F2]" : "self-end bg-[#F5F8FC]"}`}>
                    <span className="block text-xs font-extrabold text-[#4A5A70]">
                      {m.from_team ? `${m.author_name ?? "Simpliskool"} (Simpliskool)` : (m.author_name ?? "You")} · {when(m.created_at)}
                    </span>
                    <span className="mt-1 block whitespace-pre-wrap text-[15px] leading-relaxed">{m.body}</span>
                  </li>
                ))}
              </ol>
              <ActionForm action={replyToTeam} className="flex flex-col gap-3">
                <input type="hidden" name="ticket_id" value={cur.id} />
                <div>
                  <label className="label" htmlFor="hp-reply">
                    {cur.status === "closed" ? "Reply to reopen this request" : "Reply"}
                  </label>
                  <textarea id="hp-reply" name="body" rows={3} className="sk-input" required maxLength={4000} />
                </div>
                <SubmitButton className="s-btn self-start" pending="Sending…">
                  Send reply
                </SubmitButton>
              </ActionForm>
            </Panel>
          )}
        </div>
      )}
    </AdminPage>
  );
}
