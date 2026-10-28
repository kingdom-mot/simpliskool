import { GroupShell } from "@/components/GroupShell";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Empty } from "@/components/ui";
import { emailReady } from "@/lib/email";
import { requireGroup } from "@/lib/group";
import { smsReady } from "@/lib/sms";
import { sendGroupAnnouncement } from "../actions";

export const metadata = { title: "Group announcements" };

type A = { id: string; school_id: string; title: string; audience: string; created_at: string; reach: number; announcement_reads: { user_id: string }[] };
const AUD: Record<string, string> = { school: "everyone", parents: "parents", staff: "staff" };
const chip = "flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border-[1.5px] border-[#DCE5F0] px-3 text-sm font-bold text-brand-slate has-[:checked]:border-c2 has-[:checked]:bg-[#F3FBF9] has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-c2";

export default async function GroupAnnouncements() {
  const ctx = await requireGroup("announcements");
  const { data: team } = await ctx.admin.from("group_members").select("user_id").eq("group_id", ctx.group.id).returns<{ user_id: string }[]>();
  const { data } = ctx.ids.length
    ? await ctx.admin.from("announcements").select("id, school_id, title, audience, created_at, reach, announcement_reads(user_id)").in("school_id", ctx.ids).in("created_by", (team ?? []).map((t) => t.user_id)).order("created_at", { ascending: false }).limit(60).returns<A[]>()
    : { data: [] as A[] };
  // One line per message sent to several branches at once.
  const sent = new Map<string, A[]>();
  for (const a of data ?? []) {
    const k = `${a.title}|${a.created_at.slice(0, 16)}`;
    sent.set(k, [...(sent.get(k) ?? []), a]);
  }
  const name = new Map(ctx.branches.map((b) => [b.id, b.name]));
  const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Africa/Lagos" });

  return (
    <GroupShell ctx={ctx} active="announcements" title="Announcements" sub="Send one message to every branch, or just some. It goes out under each branch's name.">
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 xl:grid-cols-[1.3fr_1fr]">
        <section aria-labelledby="new-h" className="flex flex-col gap-3 rounded-[18px] border border-t-[5px] border-[#E3EAF3] border-t-c1 bg-white p-[22px]">
          <h2 id="new-h" className="text-lg !text-c1">
            New announcement
          </h2>
          <ActionForm action={sendGroupAnnouncement} resetOnSuccess className="flex flex-col gap-3">
            <fieldset className="flex flex-wrap gap-2">
              <legend className="label">Branches</legend>
              {ctx.branches.map((b) => (
                <label key={b.id} className={chip}>
                  <input type="checkbox" name="branch" value={b.id} defaultChecked className="h-4 w-4" /> {b.name}
                </label>
              ))}
            </fieldset>
            <fieldset className="flex flex-wrap gap-2">
              <legend className="label">Who gets it</legend>
              {Object.entries({ parents: "Parents", staff: "Staff", school: "Everyone" }).map(([k, l]) => (
                <label key={k} className={chip}>
                  <input type="radio" name="audience" value={k} defaultChecked={k === "parents"} className="h-4 w-4" /> {l}
                </label>
              ))}
            </fieldset>
            <div>
              <label className="label" htmlFor="ga-title">
                Title
              </label>
              <input id="ga-title" name="title" required minLength={3} maxLength={120} className="sk-input" />
            </div>
            <div>
              <label className="label" htmlFor="ga-body">
                Message
              </label>
              <textarea id="ga-body" name="body" required rows={5} maxLength={3000} className="sk-input min-h-[130px] py-3" />
            </div>
            <fieldset className="flex flex-col gap-1">
              <legend className="label">Send by</legend>
              <label className="flex min-h-[44px] items-center gap-2 text-sm font-semibold text-brand-slate">
                <input type="checkbox" checked disabled className="h-5 w-5" /> In the app (always)
              </label>
              <label className="flex min-h-[44px] items-center gap-2 text-sm font-semibold text-brand-slate">
                <input type="checkbox" name="email" value="1" disabled={!emailReady()} defaultChecked={emailReady()} className="h-5 w-5" /> Email
              </label>
              <label className="flex min-h-[44px] items-center gap-2 text-sm font-semibold text-brand-slate">
                <input type="checkbox" name="sms" value="1" disabled={!smsReady()} className="h-5 w-5" /> SMS (only branches with SMS switched on; texts count against each branch)
              </label>
            </fieldset>
            <div>
              <SubmitButton pending="Sending…">Send</SubmitButton>
            </div>
          </ActionForm>
        </section>
        <section aria-labelledby="past-h" className="flex flex-col gap-3 rounded-[18px] border border-[#E3EAF3] bg-white p-[22px]">
          <h2 id="past-h" className="text-lg !text-c1">
            Sent from the group
          </h2>
          {sent.size ? (
            <ul className="flex flex-col gap-2">
              {[...sent.values()].map((list) => (
                <li key={list[0].id} className="rounded-xl border border-[#E3EAF3] p-3 text-sm">
                  <span className="block font-bold text-brand-slate">{list[0].title}</span>
                  <span className="block text-xs text-[#4A5A70]">
                    {day(list[0].created_at)} · {list.length === ctx.branches.length ? "all branches" : list.map((a) => name.get(a.school_id)).join(", ")} · {AUD[list[0].audience]}
                  </span>
                  <span className="block text-xs text-brand-slate">Read: {list.map((a) => `${name.get(a.school_id)?.split(" ")[0]} ${a.reach ? Math.round((a.announcement_reads.length / a.reach) * 100) : 0}%`).join(" · ")}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Nothing sent from the group yet.</Empty>
          )}
        </section>
      </div>
    </GroupShell>
  );
}
