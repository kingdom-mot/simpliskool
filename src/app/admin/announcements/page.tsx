import { AdminPage, Panel, classLabel, requireAdminPage } from "@/components/admin";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Bar, Empty, Pill } from "@/components/ui";
import { emailReady } from "@/lib/email";
import { pct } from "@/lib/format";
import { RESULTS_ADMIN } from "@/lib/results";
import { loadClasses } from "@/lib/results-load";
import { Flash } from "@/components/Flash";
import { releaseDueSoon } from "@/lib/announce";
import { smsReady } from "@/lib/sms";
import { AnnouncementForm } from "./AnnouncementForm";
import { cancelScheduled, deleteAnnouncement } from "./actions";

export const metadata = { title: "Announcements" };

type Hist = { id: string; title: string; audience: string; kind: string; event_at: string | null; at: string; class_names: string[] | null; reach: number; emailed: number; sms_sent?: number; scheduled_for?: string | null; read: number; going: number; not_going: number };
type Waiting = { id: string; title: string; audience: string; kind: string; publish_at: string; send_email: boolean; send_sms: boolean; class_ids: string[] | null };
const AUD: Record<string, string> = { school: "Whole school", parents: "All parents", staff: "Staff", class: "Classes" };

export default async function AnnouncementsPage() {
  const ctx = await requireAdminPage(RESULTS_ADMIN);
  const { supabase, school } = ctx;
  await releaseDueSoon();
  const classes = await loadClasses(supabase, school.id);
  const r = (aud: string, ids: string[] | null) => supabase.rpc("announcement_reach", { p_school: school.id, p_audience: aud, p_classes: ids }).then((x) => Number(x.data) || 0);
  const [all, parents, staff, perClass, { data: hist }, { data: waitingRaw }, { data: smsRow }] = await Promise.all([
    r("school", null),
    r("parents", null),
    r("staff", null),
    Promise.all(classes.map((c) => r("class", [c.id]))),
    supabase.rpc("announcement_history", { p_school: school.id }),
    supabase.from("scheduled_announcements").select("id, title, audience, kind, publish_at, send_email, send_sms, class_ids").eq("school_id", school.id).order("publish_at").returns<Waiting[]>(),
    supabase.from("schools").select("sms_enabled").eq("id", school.id).maybeSingle<{ sms_enabled: boolean }>(),
  ]);
  const waiting = waitingRaw ?? [];
  const className = new Map(classes.map((c) => [c.id, classLabel(c.name, c.arm)]));
  const at = (iso: string) => new Date(iso).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Africa/Lagos" });
  const history = (hist as Hist[] | null) ?? [];
  const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Africa/Lagos" });

  return (
    <AdminPage ctx={ctx} active="announcements" crumb={[{ label: "Communication" }]} title="Announcements">
      <Flash />
      <AnnouncementForm
        schoolName={school.name}
        classes={classes.map((c, i) => ({ id: c.id, label: classLabel(c.name, c.arm), reach: perClass[i] }))}
        reach={{ school: all, parents, staff }}
        emailReady={emailReady()}
        sms={!smsReady() ? "not-connected" : smsRow?.sms_enabled ? "on" : "off"}
      />
      {waiting.length > 0 && (
        <Panel id="wait-h" title="Waiting to send">
          <ul className="flex flex-col gap-2">
            {waiting.map((w) => (
              <li key={w.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-[#E3EAF3] p-3">
                <div className="min-w-[200px] flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-brand-slate">{w.title}</span>
                    <Pill kind="info">Scheduled</Pill>
                  </div>
                  <div className="text-xs text-[#4A5A70]">
                    Goes out {at(w.publish_at)} · {w.audience === "class" ? (w.class_ids ?? []).map((id) => className.get(id) ?? "class").join(", ") : AUD[w.audience]}
                    {w.send_email ? " · email" : ""}
                    {w.send_sms ? " · SMS" : ""}
                  </div>
                </div>
                <ActionForm action={cancelScheduled}>
                  <input type="hidden" name="id" value={w.id} />
                  <SubmitButton className="s-btn-danger" pending="Cancelling…">
                    Cancel<span className="sr-only"> {w.title}</span>
                  </SubmitButton>
                </ActionForm>
              </li>
            ))}
          </ul>
        </Panel>
      )}
      <Panel id="sent-h" title="Sent">
        {history.length ? (
          <ul className="flex flex-col gap-2">
            {history.map((h) => {
              const p = pct(h.read, h.reach);
              return (
                <li key={h.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-[#E3EAF3] p-3">
                  <div className="min-w-[200px] flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-brand-slate">{h.title}</span>
                      {h.kind === "event" && <Pill kind="warn">Event</Pill>}
                    </div>
                    <div className="text-xs text-[#4A5A70]">
                      {h.audience === "class" && h.class_names?.length ? h.class_names.join(", ") : AUD[h.audience]} · {day(h.at)}
                      {h.scheduled_for ? " · scheduled" : ""}
                      {h.emailed ? ` · emailed ${h.emailed}` : ""}
                      {h.sms_sent ? ` · texted ${h.sms_sent}` : ""}
                      {h.kind === "event" ? ` · ${h.going} attending, ${h.not_going} can't` : ""}
                    </div>
                  </div>
                  <div className="w-40">
                    <div className="mb-1 text-xs font-bold text-brand-slate">
                      {p}% read ({h.read} of {h.reach})
                    </div>
                    <Bar value={p} fill="var(--c2,#0B7D6E)" label={`${h.title}: ${p}% read`} height={6} />
                  </div>
                  <ActionForm action={deleteAnnouncement}>
                    <input type="hidden" name="id" value={h.id} />
                    <SubmitButton className="s-btn-danger" pending="Deleting…">
                      Delete<span className="sr-only"> {h.title}</span>
                    </SubmitButton>
                  </ActionForm>
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty>No announcements yet.</Empty>
        )}
      </Panel>
    </AdminPage>
  );
}
