import Link from "next/link";
import { Flash } from "@/components/Flash";
import { MobileShell } from "@/components/MobileShell";
import { classLabel } from "@/components/admin";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Empty, Pill } from "@/components/ui";
import { requireSchool } from "@/lib/auth";
import { PARENT_TABS } from "@/lib/nav";
import { cancelReport, reportAbsence } from "./actions";
import { sendPrivacyRequest } from "../privacy-actions";

export const metadata = { title: "Contact the school" };

type Kid = { id: string; first_name: string; classes: { name: string; arm: string; class_teacher_id: string | null } | null };
type Report = { id: string; student_id: string; from_date: string; to_date: string; reason: string };
const REASON: Record<string, string> = { unwell: "Unwell", family: "Family event", travel: "Travel", other: "Other" };
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date());
const nice = (iso: string) => new Date(`${iso}T12:00:00+01:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Africa/Lagos" });
/** 0803 123 4567 → 2348031234567 for a WhatsApp link. */
const wa = (p: string) => {
  const d = p.replace(/\D/g, "");
  return d.startsWith("0") && d.length === 11 ? `234${d.slice(1)}` : d.startsWith("234") ? d : null;
};

export default async function ParentContact(props: { searchParams: Promise<{ child?: string }> }) {
  const sp = await props.searchParams;
  const { supabase, school, user } = await requireSchool(["parent"]);
  const [{ data: rows }, { data: s }] = await Promise.all([
    supabase.from("guardians").select("students(id, first_name, classes(name, arm, class_teacher_id))").eq("school_id", school.id).eq("user_id", user.id).returns<{ students: Kid | null }[]>(),
    supabase.from("schools").select("name, phone, email, principal_name").eq("id", school.id).single<{ name: string; phone: string | null; email: string | null; principal_name: string | null }>(),
  ]);
  const kids = (rows ?? []).map((r) => r.students).filter((k): k is Kid => !!k).sort((a, b) => a.first_name.localeCompare(b.first_name));
  const kid = kids.find((k) => k.id === sp.child) ?? kids[0];
  const teacherIds = [...new Set(kids.map((k) => k.classes?.class_teacher_id).filter((x): x is string => !!x))];
  const [{ data: teachers }, { data: reports }, { data: myRequests }] = await Promise.all([
    teacherIds.length ? supabase.rpc("staff_names", { p_ids: teacherIds }).then((r) => ({ data: (r.data ?? []) as { id: string; full_name: string | null }[] })) : Promise.resolve({ data: [] as { id: string; full_name: string | null }[] }),
    kids.length ? supabase.from("absence_reports").select("id, student_id, from_date, to_date, reason").in("student_id", kids.map((k) => k.id)).gte("to_date", today()).order("from_date").returns<Report[]>() : Promise.resolve({ data: [] as Report[] }),
    supabase.from("privacy_requests").select("id, kind, status, response, created_at").eq("school_id", school.id).eq("requested_by", user.id).order("created_at", { ascending: false }).limit(10).returns<{ id: number; kind: string; status: string; response: string | null; created_at: string }[]>(),
  ]);
  const tname = new Map((teachers ?? []).map((t) => [t.id, t.full_name]));
  const whatsapp = s?.phone ? wa(s.phone) : null;
  const t = today();

  return (
    <MobileShell school={school} title="Contact the school" tabs={PARENT_TABS} active="school">
      <Flash />
      <section aria-labelledby="who-h" className="flex flex-col gap-3 rounded-[18px] border border-[#E3EAF3] bg-white p-[18px]">
        <h2 id="who-h" className="text-base !text-c1">
          Who to contact
        </h2>
        <ul className="flex flex-col gap-2 text-sm">
          {kids.map((k) =>
            k.classes ? (
              <li key={k.id} className="flex flex-col">
                <span className="font-bold text-brand-slate">{tname.get(k.classes.class_teacher_id ?? "") ?? "Class teacher not set yet"}</span>
                <span className="text-[#4A5A70]">
                  {k.first_name}&apos;s class teacher, {classLabel(k.classes.name, k.classes.arm)}
                </span>
              </li>
            ) : null,
          )}
          {s?.principal_name && (
            <li className="flex flex-col">
              <span className="font-bold text-brand-slate">{s.principal_name}</span>
              <span className="text-[#4A5A70]">Principal / Head teacher</span>
            </li>
          )}
        </ul>
        {s?.phone || s?.email ? (
          <div className="flex flex-wrap gap-2">
            {s.phone && (
              <a className="s-btn2" href={`tel:${s.phone.replace(/\s/g, "")}`}>
                Call {s.phone}
              </a>
            )}
            {whatsapp && (
              <a className="s-btn2" href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer">
                WhatsApp
              </a>
            )}
            {s.email && (
              <a className="s-btn2" href={`mailto:${s.email}`}>
                Email {s.email}
              </a>
            )}
          </div>
        ) : (
          <p className="text-sm text-[#4A5A70]">The school hasn&apos;t added a phone number or email yet.</p>
        )}
        <p className="text-[13px] text-[#4A5A70]">Messages with teachers in the app are coming in a later release.</p>
      </section>

      {kid ? (
        <section aria-labelledby="report-h" className="flex flex-col gap-3 rounded-[18px] border border-t-[5px] border-[#E3EAF3] border-t-c2 bg-white p-[18px]">
          <h2 id="report-h" className="text-base !text-c1">
            Report an absence
          </h2>
          <ActionForm action={reportAbsence} resetOnSuccess className="flex flex-col gap-3">
            {kids.length > 1 ? (
              <fieldset className="flex flex-wrap gap-2">
                <legend className="label">Child</legend>
                {kids.map((k) => (
                  <label key={k.id} className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border-[1.5px] border-[#DCE5F0] px-3 text-sm font-bold has-[:checked]:border-c2 has-[:checked]:bg-[#F3FBF9] has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-c2">
                    <input type="radio" name="child" value={k.id} defaultChecked={k.id === kid.id} className="h-4 w-4" />
                    {k.first_name}
                    {k.classes ? ` · ${classLabel(k.classes.name, k.classes.arm)}` : ""}
                  </label>
                ))}
              </fieldset>
            ) : (
              <input type="hidden" name="child" value={kid.id} />
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="ab-from">
                  From
                </label>
                <input id="ab-from" name="from" type="date" required defaultValue={t} className="sk-input" />
              </div>
              <div>
                <label className="label" htmlFor="ab-to">
                  To
                </label>
                <input id="ab-to" name="to" type="date" defaultValue={t} className="sk-input" />
              </div>
            </div>
            <fieldset className="flex flex-wrap gap-2">
              <legend className="label">Reason</legend>
              {Object.entries(REASON).map(([k, l]) => (
                <label key={k} className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border-[1.5px] border-[#DCE5F0] px-3 text-sm font-bold has-[:checked]:border-c2 has-[:checked]:bg-[#F3FBF9] has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-c2">
                  <input type="radio" name="reason" value={k} required defaultChecked={k === "unwell"} className="h-4 w-4" /> {l}
                </label>
              ))}
            </fieldset>
            <div>
              <label className="label" htmlFor="ab-note">
                Note for the class teacher <span className="font-normal text-[#4A5A70]">(optional)</span>
              </label>
              <textarea id="ab-note" name="note" rows={2} maxLength={500} className="sk-input min-h-[70px] py-3" />
            </div>
            <div>
              <SubmitButton pending="Sending…">Send to class teacher</SubmitButton>
            </div>
          </ActionForm>
          {(reports ?? []).length > 0 && (
            <div className="flex flex-col gap-1 border-t border-[#EEF3F9] pt-3">
              <span className="text-xs font-bold uppercase tracking-[0.05em] text-[#4A5A70]">Reported absences coming up</span>
              <ul className="flex flex-col">
                {(reports ?? []).map((r) => (
                  <li key={r.id} className="flex min-h-[44px] items-center justify-between gap-2 border-b border-[#EEF3F9] text-sm last:border-0">
                    <span>
                      {kids.find((k) => k.id === r.student_id)?.first_name} · {nice(r.from_date)}
                      {r.to_date !== r.from_date ? ` to ${nice(r.to_date)}` : ""} · {REASON[r.reason]}
                    </span>
                    <ActionForm action={cancelReport}>
                      <input type="hidden" name="id" value={r.id} />
                      <SubmitButton className="s-btn2" pending="…">
                        Cancel<span className="sr-only"> this report</span>
                      </SubmitButton>
                    </ActionForm>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      ) : (
        <Empty>No children are linked to your account yet.</Empty>
      )}
      <section aria-labelledby="privacy-h" id="privacy" className="flex scroll-mt-4 flex-col gap-3 rounded-[18px] border border-[#E3EAF3] bg-white p-[18px]">
        <h2 id="privacy-h" className="text-base !text-c1">
          Your family&apos;s data
        </h2>
        <p className="text-sm text-[#263449]">
          Ask the school to show you, correct or delete the data it holds about you or your child. The school&apos;s owner gets your request straight away. Read the{" "}
          <Link href="/privacy" className="font-bold text-c2 underline">
            privacy policy
          </Link>
          .
        </p>
        <ActionForm action={sendPrivacyRequest} resetOnSuccess className="flex flex-col gap-3">
          <fieldset>
            <legend className="label">What would you like?</legend>
            <div className="flex flex-col gap-1.5">
              {(
                [
                  ["access", "A copy of our data"],
                  ["correct", "Correct something that's wrong"],
                  ["delete", "Delete some data"],
                  ["object", "Stop the school using our data for something"],
                  ["other", "Something else"],
                ] as const
              ).map(([v, l], i) => (
                <label key={v} className="flex min-h-[44px] items-center gap-2 rounded-xl border-[1.5px] border-[#DCE5F0] px-3 text-sm font-semibold has-[:checked]:border-c1 has-[:checked]:bg-brand-cloud">
                  <input type="radio" name="kind" value={v} defaultChecked={i === 0} className="h-4 w-4" />
                  {l}
                </label>
              ))}
            </div>
          </fieldset>
          {kids.length > 0 && (
            <div>
              <label className="label" htmlFor="pr-child">
                About
              </label>
              <select id="pr-child" name="student" className="sk-input sk-select" defaultValue="">
                <option value="">Me (the parent)</option>
                {kids.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.first_name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="label" htmlFor="pr-details">
              Details
            </label>
            <textarea id="pr-details" name="details" rows={3} required minLength={3} maxLength={2000} className="sk-input min-h-[84px] py-3" placeholder="e.g. Chiamaka's date of birth is wrong. It should be 4 May 2016." />
          </div>
          <div>
            <SubmitButton pending="Sending…">Send to the school</SubmitButton>
          </div>
        </ActionForm>
        {(myRequests ?? []).length > 0 && (
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-extrabold text-brand-slate">Your requests</h3>
            <ul className="flex flex-col gap-2">
              {(myRequests ?? []).map((r) => (
                <li key={r.id} className="rounded-xl bg-brand-cloud p-3 text-sm">
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-bold text-brand-slate">{new Date(r.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Africa/Lagos" })}</span>
                    <Pill kind={r.status === "open" ? "warn" : r.status === "done" ? "good" : "info"}>{r.status === "open" ? "Waiting for the school" : r.status === "done" ? "Done" : "Declined"}</Pill>
                  </span>
                  {r.response && <span className="mt-1 block whitespace-pre-line text-[#263449]">{r.response}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
      <Link href="/parent/notices" className="text-sm font-bold text-c1 underline">
        School notices and events
      </Link>
    </MobileShell>
  );
}
