import { PortalShell } from "@/components/PortalShell";
import { Bar, Card, Empty, ICONS, Icon, Pill, SCHOOL_GRADIENT, TONES, TONE_CYCLE } from "@/components/ui";
import type { ShellSchool } from "@/components/PortalShell";
import { clock, greeting, longDate, pct, TERM_NAME, when } from "@/lib/format";
import { TEACHER_NAV } from "@/lib/nav";

export type TeacherData = {
  today: string;
  term: { term_no: number; session: string; week: number | null } | null;
  lessons: { starts: string; ends: string; subject: string; class: string }[];
  form_classes: { id: string; name: string; students: number; marked: number; present: number; absent: number; late: number }[];
  scores: { subject: string; class: string; students: number; entered: number }[];
  announcements: { title: string; at: string }[];
};

function lagosNow(): string {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Africa/Lagos" }).format(new Date());
}

export function TeacherView({ school, fullName, d, now: nowOverride }: { school: ShellSchool; fullName: string; d: TeacherData | null; now?: string }) {
  const today = d?.today ?? new Date().toISOString().slice(0, 10);
  const now = nowOverride ?? lagosNow();

  const lessons = (d?.lessons ?? []).map((l) => ({ ...l, state: l.ends <= now ? "done" : l.starts <= now ? "now" : "later" }));
  const next = lessons.find((l) => l.state === "later");
  const nowLesson = lessons.find((l) => l.state === "now");

  return (
    <PortalShell school={school} roleLabel="Teacher" fullName={fullName} groups={TEACHER_NAV} active="today">
      <div className="flex flex-col gap-5">
        <div>
          <p className="text-sm text-[#4A5A70]">
            {longDate(today)}
            {d?.term ? ` · ${d.term.week ? `Week ${d.term.week} · ` : ""}${TERM_NAME[d.term.term_no]}` : ""}
          </p>
          <h1 className="mt-1 text-[30px] leading-tight !text-c1">
            {greeting()}, {fullName}
          </h1>
        </div>

        {(next || nowLesson) && (
          <section aria-labelledby="next-h" className="flex items-start gap-3.5 rounded-[20px] border-2 border-[#F4B740] bg-[#FFF6E3] p-5">
            <span aria-hidden="true" className="flex h-12 w-12 flex-none items-center justify-center rounded-[14px] bg-[#F4B740] text-[#1B2433]">
              <Icon d={ICONS.bell} size={24} />
            </span>
            <div>
              <h2 id="next-h" className="text-xl !text-c1">
                {nowLesson ? `Now: ${nowLesson.subject} with ${nowLesson.class}` : `Next: ${next!.subject} with ${next!.class}`}
              </h2>
              <p className="mt-1 text-[15px] text-[#5C4310]">
                {nowLesson ? `Until ${clock(nowLesson.ends)}` : `Starts at ${clock(next!.starts)}`}
              </p>
            </div>
          </section>
        )}

        {d?.form_classes.map((c) => (
          <section key={c.id} aria-labelledby={`reg-${c.id}`} className="flex flex-wrap items-center justify-between gap-4 rounded-[20px] p-[22px] text-white" style={{ background: SCHOOL_GRADIENT }}>
            <div className="flex items-center gap-3.5">
              <span aria-hidden="true" className="flex h-[52px] w-[52px] flex-none items-center justify-center rounded-[14px] bg-white/15">
                <Icon d={ICONS.check} size={26} />
              </span>
              <div>
                <h2 id={`reg-${c.id}`} className="text-xl !text-white">
                  {c.marked ? `${c.name} register taken` : `${c.name} register not taken yet`}
                </h2>
                <p className="mt-1 text-[15px] text-white">
                  {c.marked ? `${c.present} present · ${c.absent} absent · ${c.late} late` : `${c.students} student${c.students === 1 ? "" : "s"} in your form class`}
                </p>
              </div>
            </div>
            <span className="rounded-full bg-white/15 px-4 py-2 text-sm font-bold text-white">Online register coming soon</span>
          </section>
        ))}

        <section aria-labelledby="day-h" className="flex flex-col gap-3">
          <h2 id="day-h" className="text-lg !text-c1">
            Today&apos;s lessons
          </h2>
          {lessons.length ? (
            <ol className="flex gap-3 overflow-x-auto pb-1">
              {lessons.map((l) => (
                <li
                  key={l.starts + l.class}
                  aria-current={l.state === "now" ? "time" : undefined}
                  className="flex flex-[0_0_190px] flex-col gap-1 rounded-2xl border-[1.5px] px-4 py-3.5"
                  style={{ background: l.state === "now" ? TONES.teal.tint : "#FFFFFF", borderColor: l.state === "now" ? "var(--c2,#0B7D6E)" : "#E3EAF3" }}
                >
                  <span className="text-xs font-extrabold" style={{ color: l.state === "now" ? "#0B6B5A" : "#4A5A70" }}>
                    {l.state === "now" ? "NOW" : l.state === "done" ? "DONE" : "LATER"}
                  </span>
                  <span className="text-[13px] text-[#4A5A70]">
                    {clock(l.starts)} – {clock(l.ends)}
                  </span>
                  <span className="text-base font-extrabold text-c1">{l.subject}</span>
                  <span className="text-[13px] text-[#4A5A70]">{l.class}</span>
                </li>
              ))}
            </ol>
          ) : (
            <Empty>No lessons on your timetable today.</Empty>
          )}
        </section>

        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <Card labelledBy="todo-h" className="flex flex-col gap-2.5">
            <h2 id="todo-h" className="text-lg !text-c1">
              Score entry this term
            </h2>
            {d?.scores.length ? (
              d.scores.map((s, i) => {
                const t = TONES[TONE_CYCLE[(i + 4) % TONE_CYCLE.length]];
                const p = pct(s.entered, s.students);
                return (
                  <div key={s.subject + s.class} className="flex flex-col gap-1.5 rounded-[14px] border-l-[5px] p-3.5" style={{ background: t.tint, borderLeftColor: t.icon }}>
                    <span className="flex justify-between gap-2">
                      <span className="text-[15px] font-extrabold" style={{ color: t.fg }}>
                        {s.subject} · {s.class}
                      </span>
                      <Pill kind={p >= 100 ? "good" : p > 0 ? "warn" : "info"}>{p >= 100 ? "Done" : p > 0 ? "In progress" : "Not started"}</Pill>
                    </span>
                    <Bar value={p} fill={t.bar} track="#FFFFFF" height={6} label={`${s.subject} ${s.class} scores entered`} />
                    <span className="text-[13px] text-[#34445A]">
                      {s.entered} of {s.students} students entered
                    </span>
                  </div>
                );
              })
            ) : (
              <Empty>Your subjects will show here once the school assigns them to you.</Empty>
            )}
          </Card>

          <Card labelledBy="news-h" className="flex flex-col gap-2.5">
            <h2 id="news-h" className="text-lg !text-c1">
              From the school
            </h2>
            {d?.announcements.length ? (
              d.announcements.map((a) => (
                <div key={a.at + a.title} className="rounded-[14px] bg-[#FFF6E3] p-3.5">
                  <div className="text-xs font-extrabold text-[#7A5300]">{when(a.at, today).toUpperCase()}</div>
                  <div className="font-bold text-c1">{a.title}</div>
                </div>
              ))
            ) : (
              <Empty>No staff announcements yet.</Empty>
            )}
          </Card>
        </div>
      </div>
    </PortalShell>
  );
}
