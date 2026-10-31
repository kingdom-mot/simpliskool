import { redirect } from "next/navigation";
import { featureOn } from "@/lib/platform-settings";
import Link from "next/link";
import { PageHero } from "@/components/admin";
import { Flash } from "@/components/Flash";
import { PortalShell } from "@/components/PortalShell";
import { Empty, Pill } from "@/components/ui";
import { requireSchool } from "@/lib/auth";
import { TEACHER_NAV } from "@/lib/nav";
import { asParts } from "@/lib/results";
import { dayTime, lagosParts, myClassSubjects } from "@/lib/teaching";
import { NewTest, type Bank } from "./NewTest";

export const metadata = { title: "CBT tests" };

type T = { id: string; title: string; practice: boolean; opens_at: string; closes_at: string; question_ids: string[]; duration_min: number; class_ids: string[]; cbt_attempts: { submitted_at: string | null }[] };
const tomorrow = () => lagosParts(new Date(Date.now() + 86400000)).date;
const nowMs = () => Date.now();
const at = (iso: string) => Date.parse(iso);

export default async function TeacherCbt() {
  const { supabase, school, user, fullName } = await requireSchool(["teacher"]);
  if (!(await featureOn(school.id, "cbt"))) redirect("/teacher");
  const mine = await myClassSubjects(supabase, school.id, user.id);
  const [{ data: tests }, { data: partsRaw }, { data: qs }] = await Promise.all([
    supabase.from("cbt_tests").select("id, title, practice, opens_at, closes_at, question_ids, duration_min, class_ids, cbt_attempts(submitted_at)").eq("school_id", school.id).eq("teacher_id", user.id).order("opens_at", { ascending: false }).limit(60).returns<T[]>(),
    supabase.rpc("assessment_parts", { p_school: school.id }),
    mine.length ? supabase.from("questions").select("subject_id, level, topic").eq("school_id", school.id).eq("checked", true).in("subject_id", [...new Set(mine.map((m) => m.subject_id))]).returns<{ subject_id: string; level: string; topic: string }[]>() : Promise.resolve({ data: [] as { subject_id: string; level: string; topic: string }[] }),
  ]);
  const banks: Bank[] = [];
  for (const m of mine) {
    const key = `${m.subject_id}|${m.level}`;
    let b = banks.find((x) => x.key === key);
    if (!b) {
      const counts = new Map<string, number>();
      for (const q of qs ?? []) if (q.subject_id === m.subject_id && q.level === m.level) counts.set(q.topic, (counts.get(q.topic) ?? 0) + 1);
      b = { key, label: `${m.level} · ${m.subject}`, classes: [], topics: [...counts].map(([name, n]) => ({ name, n })).sort((a, z) => a.name.localeCompare(z.name)) };
      banks.push(b);
    }
    b.classes.push({ id: m.class_id, label: m.className });
  }
  const className = new Map(mine.map((m) => [m.class_id, m.className]));
  const now = nowMs();
  const status = (t: T) => (now < at(t.opens_at) ? { k: "info" as const, t: "Scheduled" } : now <= at(t.closes_at) ? { k: "warn" as const, t: "Open now" } : { k: "good" as const, t: "Finished" });

  return (
    <PortalShell school={school} schoolId={school.id} role="teacher" roleLabel="Teacher" fullName={fullName} groups={TEACHER_NAV} active="cbt">
      <div className="flex flex-col gap-5">
        <PageHero title="CBT tests" actions={banks.length ? <a className="s-btn" href="#new-h">+ New test</a> : undefined} />
        <Flash />
        {!banks.length ? (
          <Empty>You don&apos;t have any subjects yet. The school admin gives teachers their subjects under Classes and subjects.</Empty>
        ) : (
          <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 xl:grid-cols-[1.1fr_1fr]">
            <section aria-labelledby="my-h" className="flex flex-col gap-3 rounded-[18px] border border-t-[5px] border-[#E3EAF3] border-t-c2 bg-white p-[22px]">
              <h2 id="my-h" className="text-lg !text-c1">
                My tests
              </h2>
              {tests?.length ? (
                <ul className="flex flex-col gap-2">
                  {tests.map((t) => {
                    const s = status(t);
                    const done = t.cbt_attempts.filter((a) => a.submitted_at).length;
                    return (
                      <li key={t.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-[#E3EAF3] p-3">
                        <div className="min-w-[200px] flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-brand-slate">{t.title}</span>
                            <Pill kind={s.k}>{s.t}</Pill>
                            {t.practice && <Pill kind="info">Practice</Pill>}
                          </div>
                          <div className="text-xs text-[#4A5A70]">
                            {t.class_ids.map((c) => className.get(c) ?? "class").join(", ")} · {t.question_ids.length} questions · {t.duration_min} min · opens {dayTime(t.opens_at)}
                          </div>
                        </div>
                        <span className="text-sm font-bold text-brand-slate">{done} finished</span>
                        <Link className="s-btn2" href={`/teacher/cbt/${t.id}`}>
                          {s.t === "Scheduled" ? "Open" : "Results"}
                          <span className="sr-only"> for {t.title}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <Empty>No tests yet. Add questions to the bank, then schedule a test.</Empty>
              )}
            </section>
            <section aria-labelledby="new-h" className="flex flex-col gap-4 rounded-[18px] border border-t-[5px] border-[#E3EAF3] border-t-c1 bg-white p-[22px]">
              <h2 id="new-h" className="text-lg !text-c1">
                New test
              </h2>
              <NewTest banks={banks} parts={asParts(partsRaw)} defaults={{ openDate: tomorrow(), closeDate: tomorrow() }} />
              <Link className="s-link text-sm" href="/teacher/questions">
                Add or check questions in the bank
              </Link>
            </section>
          </div>
        )}
      </div>
    </PortalShell>
  );
}
