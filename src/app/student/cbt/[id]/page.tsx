import Link from "next/link";
import { redirect } from "next/navigation";
import { MobileShell } from "@/components/MobileShell";
import { Empty } from "@/components/ui";
import { requireSchool } from "@/lib/auth";
import { STUDENT_TABS } from "@/lib/nav";
import { num } from "@/lib/teaching";
import { schoolThemeStyle } from "@/lib/theme";
import { CbtPlayer, type Paper } from "./CbtPlayer";

export const metadata = { title: "CBT test" };

const timeUp = (deadline: string) => new Date(deadline).getTime() < Date.now() - 30000;

type Review = { title: string; score: number; total: number; questions: { body: string; options: string[]; answer: number; chosen: number | null; explanation: string | null }[] };

export default async function TakeTest(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const { supabase, school, user, fullName } = await requireSchool(["student"]);
  if (!/^[0-9a-f-]{36}$/.test(id)) redirect("/student/cbt");
  const { data: me } = await supabase.from("students").select("id").eq("school_id", school.id).eq("user_id", user.id).maybeSingle<{ id: string }>();
  const { data: at } = me ? await supabase.from("cbt_attempts").select("id, submitted_at").eq("test_id", id).eq("student_id", me.id).maybeSingle<{ id: string; submitted_at: string | null }>() : { data: null };
  if (!at) redirect("/student/cbt");

  if (!at.submitted_at) {
    const { data: paper } = await supabase.rpc("cbt_paper", { p_attempt: at.id });
    const p = paper as Paper | null;
    // Time ran out while away: hand it in and show the result.
    if (!p || timeUp(p.deadline_at)) {
      await supabase.rpc("cbt_submit", { p_attempt: at.id, p_answers: null });
      redirect(`/student/cbt/${id}`);
    }
    return (
      <div style={schoolThemeStyle(school.primary_color, school.secondary_color)} className="min-h-screen bg-brand-cloud">
        <main id="main" className="mx-auto flex max-w-[760px] flex-col gap-3 px-4 pb-10">
          <CbtPlayer paper={p} who={fullName} testId={id} />
        </main>
      </div>
    );
  }

  // Finished: score, and the right answers when they're available.
  const [{ data: rev }, { data: list }] = await Promise.all([supabase.rpc("cbt_review", { p_attempt: at.id }), supabase.rpc("cbt_student_tests")]);
  const review = rev as Review | null;
  const t = ((list as { id: string; title: string; subject: string; score: number | null; total: number | null; practice: boolean }[] | null) ?? []).find((x) => x.id === id);
  return (
    <MobileShell school={school} title="CBT tests" tabs={STUDENT_TABS} active="homework">
      <Link href="/student/cbt" className="text-sm font-bold text-c1 underline">
        ← Back to tests
      </Link>
      <section aria-labelledby="r-h" className="flex flex-col gap-2 rounded-[18px] border border-[#E3EAF3] bg-white p-[18px]">
        <h2 id="r-h" className="text-lg !text-c1">
          {t?.title ?? review?.title ?? "Test"}
          {t?.subject ? ` · ${t.subject}` : ""}
        </h2>
        {t?.score !== null && t?.score !== undefined ? (
          <p className="font-heading text-4xl font-black text-c1">
            {num(t.score)} <span className="text-xl text-[#4A5A70]">/ {num(t.total)}</span>
          </p>
        ) : (
          <p className="text-sm text-brand-slate">Handed in. Your teacher will release the scores.</p>
        )}
      </section>
      {review ? (
        <ol className="flex flex-col gap-2" aria-label="Answers">
          {review.questions.map((q, i) => {
            const right = q.chosen === q.answer;
            return (
              <li key={i} className={`flex flex-col gap-2 rounded-[16px] border p-3 ${right ? "border-[#BFE6DC] bg-[#F3FBF9]" : "border-[#F5C2BE] bg-[#FFF8F7]"}`}>
                <p className="text-sm font-semibold text-brand-slate">
                  {i + 1}. {q.body}
                </p>
                <p className="text-sm">
                  <span className={right ? "font-bold text-[#0B6B5A]" : "font-bold text-[#912018]"}>{right ? "Right." : q.chosen === null ? "Not answered." : `Your answer: ${q.options[q.chosen]}.`}</span>{" "}
                  {!right && <span className="text-brand-slate">Correct answer: {q.options[q.answer]}.</span>}
                </p>
                {q.explanation && <p className="text-[13px] text-[#4A5A70]">{q.explanation}</p>}
              </li>
            );
          })}
        </ol>
      ) : (
        <Empty>{t?.practice ? "The answers will show here." : "The right answers show here after the test closes, if your teacher allows it."}</Empty>
      )}
    </MobileShell>
  );
}
