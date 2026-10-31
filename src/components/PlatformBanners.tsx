import { headers } from "next/headers";
import { dismissNotice, stopViewing } from "@/app/platform-actions";
import { currentUser, type Role } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { activeView } from "@/lib/viewing";

type Notice = { id: string; kind: "feat" | "down" | "change"; headline: string; details: string | null; audience: string; school_ids: string[] | null };
const LOOK = {
  feat: { bg: "#E7F6F2", fg: "#0B4F43", icon: "★", label: "New feature" },
  down: { bg: "#FFF6E3", fg: "#5C3E00", icon: "!", label: "Planned downtime" },
  change: { bg: "#EEF3F9", fg: "#173B70", icon: "i", label: "Important change" },
};
const lagosDay = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date());
const until = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(iso)).replace(" ", "").toLowerCase();

/**
 * Top of the school portal: the "viewing read only" bar for the Dream Savvy team,
 * and notices from Dream Savvy to school admins.
 */
export async function PlatformBanners({ schoolId, role }: { schoolId?: string; role?: Role }) {
  if (!schoolId || !role) return null;
  const user = await currentUser();
  if (!user) return null;
  const view = await activeView(user.id);
  const admin = createAdminClient();
  let notices: Notice[] = [];
  if (["owner", "admin", "principal", "bursar"].includes(role)) {
    try {
      const { data: list } = await admin.from("platform_notices").select("id, kind, headline, details, audience, school_ids").is("ended_at", null).gte("show_until", lagosDay()).order("created_at", { ascending: false }).limit(10).returns<Notice[]>();
      const ids = (list ?? []).map((n) => n.id);
      const [{ data: school }, { data: reads }] = ids.length
        ? await Promise.all([
            admin.from("schools").select("plan").eq("id", schoolId).maybeSingle<{ plan: string }>(),
            view ? Promise.resolve({ data: [] as { notice_id: string }[] }) : admin.from("notice_reads").select("notice_id").eq("user_id", user.id).in("notice_id", ids).returns<{ notice_id: string }[]>(),
          ])
        : [{ data: null }, { data: [] as { notice_id: string }[] }];
      const read = new Set((reads ?? []).map((r) => r.notice_id));
      const isAdmin = role !== "bursar";
      notices = (list ?? []).filter((n) => {
        if (read.has(n.id)) return false;
        if (n.audience === "bursars") return role === "bursar" || role === "owner";
        if (n.audience === "pilot") return isAdmin && school?.plan === "pilot";
        if (n.audience === "chosen") return isAdmin && (n.school_ids ?? []).includes(schoolId);
        return isAdmin;
      });
    } catch {
      notices = []; // before database file 0018
    }
  }
  if (!view && !notices.length) return null;
  const back = (await headers()).get("x-pathname") ?? "/admin";

  return (
    <div className="mb-4 flex flex-col gap-2">
      {view && (
        <div role="region" aria-label="Viewing as this school" className="flex flex-wrap items-center gap-3 rounded-[14px] bg-[#0A1F3D] px-4 py-3 text-white">
          <span className="flex-1 text-sm">
            <strong>Viewing {view.school.name} as its owner · read only.</strong> Ends at {until(view.expires_at)}. Nothing you do here is saved.
          </span>
          <form action={stopViewing}>
            <button className="min-h-[40px] rounded-lg bg-white px-3 text-sm font-extrabold text-[#0A1F3D]">Stop viewing</button>
          </form>
        </div>
      )}
      {notices.map((n) => (
        <div key={n.id} role="note" aria-label={`${LOOK[n.kind].label} from Simpliskool`} className="flex items-start gap-3 rounded-[14px] px-4 py-3" style={{ background: LOOK[n.kind].bg, color: LOOK[n.kind].fg }}>
          <span aria-hidden="true" className="text-lg font-black leading-6">
            {LOOK[n.kind].icon}
          </span>
          <span className="flex-1">
            <strong className="block">{n.headline}</strong>
            {n.details && <span className="mt-0.5 block text-sm">{n.details}</span>}
          </span>
          {!view && (
            <form action={dismissNotice}>
              <input type="hidden" name="notice_id" value={n.id} />
              <input type="hidden" name="school_id" value={schoolId} />
              <input type="hidden" name="back" value={back} />
              <button className="flex h-10 w-10 items-center justify-center rounded-lg text-lg font-extrabold hover:bg-black/5">
                <span aria-hidden="true">×</span>
                <span className="sr-only">Hide this notice: {n.headline}</span>
              </button>
            </form>
          )}
        </div>
      ))}
    </div>
  );
}
