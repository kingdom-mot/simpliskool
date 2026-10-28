import { requireUser } from "@/lib/auth";

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** A calendar file for an event, so parents can add it to their phone calendar. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const { supabase } = await requireUser();
  const { data } = await supabase.from("announcements").select("id, title, body, event_at, schools(name, address)").eq("id", id).maybeSingle<{ id: string; title: string; body: string; event_at: string | null; schools: { name: string; address: string | null } | null }>();
  if (!data?.event_at) return new Response("Not found", { status: 404 });
  const start = new Date(data.event_at);
  const end = new Date(start.getTime() + 2 * 3600 * 1000);
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Simpliskool//Announcements//EN",
    "BEGIN:VEVENT",
    `UID:${data.id}@simpliskool.com`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(`${data.title} (${data.schools?.name ?? "School"})`)}`,
    `DESCRIPTION:${esc(data.body.slice(0, 1000))}`,
    ...(data.schools?.address ? [`LOCATION:${esc(data.schools.address)}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  return new Response(ics, { headers: { "content-type": "text/calendar; charset=utf-8", "content-disposition": `attachment; filename="event.ics"` } });
}
