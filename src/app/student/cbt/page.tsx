import Link from "next/link";
import { MobileShell } from "@/components/MobileShell";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Empty, Pill } from "@/components/ui";
import { requireSchool } from "@/lib/auth";
import { STUDENT_TABS } from "@/lib/nav";
import { CA_LABEL, dayTime, num } from "@/lib/teaching";
import { startTest } from "./actions";

export const metadata = { title: "CBT tests" };

type T = { id: string; title: string; subject: string; practice: boolean; questions: number; duration: number; opens_at: string; closes_at: string; ca_part: string | null; show_score: boolean; started: boolean; submitted_at: string | null; deadline_at: string | null; score: number | null; total: number | null };
const nowMs = () => Date.now();
const at = (iso: string) => Date.parse(iso);

function until(iso: string, now: number) {
  const mins = Math.round((at(iso) - now) / 60000);
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"}`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"}`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ${h % 24} hour${h % 24 === 1 ? "" : "s"}`;
}

export default async function StudentCbt() {
  const { supabase, school } = await requireSchool(["student"]);
  const { data } = await supabase.rpc("cbt_student_tests");
  const tests = (data as T[] | null) ?? [];
  const now = nowMs();
  const open = tests.filter((t) => !t.submitted_at && at(t.opens_at) <= now && now <= at(t.closes_at));
  const soon = tests.filter((t) => !t.submitted_at && at(t.opens_at) > now).reverse();
  const done = tests.filter((t) => t.submitted_at || now > at(t.closes_at));

  const card = (t: T, body: React.ReactNode) => (
    <li key={t.id} className="flex flex-col gap-2 rounded-[18px] border border-[#E3EAF3] bg-white p-[18px]">
      <div className="flex flex-wrap items-center gap-2">
        <Pill kind={t.practice ? "info" : "warn"}>{t.practice ? "Practice · doesn't count" : t.ca_part ? `Counts for ${CA_LABEL[t.ca_part]}` : "Class test"}</Pill>
      </div>
      <h3 className="text-base !text-c1">
        {t.title} · {t.subject}
      </h3>
      {body}
    </li>
  );

  return (
    <MobileShell school={school} title="CBT tests" tabs={STUDENT_TABS} active="homework">
      <Link href="/student/homework" className="text-sm font-bold text-c1 underline">
        ← Homework
      </Link>
      <section aria-labelledby="open-h" className="flex flex-col gap-2">
        <h2 id="open-h" className="text-base !text-c1">
          Open now
        </h2>
        {open.length ? (
          <ul className="flex flex-col gap-2">
            {open.map((t) =>
              card(
                t,
                <>
                  <p className="text-sm text-brand-slate">
                    {t.questions} questions · {t.duration} minutes · closes {dayTime(t.closes_at)}
                    {t.practice ? " · you'll see your score and the right answers at the end" : ""}
                  </p>
                  {t.started ? (
                    <Link className="s-btn self-start" href={`/student/cbt/${t.id}`}>
                      Carry on<span className="sr-only"> with {t.title}</span>
                    </Link>
                  ) : (
                    <ActionForm action={startTest}>
                      <input type="hidden" name="test" value={t.id} />
                      <SubmitButton pending="Starting…">
                        {t.practice ? "Start practice" : "Start test"}
                        <span className="sr-only">: {t.title}</span>
                      </SubmitButton>
                    </ActionForm>
                  )}
                </>,
              ),
            )}
          </ul>
        ) : (
          <Empty>No tests open right now.</Empty>
        )}
      </section>

      <section aria-labelledby="rules-h" className="flex flex-col gap-2 rounded-[18px] border border-[#E3EAF3] bg-white p-[18px]">
        <h2 id="rules-h" className="text-base !text-c1">
          Rules for tests
        </h2>
        <ul className="list-disc pl-5 text-sm text-brand-slate">
          <li>The timer starts when you press Start and can&apos;t be paused.</li>
          <li>Your answers save as you go, even if the network drops.</li>
          <li>You can flag questions and come back to them.</li>
          <li>When time runs out, your answers are handed in automatically.</li>
        </ul>
      </section>

      {soon.length > 0 && (
        <section aria-labelledby="soon-h" className="flex flex-col gap-2">
          <h2 id="soon-h" className="text-base !text-c1">
            Not open yet
          </h2>
          <ul className="flex flex-col gap-2">
            {soon.map((t) =>
              card(
                t,
                <p className="text-sm text-brand-slate">
                  {dayTime(t.opens_at)} · {t.questions} questions · {t.duration} minutes · opens in {until(t.opens_at, now)}
                </p>,
              ),
            )}
          </ul>
        </section>
      )}

      {done.length > 0 && (
        <section aria-labelledby="done-h" className="flex flex-col gap-2">
          <h2 id="done-h" className="text-base !text-c1">
            Finished
          </h2>
          <ul className="flex flex-col gap-2">
            {done.map((t) => (
              <li key={t.id}>
                <Link href={`/student/cbt/${t.id}`} className="flex min-h-[60px] items-center justify-between gap-3 rounded-[16px] border border-[#E3EAF3] bg-white p-3 hover:border-c2">
                  <span>
                    <span className="block font-bold text-brand-slate">
                      {t.title} · {t.subject}
                    </span>
                    <span className="text-[13px] text-[#4A5A70]">{t.submitted_at ? dayTime(t.submitted_at) : "You didn't take this test"}</span>
                  </span>
                  <Pill kind={t.score !== null ? "good" : "info"}>{t.score !== null ? `${num(t.score)} / ${num(t.total)}` : t.submitted_at ? "Score not released" : "Missed"}</Pill>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </MobileShell>
  );
}
