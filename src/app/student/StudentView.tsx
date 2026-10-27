import { MobileShell } from "@/components/MobileShell";
import { Empty, TONES, TONE_CYCLE } from "@/components/ui";
import type { ShellSchool } from "@/components/PortalShell";
import { clock, longDate, pct, when } from "@/lib/format";
import { STUDENT_TABS } from "@/lib/nav";

export type StudentData = {
  today: string;
  first_name: string;
  last_name: string;
  class: string;
  lessons: { starts: string; ends: string; subject: string }[];
  average: number | null;
  att_days: number;
  att_present: number;
  announcements: { title: string; at: string }[];
};

export function StudentView({ school, fullName, d, now: nowOverride }: { school: ShellSchool; fullName: string; d: StudentData | null; now?: string }) {
  const today = d?.today ?? new Date().toISOString().slice(0, 10);
  const name = d?.first_name ?? fullName.split(" ")[0];

  const now = nowOverride ?? new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Africa/Lagos" }).format(new Date());
  const lessons = d?.lessons ?? [];
  const current = lessons.find((l) => l.starts <= now && l.ends > now);
  const upNext = current ?? lessons.find((l) => l.starts > now);

  return (
    <MobileShell school={school} title={`Hi ${name}`} subtitle={[d?.class, longDate(today)].filter(Boolean).join(" · ")} tabs={STUDENT_TABS} active="home" overlap>
      <section aria-labelledby="next-h" className="flex flex-col gap-2 rounded-[18px] border border-[#E3EAF3] bg-white p-[18px] shadow-[0_16px_32px_-16px_rgba(15,42,82,0.3)]">
        {upNext ? (
          <>
            <span className="text-xs font-extrabold tracking-[0.06em] text-[#0B6B5A]">
              {current ? "NOW" : "UP NEXT"} · {clock(upNext.starts).toUpperCase()}
            </span>
            <h2 id="next-h" className="text-[22px] !text-c1">
              {upNext.subject}
            </h2>
            <p className="text-sm text-[#4A5A70]">
              {clock(upNext.starts)} – {clock(upNext.ends)}
            </p>
          </>
        ) : (
          <>
            <h2 id="next-h" className="text-lg !text-c1">
              {lessons.length ? "No more lessons today" : "No lessons on your timetable today"}
            </h2>
            <p className="text-sm text-[#4A5A70]">Enjoy the rest of your day.</p>
          </>
        )}
      </section>

      {lessons.length > 0 && (
        <section aria-labelledby="tt-h" className="flex flex-col gap-2.5 rounded-[18px] border border-[#E3EAF3] bg-white p-[18px]">
          <h2 id="tt-h" className="text-[17px] !text-c1">
            Today&apos;s timetable
          </h2>
          <ol className="flex flex-col gap-2">
            {lessons.map((l, i) => {
              const t = TONES[TONE_CYCLE[i % TONE_CYCLE.length]];
              const isNow = l === current;
              return (
                <li key={l.starts} aria-current={isNow ? "time" : undefined} className="flex items-center gap-3 rounded-xl border-l-[5px] px-3 py-2.5" style={{ background: t.tint, borderLeftColor: t.icon }}>
                  <span className="w-[86px] flex-none text-[13px] font-bold" style={{ color: t.fg }}>
                    {clock(l.starts)}
                  </span>
                  <span className="flex-1 text-[15px] font-bold" style={{ color: t.fg }}>
                    {l.subject}
                  </span>
                  {isNow && <span className="rounded-full bg-white px-2 py-0.5 text-xs font-extrabold text-[#0B6B5A]">Now</span>}
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1 rounded-[18px] border p-4" style={{ background: TONES.purple.bg, borderColor: TONES.purple.border }}>
          <span className="text-[13px] font-bold" style={{ color: TONES.purple.fg }}>
            Term average
          </span>
          <span className="font-heading text-2xl font-black" style={{ color: TONES.purple.fg }}>
            {d?.average ?? "—"}
          </span>
          <span className="text-[13px] text-[#34445A]">{d?.average ? "From released results" : "Shows when results are out"}</span>
        </div>
        <div className="flex flex-col gap-1 rounded-[18px] border p-4" style={{ background: TONES.teal.bg, borderColor: TONES.teal.border }}>
          <span className="text-[13px] font-bold" style={{ color: TONES.teal.fg }}>
            Attendance
          </span>
          <span className="font-heading text-2xl font-black" style={{ color: TONES.teal.fg }}>
            {d?.att_days ? `${pct(d.att_present, d.att_days)}%` : "—"}
          </span>
          <span className="text-[13px] text-[#34445A]">{d?.att_days ? `${d.att_present} of ${d.att_days} days` : "This term"}</span>
        </div>
      </div>

      {d?.announcements.length ? (
        d.announcements.map((a) => (
          <div key={a.at + a.title} className="flex flex-col gap-1 rounded-[18px] bg-[#FFF6E3] p-4">
            <span className="text-xs font-extrabold text-[#7A5300]">FROM THE SCHOOL · {when(a.at, today).toUpperCase()}</span>
            <span className="text-[15px] font-bold text-c1">{a.title}</span>
          </div>
        ))
      ) : d ? null : (
        <Empty>Your class will appear here once the school adds you.</Empty>
      )}
    </MobileShell>
  );
}
