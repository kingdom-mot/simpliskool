import Link from "next/link";
import { Flash } from "@/components/Flash";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Box, SuperShell } from "@/components/super";
import { Empty, Pill } from "@/components/ui";
import { requirePlatform } from "@/lib/platform";
import { deleteSchoolNow, logIncident, updateIncident } from "./actions";

export const metadata = { title: "Data protection — Simpliskool back office" };

type Incident = { id: number; title: string; detected_at: string; description: string | null; schools_affected: string | null; people_affected: number | null; high_risk: boolean; contained_at: string | null; ndpc_notified_at: string | null; schools_notified_at: string | null; closed_at: string | null; notes: string | null };
const TZ = "Africa/Lagos";
const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true, timeZone: TZ });
const dayOf = (d: string) => new Date(`${d}T12:00:00+01:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: TZ });
const lagosToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
const nowMs = () => Date.now();

export default async function SuperPrivacy() {
  const ctx = await requirePlatform("privacy");
  const now = nowMs();
  const today = lagosToday();
  const [{ data: dels }, { data: incidents }] = await Promise.all([
    ctx.admin.from("school_deletion_requests").select("school_id, reason, requested_at, delete_after, cancelled_at, schools(name, is_demo), profiles(full_name)").order("delete_after").returns<{ school_id: string; reason: string | null; requested_at: string; delete_after: string; cancelled_at: string | null; schools: { name: string; is_demo: boolean } | null; profiles: { full_name: string | null } | null }[]>(),
    ctx.admin.from("data_incidents").select("*").order("detected_at", { ascending: false }).limit(100).returns<Incident[]>(),
  ]);
  const pending = (dels ?? []).filter((d) => !d.cancelled_at && d.schools && !d.schools.is_demo);
  const cancelled = (dels ?? []).filter((d) => d.cancelled_at).slice(0, 10);
  const open = (incidents ?? []).filter((i) => !i.closed_at);
  const closed = (incidents ?? []).filter((i) => i.closed_at);
  const deadline = (i: Incident) => Date.parse(i.detected_at) + 72 * 3_600_000;
  const hoursLeft = (i: Incident) => Math.round((deadline(i) - now) / 3_600_000);

  return (
    <SuperShell ctx={ctx} active="privacy" title="Data protection" sub="Schools leaving Simpliskool, and the breach register required by the Nigeria Data Protection Act.">
      <Flash />

      <Box id="del-h" title={`Schools asking to be deleted${pending.length ? ` (${pending.length})` : ""}`}>
        <p className="text-sm text-[#4A5A70]">The owner asked from Data protection in their portal. Delete on or after the date shown; until then the owner can cancel. Deleting removes every record, every file, and sign-ins nobody else uses.</p>
        {pending.length ? (
          <ul className="flex flex-col gap-3">
            {pending.map((d) => {
              const due = d.delete_after <= today;
              return (
                <li key={d.school_id} className="flex flex-col gap-2 rounded-xl border border-[#E3EAF3] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link className="font-bold text-[#173B70] underline" href={`/super/schools/${d.school_id}`}>
                      {d.schools?.name}
                    </Link>
                    <Pill kind={due ? "bad" : "warn"}>{due ? "Due for deletion" : `Delete on ${dayOf(d.delete_after)}`}</Pill>
                  </div>
                  <p className="text-xs text-[#4A5A70]">
                    Asked by {d.profiles?.full_name?.trim() || "the owner"} on {when(d.requested_at)}
                    {d.reason ? ` · "${d.reason}"` : ""}
                  </p>
                  {due && (
                    <details>
                      <summary className="cursor-pointer text-sm font-bold text-[#B42318] underline">Delete {d.schools?.name} now</summary>
                      <ActionForm action={deleteSchoolNow} className="mt-2 flex max-w-[480px] flex-col gap-2">
                        <input type="hidden" name="school_id" value={d.school_id} />
                        <label className="label" htmlFor={`dc-${d.school_id}`}>
                          Type the school&apos;s name to confirm
                        </label>
                        <input id={`dc-${d.school_id}`} name="confirm" className="sk-input" required autoComplete="off" />
                        <SubmitButton className="s-btn-danger self-start" pending="Deleting…">
                          Delete everything
                        </SubmitButton>
                      </ActionForm>
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty>No schools are waiting to be deleted.</Empty>
        )}
        {cancelled.length > 0 && <p className="text-[13px] text-[#4A5A70]">Recently cancelled: {cancelled.map((c) => c.schools?.name).join(", ")}.</p>}
      </Box>

      <Box id="inc-h" title={`Breach register${open.length ? ` (${open.length} open)` : ""}`}>
        <p className="text-sm text-[#4A5A70]">
          Log any loss, theft or wrong access to personal data as soon as it&apos;s found. Tell affected schools within 24 hours (our data processing agreement). The school, or we where we&apos;re in charge of the data, must tell the NDPC within 72 hours of finding it, and tell people directly if the risk to them is high.
        </p>
        {open.map((i) => {
          const left = hoursLeft(i);
          return (
            <article key={i.id} aria-labelledby={`inc-${i.id}`} className="flex flex-col gap-2 rounded-xl border-2 border-[#F2D99B] bg-[#FFFBF0] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 id={`inc-${i.id}`} className="text-base !text-[#173B70]">
                  #{i.id} {i.title}
                </h3>
                {i.ndpc_notified_at ? <Pill kind="good">NDPC told {when(i.ndpc_notified_at)}</Pill> : <Pill kind={left <= 24 ? "bad" : "warn"}>{left > 0 ? `NDPC deadline in ${left} hours` : `NDPC deadline passed ${-left} hours ago`}</Pill>}
              </div>
              <p className="text-xs text-[#4A5A70]">
                Found {when(i.detected_at)} · NDPC deadline {when(new Date(deadline(i)).toISOString())}
                {i.people_affected !== null ? ` · about ${i.people_affected} ${i.people_affected === 1 ? "person" : "people"}` : ""}
                {i.high_risk ? " · high risk: tell people directly" : ""}
              </p>
              {i.description && <p className="whitespace-pre-line text-sm text-[#263449]">{i.description}</p>}
              {i.schools_affected && <p className="text-sm text-[#263449]"><strong>Schools:</strong> {i.schools_affected}</p>}
              <ul className="grid grid-cols-[minmax(0,1fr)] gap-2 text-sm sm:grid-cols-2">
                {(
                  [
                    ["schools", "Schools told", i.schools_notified_at],
                    ["contained", "Contained", i.contained_at],
                    ["ndpc", "NDPC told", i.ndpc_notified_at],
                  ] as const
                ).map(([k, l, at]) => (
                  <li key={k} className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2">
                    <span>
                      {l}: {at ? <strong>{when(at)}</strong> : <span className="text-[#7A5300]">not yet</span>}
                    </span>
                    {!at && (
                      <ActionForm action={updateIncident}>
                        <input type="hidden" name="id" value={i.id} />
                        <input type="hidden" name="step" value={k} />
                        <SubmitButton className="s-btn2 !min-h-[40px] px-3" pending="…">
                          Done now<span className="sr-only">: {l}</span>
                        </SubmitButton>
                      </ActionForm>
                    )}
                  </li>
                ))}
              </ul>
              <ActionForm action={updateIncident} className="flex flex-col gap-2">
                <input type="hidden" name="id" value={i.id} />
                <input type="hidden" name="step" value="notes" />
                <label className="label" htmlFor={`in-${i.id}`}>
                  Notes (what happened, what was done, who was told)
                </label>
                <textarea id={`in-${i.id}`} name="notes" rows={3} maxLength={5000} defaultValue={i.notes ?? ""} className="sk-input min-h-[84px] py-3" />
                <div className="flex flex-wrap gap-2">
                  <SubmitButton className="s-btn2" pending="Saving…">
                    Save notes
                  </SubmitButton>
                </div>
              </ActionForm>
              <ActionForm action={updateIncident}>
                <input type="hidden" name="id" value={i.id} />
                <input type="hidden" name="step" value="closed" />
                <SubmitButton className="s-link text-sm" pending="…">
                  Close this incident
                </SubmitButton>
              </ActionForm>
            </article>
          );
        })}
        <details className="rounded-xl border border-[#E3EAF3] p-4" open={!open.length && !closed.length ? false : undefined}>
          <summary className="cursor-pointer font-bold text-[#173B70]">Log a new incident</summary>
          <ActionForm action={logIncident} className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label" htmlFor="ni-title">
                What happened, in a few words
              </label>
              <input id="ni-title" name="title" className="sk-input" required maxLength={200} placeholder="e.g. Report cards emailed to the wrong parent" />
            </div>
            <div>
              <label className="label" htmlFor="ni-at">
                When it was found
              </label>
              <input id="ni-at" name="detected_at" type="datetime-local" className="sk-input" required />
            </div>
            <div>
              <label className="label" htmlFor="ni-people">
                About how many people (optional)
              </label>
              <input id="ni-people" name="people_affected" inputMode="numeric" className="sk-input" />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="ni-schools">
                Schools affected
              </label>
              <input id="ni-schools" name="schools_affected" className="sk-input" maxLength={2000} />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="ni-desc">
                Details
              </label>
              <textarea id="ni-desc" name="description" rows={3} maxLength={5000} className="sk-input min-h-[84px] py-3" />
            </div>
            <label className="flex min-h-[44px] items-center gap-2 text-sm font-semibold text-[#263449] sm:col-span-2">
              <input type="checkbox" name="high_risk" value="1" className="h-5 w-5" /> High risk to people (they must be told directly)
            </label>
            <div className="sm:col-span-2">
              <SubmitButton pending="Saving…">Log incident</SubmitButton>
            </div>
          </ActionForm>
        </details>
        {closed.length > 0 && (
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Closed incidents: scroll sideways to see more">
            <table className="tbl min-w-[700px]">
              <caption className="sr-only">Closed incidents</caption>
              <thead>
                <tr>
                  <th scope="col">Incident</th>
                  <th scope="col">Found</th>
                  <th scope="col">NDPC told</th>
                  <th scope="col">Closed</th>
                </tr>
              </thead>
              <tbody>
                {closed.map((i) => (
                  <tr key={i.id}>
                    <th scope="row">
                      #{i.id} {i.title}
                    </th>
                    <td>{when(i.detected_at)}</td>
                    <td>{i.ndpc_notified_at ? when(i.ndpc_notified_at) : "Not needed"}</td>
                    <td>{when(i.closed_at!)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Box>

      <Box id="ours-h" title="Dream Savvy's own obligations">
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-[#263449]">
          <li>Register with the NDPC as a data processor of major importance (services.ndpc.gov.ng) and renew every year.</li>
          <li>Appoint a data protection officer and file the yearly compliance audit return through a licensed DPCO if our tier requires it.</li>
          <li>Keep the list of services we use (sub-processors) up to date on the privacy policy, and tell schools 30 days before adding one.</li>
          <li>Have the privacy policy, terms and data processing agreement reviewed by a Nigerian data protection lawyer.</li>
        </ul>
      </Box>
    </SuperShell>
  );
}
