import Link from "next/link";
import { AdminPage, Panel, SETUP_ROLES, classLabel, requireAdminPage } from "@/components/admin";
import { Flash } from "@/components/Flash";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Empty, Pill } from "@/components/ui";
import { loadClasses } from "@/lib/results-load";
import { declineApplication, enrolApplicant, inviteToAssessment, saveNotes, sendOffer } from "./actions";

export const metadata = { title: "Admissions" };

type App = {
  id: string;
  ref_no: number | null;
  child_name: string;
  date_of_birth: string | null;
  gender: string | null;
  class_applied: string | null;
  previous_school: string | null;
  parent_name: string;
  parent_phone: string;
  parent_email: string | null;
  notes: string | null;
  admin_notes: string | null;
  status: "new" | "assessment" | "offer" | "enrolled" | "declined";
  assessment_at: string | null;
  student_id: string | null;
  created_at: string;
};
const TABS = [
  ["new", "New"],
  ["assessment", "Assessment"],
  ["offer", "Offer sent"],
  ["enrolled", "Enrolled"],
  ["declined", "Declined"],
] as const;
const PILL = { new: "info", assessment: "warn", offer: "warn", enrolled: "good", declined: "bad" } as const;
const TZ = "Africa/Lagos";
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: TZ });

export default async function AdmissionsPage(props: { searchParams: Promise<{ tab?: string; app?: string }> }) {
  const sp = await props.searchParams;
  const ctx = await requireAdminPage(SETUP_ROLES);
  const { supabase, school } = ctx;
  const [{ data }, classes] = await Promise.all([
    supabase
      .from("admission_applications")
      .select("id, ref_no, child_name, date_of_birth, gender, class_applied, previous_school, parent_name, parent_phone, parent_email, notes, admin_notes, status, assessment_at, student_id, created_at")
      .eq("school_id", school.id)
      .order("created_at", { ascending: false })
      .returns<App[]>(),
    loadClasses(supabase, school.id),
  ]);
  const apps = data ?? [];
  const tab = (TABS.find(([k]) => k === sp.tab)?.[0] ?? "new") as App["status"];
  const list = apps.filter((a) => a.status === tab);
  const sel = apps.find((a) => a.id === sp.app) ?? list[0];
  const q = (o: Record<string, string>) => `/admin/admissions?${new URLSearchParams(o)}`;
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "simpliskool.com";
  const age = (dob: string | null) => (dob ? new Date(`${dob}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "Not given");
  const matching = sel?.class_applied ? classes.filter((c) => c.name.toLowerCase() === sel.class_applied!.toLowerCase().trim() || classLabel(c.name, c.arm).toLowerCase() === sel.class_applied!.toLowerCase().trim()) : [];

  return (
    <AdminPage
      ctx={ctx}
      active="admissions"
      crumb={[{ label: "People" }]}
      title="Admission applications"
      actions={
        <a className="s-btn2" href={`https://${school.slug}.${rootDomain}#admissions`}>
          View the online form
        </a>
      }
    >
      <Flash />
      <nav aria-label="Application status" className="flex flex-wrap gap-2">
        {TABS.map(([k, label]) => {
          const n = apps.filter((a) => a.status === k).length;
          return (
            <Link key={k} href={q({ tab: k })} aria-current={tab === k ? "page" : undefined} className={`flex min-h-[44px] items-center gap-2 rounded-xl border-[1.5px] px-4 text-sm font-bold ${tab === k ? "border-c1 bg-c1 text-white" : "border-[#DCE5F0] bg-white text-brand-slate"}`}>
              {label}
              <span className={`rounded-full px-2 py-0.5 text-xs ${tab === k ? "bg-white/20" : "bg-brand-cloud"}`}>{n}</span>
            </Link>
          );
        })}
      </nav>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <nav aria-label="Applications" className="flex flex-col gap-1 rounded-[18px] border border-[#E3EAF3] bg-white p-2">
          {list.length ? (
            list.map((a) => (
              <Link key={a.id} href={q({ tab, app: a.id })} aria-current={sel?.id === a.id ? "page" : undefined} className={`flex flex-col rounded-xl px-3 py-2.5 ${sel?.id === a.id ? "bg-brand-cloud" : ""}`}>
                <span className="flex items-center justify-between gap-2">
                  <span className={`font-bold ${sel?.id === a.id ? "text-c1" : "text-brand-slate"}`}>{a.child_name}</span>
                  <Pill kind={PILL[a.status]}>{TABS.find(([k]) => k === a.status)?.[1]}</Pill>
                </span>
                <span className="text-xs text-[#4A5A70]">
                  For {a.class_applied || "a class"} · applied {day(a.created_at)}
                </span>
              </Link>
            ))
          ) : (
            <p className="p-3 text-sm text-[#4A5A70]">No applications here.</p>
          )}
        </nav>

        {sel ? (
          <Panel id="app-h" title={sel.child_name} actions={<Pill kind={PILL[sel.status]}>{TABS.find(([k]) => k === sel.status)?.[1]}</Pill>}>
            <p className="-mt-2 text-sm text-[#4A5A70]">
              Applying for {sel.class_applied || "a class"} · Ref APP-{String(sel.ref_no ?? 0).padStart(4, "0")} · applied {day(sel.created_at)}
              {sel.assessment_at ? ` · assessment ${new Date(sel.assessment_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: TZ })}` : ""}
            </p>
            <dl className="grid grid-cols-[minmax(0,1fr)] gap-3 text-sm sm:grid-cols-2">
              {[
                ["Date of birth", age(sel.date_of_birth)],
                ["Gender", sel.gender ? (sel.gender === "male" ? "Male" : "Female") : "Not given"],
                ["Current school", sel.previous_school || "Not given"],
                ["Parent", sel.parent_name],
                ["Parent phone", sel.parent_phone],
                ["Parent email", sel.parent_email || "Not given"],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs font-bold uppercase tracking-[0.05em] text-[#4A5A70]">{k}</dt>
                  <dd className="font-semibold text-brand-slate">
                    {k === "Parent phone" ? <a className="s-link" href={`tel:${v.replace(/\s/g, "")}`}>{v}</a> : k === "Parent email" && sel.parent_email ? <a className="s-link" href={`mailto:${v}`}>{v}</a> : v}
                  </dd>
                </div>
              ))}
            </dl>
            {sel.notes && (
              <div className="rounded-xl bg-brand-cloud p-3 text-sm">
                <span className="block text-xs font-bold uppercase tracking-[0.05em] text-[#4A5A70]">From the parent</span>
                <p className="whitespace-pre-line">{sel.notes}</p>
              </div>
            )}
            <ActionForm action={saveNotes} key={`n-${sel.id}`} className="flex flex-col gap-2">
              <input type="hidden" name="id" value={sel.id} />
              <label className="label" htmlFor="ad-notes">
                Notes for the admissions team
              </label>
              <textarea id="ad-notes" name="admin_notes" rows={3} maxLength={2000} className="sk-input min-h-[90px] py-3" defaultValue={sel.admin_notes ?? ""} />
              <div>
                <SubmitButton className="s-btn2">Save notes</SubmitButton>
              </div>
            </ActionForm>

            {sel.status === "enrolled" ? (
              <p className="rounded-xl bg-[#E7F6F2] px-4 py-3 text-sm font-semibold text-[#0B6B5A]">
                Enrolled.{" "}
                {sel.student_id && (
                  <Link className="s-link" href={`/admin/students/${sel.student_id}`}>
                    Open {sel.child_name.split(" ")[0]}&apos;s student page
                  </Link>
                )}
              </p>
            ) : (
              <div className="grid grid-cols-[minmax(0,1fr)] gap-3 xl:grid-cols-2">
                {(sel.status === "new" || sel.status === "assessment") && (
                  <ActionForm action={inviteToAssessment} key={`a-${sel.id}`} className="flex flex-col gap-2 rounded-xl border border-[#E3EAF3] p-3">
                    <input type="hidden" name="id" value={sel.id} />
                    <h3 className="text-base !text-c1">{sel.status === "assessment" ? "Change the assessment" : "Invite to assessment"}</h3>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="label" htmlFor="as-date">
                          Date
                        </label>
                        <input id="as-date" name="date" type="date" className="sk-input" required />
                      </div>
                      <div>
                        <label className="label" htmlFor="as-time">
                          Time
                        </label>
                        <input id="as-time" name="time" type="time" className="sk-input" defaultValue="09:00" />
                      </div>
                    </div>
                    <label className="label" htmlFor="as-bring">
                      What to bring
                    </label>
                    <input id="as-bring" name="bring" className="sk-input" maxLength={300} defaultValue="Please bring the child's last school report, birth certificate and two passport photographs." />
                    <div>
                      <SubmitButton pending="Sending…">Invite to assessment</SubmitButton>
                    </div>
                  </ActionForm>
                )}
                {(sel.status === "new" || sel.status === "assessment") && (
                  <ActionForm action={sendOffer} key={`o-${sel.id}`} className="flex flex-col gap-2 rounded-xl border border-[#E3EAF3] p-3">
                    <input type="hidden" name="id" value={sel.id} />
                    <h3 className="text-base !text-c1">Offer a place</h3>
                    <p className="text-sm text-[#4A5A70]">The parent is emailed an offer of admission.</p>
                    <div>
                      <SubmitButton pending="Sending…">Send offer</SubmitButton>
                    </div>
                  </ActionForm>
                )}
                {sel.status !== "declined" && (
                  <ActionForm action={enrolApplicant} key={`e-${sel.id}`} className="flex flex-col gap-2 rounded-xl border-[1.5px] border-c2 bg-[#F3FBF9] p-3">
                    <input type="hidden" name="id" value={sel.id} />
                    <h3 className="text-base !text-c1">Enrol</h3>
                    <label className="label" htmlFor="en-class">
                      Class
                    </label>
                    <select id="en-class" name="class_id" className="sk-input sk-select" required defaultValue={matching.length === 1 ? matching[0].id : ""}>
                      <option value="" disabled>
                        Choose a class
                      </option>
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {classLabel(c.name, c.arm)}
                        </option>
                      ))}
                    </select>
                    <p className="text-[13px] text-[#4A5A70]">Creates the student with the next admission number, and the parent&apos;s account linked to them.</p>
                    <div>
                      <SubmitButton pending="Enrolling…">Mark as enrolled</SubmitButton>
                    </div>
                  </ActionForm>
                )}
                {sel.status !== "declined" && (
                  <ActionForm action={declineApplication} key={`d-${sel.id}`} className="flex flex-col gap-2 rounded-xl border border-[#E3EAF3] p-3">
                    <input type="hidden" name="id" value={sel.id} />
                    <h3 className="text-base !text-c1">Decline</h3>
                    <label className="flex min-h-[44px] items-center gap-2 text-sm font-semibold text-brand-slate">
                      <input type="checkbox" name="notify" value="1" defaultChecked className="h-5 w-5" /> Email the parent
                    </label>
                    <div>
                      <SubmitButton className="s-btn-danger" pending="Declining…">
                        Decline
                      </SubmitButton>
                    </div>
                  </ActionForm>
                )}
              </div>
            )}
            <p className="text-[13px] text-[#4A5A70]">Each step emails the parent when they gave an email. Text messages come when SMS is switched on.</p>
          </Panel>
        ) : (
          <Empty>No application selected.</Empty>
        )}
      </div>
    </AdminPage>
  );
}
