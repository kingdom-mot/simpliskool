import Link from "next/link";
import { AdminPage, Panel, SETUP_ROLES, classLabel, requireAdminPage } from "@/components/admin";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Empty, Pill } from "@/components/ui";
import { emailReady } from "@/lib/email";
import { addParent, inviteAllParents, inviteParent } from "./actions";

export const metadata = { title: "Parents" };

type Parent = { id: string; name: string; email: string | null; phone: string | null; joined: boolean; invited_at: string | null; children: { id: string; name: string; class: string | null; relationship: string | null }[] };
type Status = "joined" | "invited" | "none";
const LABEL: Record<Status, [string, "good" | "warn" | "info"]> = { joined: ["Joined", "good"], invited: ["Invite sent", "warn"], none: ["Not invited", "info"] };

function showPhone(p: string | null) {
  if (!p) return "—";
  const d = p.replace(/^\+?234/, "0");
  return d.length === 11 ? `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}` : p;
}

export default async function ParentsPage(props: { searchParams: Promise<{ f?: string; q?: string }> }) {
  const sp = await props.searchParams;
  const ctx = await requireAdminPage(SETUP_ROLES);
  const { supabase, school } = ctx;
  const [{ data }, { data: studs }] = await Promise.all([
    supabase.rpc("parent_list", { p_school: school.id }),
    supabase.from("students").select("id, first_name, last_name, classes(name, arm)").eq("school_id", school.id).eq("status", "active").order("first_name").returns<{ id: string; first_name: string; last_name: string; classes: { name: string; arm: string } | null }[]>(),
  ]);
  const all = (data as Parent[] | null) ?? [];
  const status = (p: Parent): Status => (p.joined ? "joined" : p.invited_at ? "invited" : "none");
  const f = (["joined", "invited", "none"] as const).find((x) => x === sp.f) ?? "all";
  const q = (sp.q ?? "").trim().toLowerCase();
  const rows = all.filter((p) => (f === "all" || status(p) === f) && (!q || `${p.name} ${p.email ?? ""} ${p.phone ?? ""} ${p.children.map((c) => c.name).join(" ")}`.toLowerCase().includes(q)));
  const notInvited = all.filter((p) => status(p) === "none").length;
  const ready = emailReady();
  const tabs: [string, string, number][] = [
    ["all", "All", all.length],
    ["joined", "Joined", all.filter((p) => status(p) === "joined").length],
    ["invited", "Invite sent", all.filter((p) => status(p) === "invited").length],
    ["none", "Not invited", notInvited],
  ];
  const href = (o: Record<string, string>) => `/admin/parents?${new URLSearchParams({ ...(q ? { q } : {}), ...o })}`;

  return (
    <AdminPage
      ctx={ctx}
      active="parents"
      crumb={[{ label: "People" }]}
      title="Parents and guardians"
      count={all.length}
      actions={
        <a className="s-btn" href="#add">
          + Add parent
        </a>
      }
    >
      {ready && notInvited > 0 && (
        <ActionForm action={inviteAllParents} className="flex flex-wrap items-center gap-3 rounded-[18px] border border-[#E3EAF3] bg-white p-4">
          <p className="text-sm text-brand-slate">{notInvited} parent{notInvited === 1 ? " hasn't" : "s haven't"} been invited to the parent app yet.</p>
          <SubmitButton pending="Sending…">Invite all not yet invited ({notInvited})</SubmitButton>
        </ActionForm>
      )}
      {!ready && <p className="rounded-xl bg-[#FFF6E3] px-4 py-3 text-sm text-[#5C4310]">Email isn&apos;t switched on yet, so invites can&apos;t be sent. Parents can still sign in at simpliskool.com with the phone number or email the school has for them.</p>}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <nav aria-label="Filter parents" className="flex flex-wrap gap-2">
          {tabs.map(([k, l, n]) => (
            <Link key={k} href={href(k === "all" ? {} : { f: k })} aria-current={f === k ? "page" : undefined} className={`flex min-h-[44px] items-center gap-2 rounded-xl border-[1.5px] px-4 text-sm font-bold ${f === k ? "border-c1 bg-c1 text-white" : "border-[#DCE5F0] bg-white text-brand-slate"}`}>
              {l}
              <span className={`rounded-full px-2 py-0.5 text-xs ${f === k ? "bg-white/20" : "bg-brand-cloud"}`}>{n}</span>
            </Link>
          ))}
        </nav>
        <form method="get" role="search" className="flex items-end gap-2">
          {f !== "all" && <input type="hidden" name="f" value={f} />}
          <div>
            <label className="label" htmlFor="p-q">
              Search parents
            </label>
            <input id="p-q" name="q" type="search" className="sk-input py-2" defaultValue={sp.q ?? ""} placeholder="Name, phone or child" />
          </div>
          <button className="s-btn2">Search</button>
        </form>
      </div>

      <Panel id="list-h" title="Parents">
        {rows.length ? (
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Parents table: scroll sideways to see more">
            <table className="tbl min-w-[860px]">
              <caption className="sr-only">Parents and guardians</caption>
              <thead>
                <tr>
                  <th scope="col">Parent</th>
                  <th scope="col">Children</th>
                  <th scope="col">Phone</th>
                  <th scope="col">Email</th>
                  <th scope="col">App</th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const st = status(p);
                  return (
                    <tr key={p.id}>
                      <th scope="row">{p.name}</th>
                      <td>
                        <ul className="flex flex-col gap-0.5">
                          {p.children.map((c) => (
                            <li key={c.id}>
                              <Link className="s-link text-sm" href={`/admin/students/${c.id}`}>
                                {c.name}
                              </Link>
                              <span className="text-xs text-[#4A5A70]"> · {c.class ?? "no class"}</span>
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td className="whitespace-nowrap">{showPhone(p.phone)}</td>
                      <td className="max-w-[220px] truncate">{p.email ?? "—"}</td>
                      <td>
                        <Pill kind={LABEL[st][1]}>{LABEL[st][0]}</Pill>
                      </td>
                      <td>
                        {st === "joined" ? (
                          p.email ? (
                            <a className="s-link text-sm" href={`mailto:${p.email}`}>
                              Email<span className="sr-only"> {p.name}</span>
                            </a>
                          ) : null
                        ) : ready && p.email ? (
                          <ActionForm action={inviteParent}>
                            <input type="hidden" name="id" value={p.id} />
                            <SubmitButton className="s-btn2" pending="Sending…">
                              {st === "invited" ? "Resend invite" : "Send invite"}
                              <span className="sr-only"> to {p.name}</span>
                            </SubmitButton>
                          </ActionForm>
                        ) : (
                          <span className="text-xs text-[#4A5A70]">{p.email ? "" : "Signs in with phone"}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>{all.length ? "No parents match." : "No parents yet. Add them here, from a student's page, or with the Excel upload."}</Empty>
        )}
      </Panel>

      <Panel id="add" title="Add a parent">
        {studs?.length ? (
          <ActionForm action={addParent} resetOnSuccess className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="label" htmlFor="ap-name">
                Full name
              </label>
              <input id="ap-name" name="name" className="sk-input" required autoComplete="off" />
            </div>
            <div>
              <label className="label" htmlFor="ap-phone">
                Phone
              </label>
              <input id="ap-phone" name="phone" type="tel" className="sk-input" autoComplete="off" placeholder="0803 123 4567" />
            </div>
            <div>
              <label className="label" htmlFor="ap-email">
                Email
              </label>
              <input id="ap-email" name="email" type="email" className="sk-input" autoComplete="off" />
            </div>
            <div>
              <label className="label" htmlFor="ap-child">
                Child
              </label>
              <select id="ap-child" name="student_id" className="sk-input sk-select" required defaultValue="">
                <option value="" disabled>
                  Choose a student
                </option>
                {studs.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.first_name} {s.last_name}
                    {s.classes ? ` · ${classLabel(s.classes.name, s.classes.arm)}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="ap-rel">
                Relationship (optional)
              </label>
              <input id="ap-rel" name="relationship" className="sk-input" maxLength={30} placeholder="Mother, Father, Guardian" />
            </div>
            <label className="flex min-h-[48px] items-center gap-2 self-end text-sm font-semibold text-brand-slate">
              <input type="checkbox" name="invite" value="1" defaultChecked={ready} disabled={!ready} className="h-5 w-5" /> Email them an invite
            </label>
            <div className="sm:col-span-2 lg:col-span-3">
              <SubmitButton>Add parent</SubmitButton>
            </div>
          </ActionForm>
        ) : (
          <Empty>Add students first, then link their parents.</Empty>
        )}
      </Panel>
    </AdminPage>
  );
}
