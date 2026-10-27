import { AdminPage, Panel, requireAdminPage, SETUP_ROLES } from "@/components/admin";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Empty, Pill } from "@/components/ui";
import { personInitials } from "@/lib/format";
import { ROLE_LABEL, type Role } from "@/lib/auth";
import { changeRole, inviteStaff, removeStaff, resendInvite } from "./actions";

type StaffRow = { user_id: string; full_name: string | null; email: string | null; phone: string | null; roles: Role[]; joined: boolean; class_teacher_of: string[]; teaches: string[] };

const ROLE_HINT: Record<string, string> = {
  teacher: "Takes registers, enters scores, writes lesson notes",
  bursar: "Fees, payments and payroll only",
  principal: "Everything academic; approves results and lesson notes",
  admin: "Runs the school setup, like the owner",
};
const AVATAR = ["#CFF3EC", "#D9E7FF", "#FFEDC2", "#EADBFF", "#FFDDEB", "#D3F8E2"];

export default async function StaffPage() {
  const ctx = await requireAdminPage([...SETUP_ROLES]);
  const { supabase, school, membership, user } = ctx;
  const { data } = await supabase.rpc("staff_list", { p_school: school.id });
  const staff = (data as StaffRow[] | null) ?? [];
  const grantable = (["teacher", "bursar", "principal", "admin"] as const).filter((r) => membership.role !== "principal" || r === "teacher" || r === "bursar");

  return (
    <AdminPage ctx={ctx} active="staff" crumb={[{ label: "People" }]} title="Staff" count={staff.length}>
      <Panel id="inv-h" title="Invite a staff member">
        <ActionForm action={inviteStaff} resetOnSuccess className="flex flex-col gap-4">
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="i-name">Full name</label>
              <input className="sk-input" id="i-name" name="name" required autoComplete="off" placeholder="e.g. Mrs Ngozi Okafor" />
            </div>
            <div>
              <label className="label" htmlFor="i-email">Email</label>
              <input className="sk-input" id="i-email" name="email" type="email" required autoComplete="off" aria-describedby="i-email-hint" />
              <p id="i-email-hint" className="mt-1 text-[13px] text-[#4A5A70]">We send their sign-in link here.</p>
            </div>
            <div>
              <label className="label" htmlFor="i-phone">Phone (optional)</label>
              <input className="sk-input" id="i-phone" name="phone" type="tel" autoComplete="off" placeholder="08031234567" />
            </div>
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="label">Role</legend>
            <div className="grid grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-2">
              {grantable.map((r) => (
                <label key={r} className="flex min-h-[56px] cursor-pointer items-start gap-3 rounded-xl border-[1.5px] border-[#DCE5F0] p-3 has-[:checked]:border-c2">
                  <input type="radio" name="role" value={r} defaultChecked={r === "teacher"} className="mt-1 h-5 w-5 accent-[var(--c2,#0B7D6E)]" />
                  <span>
                    <strong className="block text-brand-slate">{ROLE_LABEL[r]}</strong>
                    <span className="block text-[13px] text-[#4A5A70]">{ROLE_HINT[r]}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <SubmitButton pending="Sending invite…">Send invite</SubmitButton>
          </div>
        </ActionForm>
      </Panel>

      <Panel id="list-h" title="Everyone on staff">
        {staff.length ? (
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Table: scroll sideways to see more">
            <table className="tbl min-w-[860px]">
              <caption className="sr-only">Staff and their roles</caption>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Role</th>
                  <th scope="col">Class teacher of</th>
                  <th scope="col">Teaches</th>
                  <th scope="col">Status</th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {staff.map((s, i) => {
                  const name = s.full_name?.trim() || s.email || "Unnamed";
                  const main = (["owner", "admin", "principal", "bursar", "teacher"] as Role[]).find((r) => s.roles.includes(r))!;
                  const isMe = s.user_id === user.id;
                  const editable = !isMe && main !== "owner" && (membership.role !== "principal" || main === "teacher" || main === "bursar");
                  return (
                    <tr key={s.user_id}>
                      <th scope="row">
                        <span className="flex items-center gap-2.5">
                          <span aria-hidden="true" className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-xs font-extrabold text-[#1B2433]" style={{ background: AVATAR[i % AVATAR.length] }}>
                            {personInitials(name)}
                          </span>
                          <span>
                            <span className="block font-bold text-c1">
                              {name}
                              {isMe ? " (you)" : ""}
                            </span>
                            <span className="block text-[13px] font-normal text-[#4A5A70]">{s.email}</span>
                          </span>
                        </span>
                      </th>
                      <td>
                        {editable ? (
                          <ActionForm action={changeRole} className="flex items-center gap-2">
                            <input type="hidden" name="user_id" value={s.user_id} />
                            <input type="hidden" name="from" value={main} />
                            <label className="sr-only" htmlFor={`role-${s.user_id}`}>
                              Role for {name}
                            </label>
                            <select className="sk-input sk-select min-w-[150px] py-2" id={`role-${s.user_id}`} name="role" defaultValue={main}>
                              {grantable.map((r) => (
                                <option key={r} value={r}>
                                  {ROLE_LABEL[r]}
                                </option>
                              ))}
                            </select>
                            <SubmitButton className="s-btn2 min-h-[40px] px-3" pending="…">
                              Save<span className="sr-only"> role for {name}</span>
                            </SubmitButton>
                          </ActionForm>
                        ) : (
                          s.roles.map((r) => ROLE_LABEL[r]).join(", ")
                        )}
                      </td>
                      <td>{s.class_teacher_of.join(", ") || "—"}</td>
                      <td className="max-w-[220px]">{s.teaches.join(", ") || "—"}</td>
                      <td>{s.joined ? <Pill kind="good">Signed in</Pill> : <Pill kind="warn">Invite sent</Pill>}</td>
                      <td>
                        <div className="flex flex-col items-end gap-1">
                          {!s.joined && !isMe && (
                            <ActionForm action={resendInvite} className="flex flex-col items-end gap-1">
                              <input type="hidden" name="user_id" value={s.user_id} />
                              <SubmitButton className="min-h-[40px] px-2 text-sm font-bold text-c2 underline underline-offset-2" pending="Sending…">
                                Resend link<span className="sr-only"> to {name}</span>
                              </SubmitButton>
                            </ActionForm>
                          )}
                          {editable && (
                            <details className="text-right">
                              <summary className="min-h-[40px] cursor-pointer list-none px-2 py-2 text-sm font-bold text-[#B42318] underline underline-offset-2">
                                Remove<span className="sr-only"> {name}</span>
                              </summary>
                              <ActionForm action={removeStaff} className="mt-2 flex flex-col items-end gap-2">
                                <input type="hidden" name="user_id" value={s.user_id} />
                                <p className="max-w-[220px] text-[13px] text-[#4A5A70]">They lose access to this school. Their classes and subjects will need a new teacher.</p>
                                <SubmitButton className="s-btn-danger" pending="Removing…">
                                  Remove {name.split(" ")[0]}
                                </SubmitButton>
                              </ActionForm>
                            </details>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>No staff yet. Invite your teachers and bursar above.</Empty>
        )}
      </Panel>
    </AdminPage>
  );
}
