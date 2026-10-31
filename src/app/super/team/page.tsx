import { Flash } from "@/components/Flash";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Box, Scroll, SuperShell } from "@/components/super";
import { Pill } from "@/components/ui";
import { ago, requirePlatform, TEAM_ROLE_LABEL, TEAM_ROLES, type TeamRole } from "@/lib/platform";
import { nowMs } from "@/lib/platform-data";
import { changeTeamRole, inviteTeam, removeTeam, resetTwoStep } from "../actions";

export const metadata = { title: "Dream Savvy team — Simpliskool back office" };

const PERM = [
  ["Schools and groups", "Full", "Add and edit", "View", "View"],
  ["New school checks", "Approve", "Approve", "View", "No access"],
  ["View as a school", "Yes, with a reason", "Yes, with a reason", "Yes, with a reason", "No"],
  ["Payments, payouts, refunds", "Full", "No access", "View", "Full"],
  ["Plans and billing", "Full", "View, record talks", "No access", "Full"],
  ["Support inbox", "Full", "Reply", "Full", "No access"],
  ["Notices to schools", "Full", "Full", "Full", "No access"],
  ["SMS credit and sender names", "Full", "No access", "Full", "Add credit"],
  ["Audit log", "View", "No access", "No access", "Money only"],
  ["Team and platform settings", "Full", "No access", "No access", "No access"],
];

export default async function SuperTeam() {
  const ctx = await requirePlatform("team");
  const now = nowMs();
  const { data: team } = await ctx.admin
    .from("platform_team")
    .select("user_id, role, totp_on_at, last_seen_at, created_at, profiles!platform_team_user_id_fkey(full_name, email, phone)")
    .order("created_at")
    .returns<{ user_id: string; role: TeamRole; totp_on_at: string | null; last_seen_at: string | null; created_at: string; profiles: { full_name: string | null; email: string | null; phone: string | null } | null }[]>();

  return (
    <SuperShell ctx={ctx} active="team" title="Dream Savvy team" sub="People who can sign in to this back office. Two-step sign-in is required for everyone.">
      <Flash />
      <Scroll label="Team members">
        <table className="tbl min-w-[980px]">
          <caption className="sr-only">Team members</caption>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Role</th>
              <th scope="col">Two-step sign-in</th>
              <th scope="col">Last active</th>
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {(team ?? []).map((t) => {
              const name = t.profiles?.full_name || t.profiles?.email || "No name yet";
              const me = t.user_id === ctx.user.id;
              return (
                <tr key={t.user_id}>
                  <td>
                    <span className="block font-extrabold text-[#173B70]">
                      {name}
                      {me ? " (you)" : ""}
                    </span>
                    <span className="block text-[13px] text-[#4A5A70]">{t.profiles?.email ?? t.profiles?.phone}</span>
                  </td>
                  <td>
                    {me ? (
                      TEAM_ROLE_LABEL[t.role]
                    ) : (
                      <ActionForm action={changeTeamRole} className="flex items-center gap-2">
                        <input type="hidden" name="user_id" value={t.user_id} />
                        <input type="hidden" name="name" value={name} />
                        <label className="sr-only" htmlFor={`rl-${t.user_id}`}>
                          Role for {name}
                        </label>
                        <select id={`rl-${t.user_id}`} name="role" className="sk-input !min-h-[40px] !w-auto" defaultValue={t.role}>
                          {TEAM_ROLES.map((r) => (
                            <option key={r} value={r}>
                              {TEAM_ROLE_LABEL[r]}
                            </option>
                          ))}
                        </select>
                        <SubmitButton className="s-btn2 !min-h-[40px] !px-3" pending="…">
                          Change<span className="sr-only"> role for {name}</span>
                        </SubmitButton>
                      </ActionForm>
                    )}
                  </td>
                  <td>
                    <Pill kind={t.totp_on_at ? "good" : "warn"}>{t.totp_on_at ? "On" : "Not set up"}</Pill>
                  </td>
                  <td>{ago(t.last_seen_at, now)}</td>
                  <td>
                    <span className="flex flex-wrap gap-2">
                      {t.totp_on_at && (
                        <form action={resetTwoStep}>
                          <input type="hidden" name="user_id" value={t.user_id} />
                          <input type="hidden" name="name" value={name} />
                          <button className="s-btn2 !min-h-[40px] !px-3">
                            Reset two-step<span className="sr-only"> for {name}</span>
                          </button>
                        </form>
                      )}
                      {!me && (
                        <form action={removeTeam}>
                          <input type="hidden" name="user_id" value={t.user_id} />
                          <input type="hidden" name="name" value={name} />
                          <button className="s-btn-danger !min-h-[40px] !px-3">
                            Remove<span className="sr-only"> {name}</span>
                          </button>
                        </form>
                      )}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Scroll>

      <Box id="ti-h" title="Add a team member" className="max-w-[760px]">
        <ActionForm action={inviteTeam} resetOnSuccess className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="tn">
                Name
              </label>
              <input id="tn" name="name" className="sk-input" required maxLength={120} />
            </div>
            <div>
              <label className="label" htmlFor="te">
                Work email
              </label>
              <input id="te" name="email" type="email" className="sk-input" required maxLength={200} />
            </div>
            <div>
              <label className="label" htmlFor="tr">
                Role
              </label>
              <select id="tr" name="role" className="sk-input">
                {TEAM_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {TEAM_ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-sm text-[#4A5A70]">They must set up two-step sign-in before they can see any school.</p>
          <SubmitButton className="s-btn self-start" pending="Adding…">
            Send invite
          </SubmitButton>
        </ActionForm>
      </Box>

      <Box id="rp-h" title="What each role can do">
        <Scroll label="Team role permissions">
          <table className="tbl min-w-[760px]">
            <caption className="sr-only">Team role permissions</caption>
            <thead>
              <tr>
                <th scope="col">Area</th>
                <th scope="col">Super admin</th>
                <th scope="col">Business development</th>
                <th scope="col">Support</th>
                <th scope="col">Finance</th>
              </tr>
            </thead>
            <tbody>
              {PERM.map(([a, ...v]) => (
                <tr key={a}>
                  <th scope="row" className="text-left font-bold">
                    {a}
                  </th>
                  {v.map((x, i) => (
                    <td key={i}>{x}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Scroll>
      </Box>
    </SuperShell>
  );
}
