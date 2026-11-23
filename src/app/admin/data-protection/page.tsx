import Link from "next/link";
import { Flash } from "@/components/Flash";
import { AdminPage, Panel, requireAdminPage } from "@/components/admin";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Pager } from "@/components/ListTools";
import { Empty, Pill } from "@/components/ui";
import { LEGAL_UPDATED, LEGAL_VERSION } from "@/lib/legal";
import { linkTo, pageNum, paginate } from "@/lib/paging";
import { createAdminClient } from "@/lib/supabase/admin";
import { acceptAgreements, answerRequest, cancelDeletion, requestDeletion } from "./actions";

export const metadata = { title: "Data protection" };

type Req = { id: number; kind: string; details: string; status: "open" | "done" | "declined"; response: string | null; created_at: string; handled_at: string | null; requester_name: string | null; students: { first_name: string; last_name: string } | null };
const KIND: Record<string, string> = { access: "Copy of their data", correct: "Correct something", delete: "Delete data", object: "Stop a use of data", other: "Other question" };
const TZ = "Africa/Lagos";
const nowMs = () => Date.now();
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: TZ });

export default async function DataProtectionPage(props: { searchParams: Promise<{ show?: string; page?: string }> }) {
  const sp = await props.searchParams;
  const ctx = await requireAdminPage(["owner", "admin"]);
  const { supabase, school, membership } = ctx;
  const owner = membership.role === "owner";
  const show = sp.show === "closed" ? "closed" : "open";
  const admin = createAdminClient();
  const [{ data: acc }, { data: reqs }, { data: del }, { data: parentRows }, { count: seen }] = await Promise.all([
    supabase.from("legal_acceptances").select("document, version, accepted_at, profiles(full_name)").eq("school_id", school.id).in("document", ["terms", "dpa"]).order("accepted_at", { ascending: false }).returns<{ document: string; version: string; accepted_at: string; profiles: { full_name: string | null } | null }[]>(),
    supabase.from("privacy_requests").select("id, kind, details, status, response, created_at, handled_at, requester_name, students(first_name, last_name)").eq("school_id", school.id).order("created_at", { ascending: false }).returns<Req[]>(),
    owner ? supabase.from("school_deletion_requests").select("delete_after, requested_at, cancelled_at").eq("school_id", school.id).maybeSingle<{ delete_after: string; requested_at: string; cancelled_at: string | null }>() : Promise.resolve({ data: null }),
    admin.from("guardians").select("user_id").eq("school_id", school.id).returns<{ user_id: string }[]>(),
    admin.from("legal_acceptances").select("id", { count: "exact", head: true }).eq("school_id", school.id).eq("document", "parent_notice").eq("version", LEGAL_VERSION),
  ]);
  const current = (d: string) => (acc ?? []).find((a) => a.document === d && a.version === LEGAL_VERSION);
  const accepted = current("terms") && current("dpa");
  const earlier = !accepted && (acc ?? []).length > 0;
  const parents = new Set((parentRows ?? []).map((p) => p.user_id)).size;
  const all = reqs ?? [];
  const openCount = all.filter((r) => r.status === "open").length;
  const pg = paginate(all.filter((r) => (show === "open" ? r.status === "open" : r.status !== "open")), pageNum(sp.page), 15);
  const pending = del && !del.cancelled_at ? del : null;
  const now = nowMs();
  const daysAgo = (iso: string) => Math.floor((now - Date.parse(iso)) / 864e5);

  return (
    <AdminPage ctx={ctx} active="privacy" crumb={[{ label: "School" }]} title="Data protection">
      <Flash />
      <p className="rounded-xl bg-[#EEF3F9] px-4 py-3 text-sm text-[#173B70]">Under the Nigeria Data Protection Act 2023, your school is in charge of its records (the data controller). Simpliskool looks after them for you (the data processor).</p>

      {pending && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border-2 border-[#B42318] bg-[#FEF3F2] p-4">
          <p className="text-sm text-[#7A271A]">
            <strong>This school is booked to be deleted on {day(`${pending.delete_after}T12:00:00+01:00`)}.</strong> Every record (students, results, fees, staff and parents) will be deleted that day and can&apos;t be brought back. Download your data first.
          </p>
          <ActionForm action={cancelDeletion}>
            <SubmitButton className="s-btn2" pending="Cancelling…">
              Cancel the deletion
            </SubmitButton>
          </ActionForm>
        </div>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 xl:grid-cols-[1.4fr_1fr]">
        <div className="flex min-w-0 flex-col gap-4">
          <Panel id="req-h" title={`Privacy requests${openCount ? ` (${openCount} open)` : ""}`}>
            <p className="text-sm text-[#4A5A70]">Parents, students and staff can ask to see, correct or delete their data. Requests from the parent app arrive here. Reply to each one; the person gets your reply by email.</p>
            <nav aria-label="Requests" className="flex flex-wrap gap-2">
              {[
                ["open", `Open (${openCount})`],
                ["closed", `Answered (${all.length - openCount})`],
              ].map(([k, l]) => (
                <Link key={k} href={linkTo("/admin/data-protection", { show: k === "open" ? "" : k })} aria-current={show === k ? "page" : undefined} className={`flex min-h-[44px] items-center rounded-xl border-[1.5px] px-4 text-sm font-bold ${show === k ? "border-c1 bg-c1 text-white" : "border-[#DCE5F0] bg-white text-brand-slate"}`}>
                  {l}
                </Link>
              ))}
            </nav>
            {pg.rows.length ? (
              <ul className="flex flex-col gap-3">
                {pg.rows.map((r) => (
                  <li key={r.id} className="flex flex-col gap-2 rounded-xl border border-[#E3EAF3] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-bold text-brand-slate">
                        {KIND[r.kind] ?? r.kind}
                        {r.students ? ` · about ${r.students.first_name} ${r.students.last_name}` : ""}
                      </span>
                      {r.status === "open" ? <Pill kind={daysAgo(r.created_at) > 14 ? "bad" : "warn"}>{daysAgo(r.created_at) === 0 ? "New today" : `Waiting ${daysAgo(r.created_at)} day${daysAgo(r.created_at) === 1 ? "" : "s"}`}</Pill> : <Pill kind={r.status === "done" ? "good" : "info"}>{r.status === "done" ? "Done" : "Declined"}</Pill>}
                    </div>
                    <p className="text-xs text-[#4A5A70]">
                      From {r.requester_name ?? "someone who has since left"} · {day(r.created_at)}
                      {r.handled_at ? ` · answered ${day(r.handled_at)}` : ""}
                    </p>
                    <p className="whitespace-pre-line text-sm text-[#263449]">{r.details}</p>
                    {r.response && <p className="whitespace-pre-line rounded-lg bg-brand-cloud p-3 text-sm text-[#263449]"><strong>Your reply:</strong> {r.response}</p>}
                    {r.status === "open" ? (
                      <ActionForm action={answerRequest} className="flex flex-col gap-2">
                        <input type="hidden" name="id" value={r.id} />
                        <label className="label" htmlFor={`rsp-${r.id}`}>
                          Your reply
                        </label>
                        <textarea id={`rsp-${r.id}`} name="response" rows={3} maxLength={2000} className="sk-input min-h-[84px] py-3" placeholder="e.g. We've corrected the date of birth. You can see it in the parent app." />
                        <div className="flex flex-wrap gap-2">
                          <button type="submit" name="status" value="done" className="s-btn">
                            Mark done and send reply
                          </button>
                          <button type="submit" name="status" value="declined" className="s-btn2">
                            Decline with this reply
                          </button>
                        </div>
                      </ActionForm>
                    ) : (
                      <ActionForm action={answerRequest}>
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="status" value="open" />
                        <SubmitButton className="s-link text-sm" pending="…">
                          Reopen<span className="sr-only"> this request</span>
                        </SubmitButton>
                      </ActionForm>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>{show === "open" ? "No open requests." : "No answered requests yet."}</Empty>
            )}
            <Pager p={pg} href={(n) => linkTo("/admin/data-protection", { show: show === "open" ? "" : show, page: n })} label="Request pages" />
          </Panel>

          <Panel id="parents-h" title="Parents and the privacy notice">
            <p className="text-sm text-[#263449]">
              Parents see a short privacy notice the first time they open the parent app. <strong>{seen ?? 0}</strong> of <strong>{parents}</strong> parent{parents === 1 ? " has" : "s have"} seen it.
            </p>
            <p className="text-[13px] text-[#4A5A70]">
              Children&apos;s data needs extra care. Where you rely on consent for something optional (like photos on your website), get it from a parent or guardian. Online admission forms ask the applicant to confirm they are the child&apos;s parent or guardian.
            </p>
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Panel id="agree-h" title="Agreement with Simpliskool">
            {accepted ? (
              <p className="text-sm text-[#263449]">
                <Pill kind="good">Accepted</Pill> The <Link className="s-link" href="/terms">terms of use</Link> and <Link className="s-link" href="/dpa">data processing agreement</Link> (version of {LEGAL_UPDATED}) were accepted by {current("dpa")?.profiles?.full_name?.trim() || "the owner"} on {day(current("dpa")!.accepted_at)}.
              </p>
            ) : owner ? (
              <ActionForm action={acceptAgreements} className="flex flex-col gap-3">
                <p className="text-sm text-[#263449]">{earlier ? "The terms or the data processing agreement have changed since you last accepted them. Please read and accept the new version." : "Please read and accept these for your school. They set out how Simpliskool looks after your records."}</p>
                <label className="flex items-start gap-3 text-sm text-[#263449]">
                  <input type="checkbox" name="terms" value="1" required className="mt-0.5 h-5 w-5 flex-none" />
                  <span>
                    I accept the <Link className="s-link" href="/terms" target="_blank">terms of use</Link> for the school
                  </span>
                </label>
                <label className="flex items-start gap-3 text-sm text-[#263449]">
                  <input type="checkbox" name="dpa" value="1" required className="mt-0.5 h-5 w-5 flex-none" />
                  <span>
                    I accept the <Link className="s-link" href="/dpa" target="_blank">data processing agreement</Link> for the school
                  </span>
                </label>
                <div>
                  <SubmitButton pending="Saving…">Accept for the school</SubmitButton>
                </div>
              </ActionForm>
            ) : (
              <p className="text-sm text-[#263449]">
                <Pill kind="warn">Waiting</Pill> The school owner needs to accept the terms and data processing agreement here.
              </p>
            )}
            <p className="text-[13px] text-[#4A5A70]">
              Share our <Link className="s-link" href="/privacy">privacy policy</Link> with parents and staff. It explains what Simpliskool holds and their rights.
            </p>
          </Panel>

          {owner && (
            <Panel id="export-h" title="Download all your data">
              <p className="text-sm text-[#263449]">One Excel file with every record: students, parents, staff, classes, attendance, scores, invoices, payments, announcements and admission applications. Keep it somewhere safe; it contains children&apos;s data.</p>
              <a className="s-btn self-start" href="/admin/data-protection/export" download>
                Download everything (Excel)
              </a>
            </Panel>
          )}

          <Panel id="ndpc-h" title="Registering with the NDPC">
            <p className="text-sm text-[#263449]">
              Schools that hold data about 200 or more people in six months must register with the Nigeria Data Protection Commission and renew every year. Most primary and secondary schools do. Register at{" "}
              <a className="s-link" href="https://services.ndpc.gov.ng" target="_blank" rel="noreferrer">
                services.ndpc.gov.ng
              </a>
              .
            </p>
          </Panel>

          <Panel id="erase-h" title="Erasing a former student">
            <p className="text-sm text-[#263449]">
              When a student has left, the owner can erase their personal details from their page under <Link className="s-link" href="/admin/students?status=withdrawn">Students</Link>. Marks and payments stay, shown as &quot;Former student&quot;, so results and accounts still add up.
            </p>
          </Panel>

          {owner && !pending && (
            <Panel id="delete-h" title="Delete the school's account">
              <details>
                <summary className="s-link cursor-pointer text-sm">Delete everything from Simpliskool</summary>
                <ActionForm action={requestDeletion} className="mt-3 flex flex-col gap-3">
                  <p className="text-sm text-[#263449]">Every record will be deleted 30 days from today and can&apos;t be brought back. Until then everything keeps working and you can cancel. Download your data first.</p>
                  <div>
                    <label className="label" htmlFor="del-reason">
                      Why are you leaving? (optional)
                    </label>
                    <textarea id="del-reason" name="reason" rows={2} maxLength={1000} className="sk-input min-h-[64px] py-3" />
                  </div>
                  <div>
                    <label className="label" htmlFor="del-confirm">
                      Type the school&apos;s name to confirm: {school.name}
                    </label>
                    <input id="del-confirm" name="confirm" className="sk-input" required autoComplete="off" />
                  </div>
                  <div>
                    <SubmitButton className="s-btn-danger" pending="Sending…">
                      Delete the school in 30 days
                    </SubmitButton>
                  </div>
                </ActionForm>
              </details>
            </Panel>
          )}
        </div>
      </div>
    </AdminPage>
  );
}
