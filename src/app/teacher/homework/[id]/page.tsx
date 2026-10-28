import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHero } from "@/components/admin";
import { Flash } from "@/components/Flash";
import { ActionForm, SubmitButton } from "@/components/forms";
import { PortalShell } from "@/components/PortalShell";
import { Empty, Pill } from "@/components/ui";
import { requireSchool } from "@/lib/auth";
import { TEACHER_NAV } from "@/lib/nav";
import { asParts } from "@/lib/results";
import { CA_LABEL, classLabel, dayTime, num, type HwFile } from "@/lib/teaching";
import { deleteHomework, sendHomeworkToCa } from "../actions";
import { MarkForm } from "./MarkForm";

export const metadata = { title: "Marking" };

type Hw = {
  id: string;
  title: string;
  kind: string;
  instructions: string | null;
  max_marks: number;
  due_at: string;
  submit_modes: string[];
  attachments: HwFile[];
  ca_part: string | null;
  ca_sent_at: string | null;
  class_subjects: { class_id: string; classes: { name: string; arm: string } | null; subjects: { name: string } | null } | null;
};
type Sub = { student_id: string; status: string; answer: string | null; files: HwFile[]; note: string | null; submitted_at: string | null; late: boolean; score: number | null; feedback: string | null };

const fileUrl = (p: string) => `/api/learning-file?p=${encodeURIComponent(p)}`;

export default async function MarkHomework(props: { params: Promise<{ id: string }>; searchParams: Promise<{ s?: string }> }) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const { supabase, school, fullName } = await requireSchool(["teacher"]);
  const { data: hw } = await supabase
    .from("homework")
    .select("id, title, kind, instructions, max_marks, due_at, submit_modes, attachments, ca_part, ca_sent_at, class_subjects(class_id, classes(name, arm), subjects(name))")
    .eq("id", id)
    .maybeSingle<Hw>();
  if (!hw?.class_subjects) notFound();
  const [{ data: studs }, { data: subs }, { data: partsRaw }] = await Promise.all([
    supabase.from("students").select("id, first_name, last_name").eq("class_id", hw.class_subjects.class_id).eq("status", "active").order("last_name").order("first_name").returns<{ id: string; first_name: string; last_name: string }[]>(),
    supabase.from("homework_submissions").select("student_id, status, answer, files, note, submitted_at, late, score, feedback").eq("homework_id", id).returns<Sub[]>(),
    supabase.rpc("assessment_parts", { p_school: school.id }),
  ]);
  const byStudent = new Map((subs ?? []).map((s) => [s.student_id, s]));
  const paper = hw.submit_modes.join() === "paper";
  const students = (studs ?? []).map((s) => {
    const sub = byStudent.get(s.id);
    const state = sub?.status === "marked" ? "marked" : sub?.status === "submitted" ? (sub.late ? "late" : "tomark") : paper ? "paper" : "missing";
    return { ...s, name: `${s.first_name} ${s.last_name}`, sub, state };
  });
  // Work that's in comes first, then the rest.
  const order = { tomark: 0, late: 1, paper: 2, marked: 3, missing: 4 } as const;
  students.sort((a, b) => order[a.state as keyof typeof order] - order[b.state as keyof typeof order]);
  const toMark = students.filter((s) => s.state === "tomark" || s.state === "late" || s.state === "paper");
  const cur = students.find((s) => s.id === sp.s) ?? toMark[0] ?? students[0];
  const next = toMark.find((s) => s.id !== cur?.id)?.id ?? null;
  const markedCount = students.filter((s) => s.state === "marked").length;
  const handedIn = students.filter((s) => s.sub && s.sub.status !== "draft").length;
  const className = classLabel(hw.class_subjects.classes?.name ?? "", hw.class_subjects.classes?.arm);
  const part = hw.ca_part ? asParts(partsRaw).find((p) => p.key === hw.ca_part) : null;
  const PILL: Record<string, { k: "good" | "warn" | "bad" | "info"; t: (s: (typeof students)[number]) => string }> = {
    marked: { k: "good", t: (s) => `${num(s.sub?.score)}/${num(hw.max_marks)}` },
    tomark: { k: "warn", t: () => "To mark" },
    late: { k: "bad", t: () => "Late" },
    paper: { k: "info", t: () => "On paper" },
    missing: { k: "info", t: () => "Not handed in" },
  };

  return (
    <PortalShell school={school} roleLabel="Teacher" fullName={fullName} groups={TEACHER_NAV} active="homework">
      <div className="flex flex-col gap-5">
        <PageHero
          title={hw.title}
          sub={
            <>
              <Link href="/teacher/homework" className="font-semibold text-white underline underline-offset-2">
                Homework
              </Link>{" "}
              / {className} · {hw.class_subjects.subjects?.name} · due {dayTime(hw.due_at)}
            </>
          }
        />
        <Flash />
        <p className="-mt-2 text-sm text-[#4A5A70]">
          {markedCount} of {students.length} marked
          {paper ? " · handed in on paper" : ` · ${handedIn} handed in, ${students.length - handedIn} still to hand in`}
        </p>
        {!students.length ? (
          <Empty>No students in {className}.</Empty>
        ) : (
          <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
            <nav aria-label="Students" className="rounded-[18px] border border-[#E3EAF3] bg-white p-2">
              <ul className="flex max-h-[70vh] flex-col overflow-y-auto">
                {students.map((s) => (
                  <li key={s.id}>
                    <Link href={`/teacher/homework/${hw.id}?s=${s.id}`} aria-current={s.id === cur?.id ? "true" : undefined} className={`flex min-h-[48px] items-center justify-between gap-2 rounded-xl px-3 text-sm ${s.id === cur?.id ? "bg-[#F3FBF9] font-extrabold text-c1" : "text-brand-slate hover:bg-brand-cloud"}`}>
                      <span className="truncate">{s.name}</span>
                      <Pill kind={PILL[s.state].k}>{PILL[s.state].t(s)}</Pill>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            {cur && (
              <section aria-labelledby="cur-h" className="flex flex-col gap-4 rounded-[18px] border border-t-[5px] border-[#E3EAF3] border-t-c2 bg-white p-[22px]">
                <div>
                  <h2 id="cur-h" className="text-lg !text-c1">
                    {cur.name}
                  </h2>
                  <p className="text-sm text-[#4A5A70]">{cur.sub?.submitted_at ? `Handed in ${dayTime(cur.sub.submitted_at)}${cur.sub.late ? " (late)" : ""}` : paper ? "Handed in on paper" : "Not handed in yet. You can still give a mark."}</p>
                </div>
                {cur.sub?.files.length ? (
                  <ul className="flex flex-col gap-3">
                    {cur.sub.files.map((f) =>
                      f.type.startsWith("image/") ? (
                        <li key={f.path}>
                          <a href={fileUrl(f.path)} target="_blank" rel="noreferrer" className="block">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={fileUrl(f.path)} alt={`${cur.name}'s work: ${f.name}`} className="max-h-[520px] w-full rounded-xl border border-[#E3EAF3] bg-brand-cloud object-contain" />
                          </a>
                        </li>
                      ) : (
                        <li key={f.path}>
                          <a className="s-btn2" href={fileUrl(f.path)} target="_blank" rel="noreferrer">
                            Open {f.name}
                          </a>
                        </li>
                      ),
                    )}
                  </ul>
                ) : null}
                {cur.sub?.answer && (
                  <div className="rounded-xl bg-brand-cloud p-4">
                    <span className="text-xs font-bold uppercase tracking-[0.05em] text-[#4A5A70]">Typed answer</span>
                    <p className="whitespace-pre-line text-sm text-brand-slate">{cur.sub.answer}</p>
                  </div>
                )}
                {cur.sub?.note && <p className="text-sm text-brand-slate">Note from {cur.first_name}: &quot;{cur.sub.note}&quot;</p>}
                <MarkForm key={cur.id} hw={hw.id} student={cur.id} next={next} max={Number(hw.max_marks)} score={cur.sub?.score !== null && cur.sub?.score !== undefined ? num(cur.sub.score) : ""} feedback={cur.sub?.feedback ?? ""} name={cur.first_name} />
              </section>
            )}
          </div>
        )}

        <section aria-labelledby="about-h" className="flex flex-col gap-3 rounded-[18px] border border-[#E3EAF3] bg-white p-[22px]">
          <h2 id="about-h" className="text-lg !text-c1">
            About this {hw.kind === "assignment" ? "assignment" : "homework"}
          </h2>
          {hw.instructions && <p className="whitespace-pre-line text-sm text-brand-slate">{hw.instructions}</p>}
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
          {part && (
            <ActionForm action={sendHomeworkToCa} className="flex flex-col gap-2 rounded-xl bg-brand-cloud p-4">
              <input type="hidden" name="id" value={hw.id} />
              <p className="text-sm text-brand-slate">
                Counts toward {part.label ?? CA_LABEL[part.key]} (out of {num(part.max)}). Marks are scaled from {num(hw.max_marks)}.{hw.ca_sent_at ? ` Last sent ${dayTime(hw.ca_sent_at)}.` : ""}
              </p>
              <div>
                <SubmitButton pending="Sending…">{hw.ca_sent_at ? `Send marks to ${part.label} again` : `Send marks to ${part.label}`}</SubmitButton>
              </div>
            </ActionForm>
          )}
          <ActionForm action={deleteHomework}>
            <input type="hidden" name="id" value={hw.id} />
            <SubmitButton className="s-btn-danger" pending="Deleting…">
              Delete this {hw.kind === "assignment" ? "assignment" : "homework"}
            </SubmitButton>
          </ActionForm>
        </section>
      </div>
    </PortalShell>
  );
}
