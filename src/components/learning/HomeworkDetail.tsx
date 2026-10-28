import { ActionForm, SubmitButton } from "@/components/forms";
import { Pill } from "@/components/ui";
import type { KidHw } from "@/lib/homework-load";
import { takeBack } from "@/lib/homework-actions";
import { dayTime, dueText, num } from "@/lib/teaching";
import { HandIn } from "./HandIn";

const fileUrl = (p: string) => `/api/learning-file?p=${encodeURIComponent(p)}`;

/** One homework, for the student (or a parent handing in for a child). */
export function HomeworkDetail({ hw, studentId, back, who }: { hw: KidHw; studentId: string; back: string; who: string }) {
  const paper = hw.submit_modes.join() === "paper";
  const closed = new Date(hw.due_at) < new Date() && !hw.allow_late;
  return (
    <div className="flex flex-col gap-3">
      <section aria-labelledby="hw-h" className="flex flex-col gap-3 rounded-[18px] border border-[#E3EAF3] bg-white p-[18px]">
        <div className="flex flex-wrap items-center gap-2">
          <Pill kind={hw.state === "marked" ? "good" : hw.state === "done" ? "info" : new Date(hw.due_at) < new Date() ? "bad" : "warn"}>
            {hw.state === "marked" ? `${num(hw.sub?.score)} / ${num(hw.max_marks)}` : hw.state === "done" ? "Handed in" : dueText(hw.due_at)}
          </Pill>
          {hw.kind === "assignment" && <Pill kind="warn">Assignment</Pill>}
        </div>
        <h2 id="hw-h" className="text-xl !text-c1">
          {hw.title}
        </h2>
        <p className="text-sm text-[#4A5A70]">{[hw.subject, hw.teacher, `${num(hw.max_marks)} marks`, `due ${dayTime(hw.due_at)}`].filter(Boolean).join(" · ")}</p>
        {hw.instructions && <p className="whitespace-pre-line text-[15px] text-brand-slate">{hw.instructions}</p>}
        {hw.attachments.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {hw.attachments.map((f) => (
              <li key={f.path}>
                <a className="s-btn2" href={fileUrl(f.path)} target="_blank" rel="noreferrer">
                  {f.name}
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="work-h" className="flex flex-col gap-3 rounded-[18px] border border-[#E3EAF3] bg-white p-[18px]">
        <h2 id="work-h" className="text-base !text-c1">
          {who === "you" ? "Your work" : `${who}'s work`}
        </h2>
        {hw.state === "marked" ? (
          <>
            <p className="font-heading text-3xl font-black text-c1">
              {num(hw.sub?.score)} <span className="text-lg text-[#4A5A70]">/ {num(hw.max_marks)}</span>
            </p>
            {hw.sub?.feedback && <p className="rounded-xl bg-[#F3FBF9] p-3 text-[15px] text-brand-slate">&quot;{hw.sub.feedback}&quot;</p>}
          </>
        ) : hw.state === "done" ? (
          <>
            <p className="text-sm text-brand-slate">
              Handed in {hw.sub?.submitted_at ? dayTime(hw.sub.submitted_at) : ""}
              {hw.sub?.late ? " (late)" : ""}. {hw.teacher ?? "Your teacher"} will mark it, and the score and feedback show here.
            </p>
            <ActionForm action={takeBack}>
              <input type="hidden" name="hw" value={hw.id} />
              <input type="hidden" name="student" value={studentId} />
              <input type="hidden" name="back" value={back} />
              <SubmitButton className="s-btn2" pending="Taking back…">
                Take back to edit
              </SubmitButton>
            </ActionForm>
          </>
        ) : paper ? (
          <p className="text-sm text-brand-slate">Hand this one in on paper in class. Your teacher will put the mark here.</p>
        ) : closed ? (
          <p className="text-sm text-brand-slate">The due date has passed and late work isn&apos;t being taken. Speak to {hw.teacher ?? "your teacher"}.</p>
        ) : (
          <HandIn hw={hw.id} student={studentId} back={back} modes={hw.submit_modes} existing={hw.sub?.files ?? []} answer={hw.sub?.answer ?? ""} note={hw.sub?.note ?? ""} />
        )}
        {hw.state !== "todo" && (hw.sub?.files.length || hw.sub?.answer) ? (
          <div className="flex flex-col gap-2 border-t border-[#EEF3F9] pt-3">
            <span className="text-xs font-bold uppercase tracking-[0.05em] text-[#4A5A70]">What was handed in</span>
            {hw.sub?.files.map((f) => (
              <a key={f.path} className="text-sm font-bold text-c1 underline" href={fileUrl(f.path)} target="_blank" rel="noreferrer">
                {f.name}
              </a>
            ))}
            {hw.sub?.answer && <p className="whitespace-pre-line text-sm text-brand-slate">{hw.sub.answer}</p>}
          </div>
        ) : null}
      </section>
    </div>
  );
}

/** A short list row linking to the homework. */
export function HomeworkRow({ hw, href }: { hw: KidHw; href: string }) {
  const overdue = hw.state === "todo" && new Date(hw.due_at) < new Date();
  const status =
    hw.state === "marked"
      ? { k: "good" as const, t: `${num(hw.sub?.score)} / ${num(hw.max_marks)}` }
      : hw.state === "done"
        ? { k: "info" as const, t: "Waiting" }
        : hw.submit_modes.join() === "paper"
          ? { k: "info" as const, t: "On paper" }
          : overdue
            ? { k: "bad" as const, t: "Overdue" }
            : { k: "warn" as const, t: "To do" };
  return (
    <li>
      <a href={href} className="flex min-h-[64px] items-center justify-between gap-3 rounded-[16px] border border-[#E3EAF3] bg-white p-3 hover:border-c2">
        <span className="min-w-0">
          <span className="block truncate font-bold text-brand-slate">{hw.title}</span>
          <span className="block text-[13px] text-[#4A5A70]">
            {hw.subject} · {hw.state === "marked" ? (hw.sub?.feedback ? `"${hw.sub.feedback.slice(0, 60)}"` : "Marked") : hw.state === "done" ? `Handed in ${hw.sub?.submitted_at ? dayTime(hw.sub.submitted_at) : ""}` : dueText(hw.due_at)}
          </span>
        </span>
        <Pill kind={status.k}>{status.t}</Pill>
      </a>
    </li>
  );
}
