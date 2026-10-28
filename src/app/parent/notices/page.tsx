import Link from "next/link";
import { MobileShell } from "@/components/MobileShell";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Empty, Pill } from "@/components/ui";
import { releaseDueSoon } from "@/lib/announce";
import { requireSchool } from "@/lib/auth";
import { PARENT_TABS } from "@/lib/nav";
import { rsvp } from "./actions";

export const metadata = { title: "School notices" };

type Notice = { id: string; title: string; body: string; kind: string; event_at: string | null; created_at: string };
const TZ = "Africa/Lagos";

export default async function ParentNotices(props: { searchParams: Promise<{ tab?: string }> }) {
  const sp = await props.searchParams;
  const tab = sp.tab === "calendar" ? "calendar" : "notices";
  const { supabase, school, user } = await requireSchool(["parent"]);
  await releaseDueSoon();
  const [{ data }, { data: mine }, { data: s }] = await Promise.all([
    supabase.from("announcements").select("id, title, body, kind, event_at, created_at").eq("school_id", school.id).order("created_at", { ascending: false }).limit(50).returns<Notice[]>(),
    supabase.from("announcement_rsvps").select("announcement_id, going").eq("user_id", user.id).returns<{ announcement_id: string; going: boolean }[]>(),
    supabase.from("schools").select("phone, email").eq("id", school.id).maybeSingle<{ phone: string | null; email: string | null }>(),
  ]);
  const notices = data ?? [];
  // Opening the list counts as reading these notices.
  if (notices.length) await supabase.rpc("mark_announcements_read", { p_ids: notices.map((n) => n.id) });
  const answer = new Map((mine ?? []).map((r) => [r.announcement_id, r.going]));
  const now = new Date().toISOString();
  const events = notices.filter((n) => n.kind === "event" && n.event_at && Date.parse(n.event_at) >= Date.parse(now)).sort((a, b) => a.event_at!.localeCompare(b.event_at!));
  const ago = (iso: string) => {
    const d = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(iso));
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
    const y = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(new Date().getTime() - 864e5));
    return d === today ? "Today" : d === y ? "Yesterday" : new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: TZ });
  };
  const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit", hour12: true, timeZone: TZ });

  return (
    <MobileShell school={school} title="School" tabs={PARENT_TABS} active="school">
      <div className="grid grid-cols-2 gap-2">
        <Link href="/parent/contact" className="flex min-h-[48px] items-center justify-center rounded-[14px] border-[1.5px] border-[#DCE5F0] bg-white text-sm font-bold text-c1">
          Contact the school
        </Link>
        <Link href="/parent/attendance" className="flex min-h-[48px] items-center justify-center rounded-[14px] border-[1.5px] border-[#DCE5F0] bg-white text-sm font-bold text-c1">
          Attendance
        </Link>
      </div>
      <div className="flex flex-wrap gap-2">
        {s?.phone && (
          <a className="s-btn2" href={`tel:${s.phone.replace(/\s/g, "")}`}>
            Call the school
          </a>
        )}
        {s?.email && (
          <a className="s-btn2" href={`mailto:${s.email}`}>
            Email the school
          </a>
        )}
      </div>
      <nav aria-label="School" className="grid grid-cols-2 gap-1.5 rounded-xl bg-white p-1">
        {[
          ["notices", "Notices"],
          ["calendar", "Calendar"],
        ].map(([k, l]) => (
          <Link key={k} href={`/parent/notices?tab=${k}`} aria-current={tab === k ? "page" : undefined} className={`flex min-h-[44px] items-center justify-center rounded-lg text-sm font-bold ${tab === k ? "bg-c1 text-white" : "text-brand-slate"}`}>
            {l}
          </Link>
        ))}
      </nav>
      {tab === "notices" ? (
        notices.length ? (
          <ul className="flex flex-col gap-3">
            {notices.map((n) => (
              <li key={n.id} className="flex flex-col gap-2 rounded-[18px] border border-[#E3EAF3] bg-white p-[18px]">
                <div className="flex items-center justify-between gap-2">
                  <Pill kind={n.kind === "event" ? "warn" : "info"}>{n.kind === "event" ? "Event" : "Notice"}</Pill>
                  <span className="text-xs text-[#4A5A70]">{ago(n.created_at)}</span>
                </div>
                <h2 className="text-base !text-c1">{n.title}</h2>
                {n.event_at && <p className="text-sm font-bold text-brand-slate">{when(n.event_at)}</p>}
                <p className="whitespace-pre-line text-sm text-[#34445A]">{n.body}</p>
                {n.kind === "event" && n.event_at && (
                  <div className="flex flex-wrap items-center gap-2">
                    {[
                      ["1", "I'll attend"],
                      ["0", "Can't make it"],
                    ].map(([v, l]) => {
                      const on = answer.has(n.id) && answer.get(n.id) === (v === "1");
                      return (
                        <ActionForm key={v} action={rsvp}>
                          <input type="hidden" name="id" value={n.id} />
                          <input type="hidden" name="going" value={v} />
                          <SubmitButton className={on ? "s-btn" : "s-btn2"} pending="Saving…">
                            {on ? "✓ " : ""}
                            {l}
                            <span className="sr-only">: {n.title}</span>
                          </SubmitButton>
                        </ActionForm>
                      );
                    })}
                    <a className="s-link text-sm" href={`/api/announcements/${n.id}/ics`} download>
                      Add to calendar<span className="sr-only">: {n.title}</span>
                    </a>
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No notices from the school yet.</Empty>
        )
      ) : events.length ? (
        <ul className="flex flex-col gap-2">
          {events.map((e) => {
            const d = new Date(e.event_at!);
            return (
              <li key={e.id} className="flex items-center gap-3 rounded-[16px] border border-[#E3EAF3] bg-white p-3">
                <span aria-hidden="true" className="flex h-14 w-14 flex-none flex-col items-center justify-center rounded-xl bg-c1 text-white">
                  <span className="text-[11px] font-bold">{d.toLocaleDateString("en-GB", { month: "short", timeZone: TZ }).toUpperCase()}</span>
                  <span className="font-heading text-xl font-black leading-none">{d.toLocaleDateString("en-GB", { day: "numeric", timeZone: TZ })}</span>
                </span>
                <span className="min-w-0">
                  <span className="block font-bold text-brand-slate">{e.title}</span>
                  <span className="block text-xs text-[#4A5A70]">{when(e.event_at!)}</span>
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <Empty>No upcoming events.</Empty>
      )}
    </MobileShell>
  );
}
