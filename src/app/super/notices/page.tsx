import { Flash } from "@/components/Flash";
import { Box, SuperShell } from "@/components/super";
import { Empty, Pill } from "@/components/ui";
import { requirePlatform } from "@/lib/platform";
import { demoSchoolIds, notDemo, nowMs, shortDay } from "@/lib/platform-data";
import { endNotice } from "../actions";
import { NoticeComposer } from "./NoticeComposer";

export const metadata = { title: "Notices to schools — Simpliskool back office" };

const AUD: Record<string, string> = { admins: "All owners and admins", bursars: "Bursars", pilot: "Pilot schools", chosen: "Chosen schools" };
const lagosDay = (t: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date(t));

export default async function SuperNotices() {
  const ctx = await requirePlatform("notices");
  const now = nowMs();
  const today = lagosDay(now);
  const [{ data: notices }, { data: schools }, { data: reads }] = await Promise.all([
    ctx.admin.from("platform_notices").select("id, kind, headline, audience, school_ids, show_until, created_at, ended_at, email_owners").order("created_at", { ascending: false }).limit(30).returns<{ id: string; kind: string; headline: string; audience: string; school_ids: string[] | null; show_until: string; created_at: string; ended_at: string | null; email_owners: boolean }[]>(),
    notDemo(ctx.admin.from("schools").select("id, name, plan"), await demoSchoolIds(ctx.admin), "id").eq("status", "active").order("name").returns<{ id: string; name: string; plan: string }[]>(),
    ctx.admin.from("notice_reads").select("notice_id, school_id").limit(50000).returns<{ notice_id: string; school_id: string | null }[]>(),
  ]);
  const readBy = new Map<string, Set<string>>();
  for (const r of reads ?? []) if (r.school_id) readBy.set(r.notice_id, (readBy.get(r.notice_id) ?? new Set()).add(r.school_id));
  const targetCount = (n: { audience: string; school_ids: string[] | null }) => (n.audience === "chosen" ? (n.school_ids ?? []).length : n.audience === "pilot" ? (schools ?? []).filter((s) => s.plan === "pilot").length : (schools ?? []).length);

  return (
    <SuperShell ctx={ctx} active="notices" title="Notices to schools" sub="Show a message in school admins' portals: new features, planned downtime or important changes.">
      <Flash />
      <NoticeComposer schools={(schools ?? []).map((s) => ({ id: s.id, name: s.name }))} defaultUntil={lagosDay(now + 14 * 86_400_000)} />
      <Box id="past-h" title="Live and past notices">
        {notices?.length ? (
          <ul className="flex flex-col gap-2.5">
            {notices.map((n) => {
              const live = !n.ended_at && n.show_until >= today;
              return (
                <li key={n.id} className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-[#E3EAF3] px-4 py-3">
                  <span>
                    <strong className="text-[#173B70]">{n.headline}</strong>
                    <span className="block text-[13px] text-[#4A5A70]">
                      {AUD[n.audience]} · shown {shortDay(n.created_at)} to {shortDay(n.ended_at ?? `${n.show_until}T12:00:00+01:00`)} · hidden by {readBy.get(n.id)?.size ?? 0} of {targetCount(n)} schools
                      {n.email_owners ? " · emailed" : ""}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <Pill kind={live ? "good" : "info"}>{live ? "Live" : "Ended"}</Pill>
                    {live && (
                      <form action={endNotice}>
                        <input type="hidden" name="notice_id" value={n.id} />
                        <button className="s-btn2 !min-h-[40px] !px-3">
                          Take down<span className="sr-only"> {n.headline}</span>
                        </button>
                      </form>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty>No notices yet.</Empty>
        )}
      </Box>
    </SuperShell>
  );
}
