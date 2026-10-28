import { Flash } from "@/components/Flash";
import { GroupShell } from "@/components/GroupShell";
import { ActionForm, SubmitButton } from "@/components/forms";
import { GROUP_ROLE_LABEL, requireGroup, type GroupRole } from "@/lib/group";
import { inviteGroupMember, removeGroupMember } from "../actions";

export const metadata = { title: "Group team" };

type M = { user_id: string; role: GroupRole; branch_ids: string[] | null; profiles: { full_name: string | null; email: string | null; phone: string | null; last_sign_in?: string | null } | null };
const PERMS = [
  ["Overview and reports", "Full", "Money only", "Academics only"],
  ["Fees and payouts", "Full", "Full", "No access"],
  ["Payroll", "Approve", "View", "No access"],
  ["Results and lesson notes", "View", "No access", "View"],
  ["Staff and admissions", "View", "No access", "View"],
  ["Announcements", "Send", "No access", "Send"],
  ["Shared settings", "Full", "No access", "Grading, mark split, resumption time"],
  ["Group team and branches", "Full", "No access", "No access"],
];

export default async function GroupTeam() {
  const ctx = await requireGroup("team");
  const { data } = await ctx.admin.from("group_members").select("user_id, role, branch_ids, profiles!group_members_user_id_fkey(full_name, email, phone)").eq("group_id", ctx.group.id).returns<M[]>();
  const name = new Map(ctx.branches.map((b) => [b.id, b.name]));

  return (
    <GroupShell ctx={ctx} active="team" title="Group team" sub="People who look after more than one branch. Branch staff are managed inside each branch.">
      <Flash />
      <section aria-labelledby="tm-h" className="flex flex-col gap-3 rounded-[18px] border border-t-[5px] border-[#E3EAF3] border-t-c2 bg-white p-[22px]">
        <h2 id="tm-h" className="text-lg !text-c1">
          Group team members
        </h2>
        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Group team: scroll sideways to see more">
          <table className="tbl min-w-[640px]">
            <caption className="sr-only">Group team</caption>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Role</th>
                <th scope="col">Branches</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((m) => (
                <tr key={m.user_id}>
                  <th scope="row">
                    {m.profiles?.full_name || "No name yet"}
                    <span className="block text-xs font-normal text-[#4A5A70]">{m.profiles?.email ?? m.profiles?.phone}</span>
                  </th>
                  <td>{GROUP_ROLE_LABEL[m.role]}</td>
                  <td>{m.branch_ids ? m.branch_ids.map((b) => name.get(b) ?? "").filter(Boolean).join(", ") : "All branches"}</td>
                  <td>
                    {m.user_id !== ctx.user.id && (
                      <ActionForm action={removeGroupMember}>
                        <input type="hidden" name="user_id" value={m.user_id} />
                        <SubmitButton className="s-btn-danger" pending="Removing…">
                          Remove<span className="sr-only"> {m.profiles?.full_name}</span>
                        </SubmitButton>
                      </ActionForm>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 xl:grid-cols-2">
        <section aria-labelledby="inv-h" className="flex flex-col gap-3 rounded-[18px] border border-t-[5px] border-[#E3EAF3] border-t-c1 bg-white p-[22px]">
          <h2 id="inv-h" className="text-lg !text-c1">
            Invite to the group team
          </h2>
          <ActionForm action={inviteGroupMember} resetOnSuccess className="flex flex-col gap-3">
            <div>
              <label className="label" htmlFor="gt-name">
                Name
              </label>
              <input id="gt-name" name="name" required minLength={2} maxLength={120} className="sk-input" />
            </div>
            <div>
              <label className="label" htmlFor="gt-contact">
                Phone or email
              </label>
              <input id="gt-contact" name="contact" required maxLength={120} className="sk-input" />
            </div>
            <div>
              <label className="label" htmlFor="gt-role">
                Role
              </label>
              <select id="gt-role" name="role" className="sk-input sk-select" defaultValue="finance">
                <option value="finance">Group finance</option>
                <option value="academic">Director of studies</option>
                <option value="proprietor">Proprietor (full access)</option>
              </select>
            </div>
            <fieldset className="flex flex-wrap gap-2">
              <legend className="label">Branches they can see</legend>
              {ctx.branches.map((b) => (
                <label key={b.id} className="flex min-h-[44px] items-center gap-2 rounded-xl border-[1.5px] border-[#DCE5F0] px-3 text-sm font-bold has-[:checked]:border-c2 has-[:checked]:bg-[#F3FBF9]">
                  <input type="checkbox" name="branch" value={b.id} defaultChecked className="h-4 w-4" /> {b.name}
                </label>
              ))}
            </fieldset>
            <div>
              <SubmitButton pending="Inviting…">Send invite</SubmitButton>
            </div>
          </ActionForm>
        </section>
        <section aria-labelledby="pm-h" className="flex flex-col gap-3 rounded-[18px] border border-[#E3EAF3] bg-white p-[22px]">
          <h2 id="pm-h" className="text-lg !text-c1">
            What each group role can do
          </h2>
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Group role permissions: scroll sideways to see more">
            <table className="tbl min-w-[560px]">
              <caption className="sr-only">Group role permissions</caption>
              <thead>
                <tr>
                  <th scope="col">Area</th>
                  <th scope="col">Proprietor</th>
                  <th scope="col">Group finance</th>
                  <th scope="col">Director of studies</th>
                </tr>
              </thead>
              <tbody>
                {PERMS.map(([a, ...r]) => (
                  <tr key={a}>
                    <th scope="row">{a}</th>
                    {r.map((x, i) => (
                      <td key={i}>{x}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </GroupShell>
  );
}
