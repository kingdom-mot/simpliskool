import { AdminPage, Panel, requireAdminPage } from "@/components/admin";
import { ActionForm, SubmitButton } from "@/components/forms";
import { initials } from "@/lib/theme";
import { saveProfile } from "./actions";
import { ColourPicker } from "./ColourPicker";
import { LogoForm } from "./LogoForm";
import { MarkSplit } from "./MarkSplit";
import { GradingScale } from "./GradingScale";
import { savePayout } from "./actions";
import { changeRole, inviteStaff, removeStaff } from "@/app/admin/staff/actions";
import { Pill } from "@/components/ui";
import { asParts } from "@/lib/results";

export const metadata = { title: "Settings" };

type SchoolRow = {
  name: string;
  slug: string;
  motto: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  principal_name: string | null;
  about: string | null;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
};

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="label" htmlFor={id}>
        {label}
      </label>
      {hint && (
        <span id={`${id}-h`} className="text-[13px] text-[#4A5A70]">
          {hint}
        </span>
      )}
      {children}
    </div>
  );
}

export default async function SettingsPage() {
  const ctx = await requireAdminPage(["owner"]);
  const { supabase, school } = ctx;
  const { data: s } = await supabase
    .from("schools")
    .select("name, slug, motto, email, phone, address, principal_name, about, logo_url, primary_color, secondary_color")
    .eq("id", school.id)
    .single<SchoolRow>();
  const row = s ?? { ...school, motto: null, email: null, phone: null, address: null, principal_name: null, about: null };
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "simpliskool.com";
  const [{ data: partsRaw }, { data: scale }, { data: staff }, { data: payout }, { count: activeStudents }] = await Promise.all([
    supabase.rpc("assessment_parts", { p_school: school.id }),
    supabase.from("grading_scales").select("grade, min_score, remark").eq("school_id", school.id).order("min_score", { ascending: false }).returns<{ grade: string; min_score: number; remark: string | null }[]>(),
    supabase.rpc("staff_list", { p_school: school.id }),
    supabase.from("school_payouts").select("bank_name, account_no, account_name, verified_at").eq("school_id", school.id).maybeSingle<{ bank_name: string; account_no: string; account_name: string; verified_at: string | null }>(),
    supabase.from("students").select("id", { count: "exact", head: true }).eq("school_id", school.id).eq("status", "active"),
  ]);
  const parts = asParts(partsRaw);
  const leaders = ((staff as { user_id: string; full_name: string | null; email: string | null; roles: string[]; joined: boolean }[] | null) ?? []).filter((m) => m.roles.some((r) => ["owner", "admin", "principal", "bursar"].includes(r)));
  const ROLE_NAME: Record<string, string> = { owner: "Owner", admin: "Admin", principal: "Principal / Head teacher", bursar: "Bursar" };

  return (
    <AdminPage ctx={ctx} active="settings" crumb={[{ label: "Settings" }]} title="Settings">
      <nav aria-label="Settings sections" className="flex flex-wrap gap-2">
        <a href="#profile" className="s-btn2">School profile</a>
        <a href="#brand" className="s-btn2">Logo and colours</a>
        <a href="#marks" className="s-btn2">Marks and grades</a>
        <a href="#admins" className="s-btn2">Admins and roles</a>
        <a href="#payouts" className="s-btn2">Fee payouts</a>
        <a href="#plan" className="s-btn2">Plan</a>
      </nav>

      <Panel title="School profile" id="profile">
        <ActionForm action={saveProfile} className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2">
          <Field id="name" label="School name">
            <input id="name" name="name" className="input" required minLength={3} maxLength={120} defaultValue={row.name} />
          </Field>
          <Field id="motto" label="Motto (optional)">
            <input id="motto" name="motto" className="input" maxLength={120} defaultValue={row.motto ?? ""} />
          </Field>
          <Field id="email" label="School email">
            <input id="email" name="email" type="email" className="input" autoComplete="email" defaultValue={row.email ?? ""} />
          </Field>
          <Field id="phone" label="School phone">
            <input id="phone" name="phone" type="tel" className="input" autoComplete="tel" defaultValue={row.phone ?? ""} />
          </Field>
          <div className="md:col-span-2">
            <Field id="address" label="Address">
              <input id="address" name="address" className="input" maxLength={300} autoComplete="street-address" defaultValue={row.address ?? ""} />
            </Field>
          </div>
          <Field id="principal_name" label="Principal's name" hint="Shown on report cards.">
            <input id="principal_name" name="principal_name" aria-describedby="principal_name-h" className="input" maxLength={120} defaultValue={row.principal_name ?? ""} />
          </Field>
          <Field id="web" label="Web address" hint="Chosen when the school was created. Contact Simpliskool to change it.">
            <input id="web" readOnly aria-describedby="web-h" className="input bg-brand-cloud" value={`${row.slug}.${rootDomain}`} />
          </Field>
          <div className="md:col-span-2">
            <Field id="about" label="About the school" hint="The introduction on your school website. Up to 2,000 characters.">
              <textarea id="about" name="about" aria-describedby="about-h" rows={5} maxLength={2000} className="input min-h-[120px] py-3" defaultValue={row.about ?? ""} />
            </Field>
          </div>
          <div className="md:col-span-2">
            <SubmitButton>Save details</SubmitButton>
          </div>
        </ActionForm>
      </Panel>

      <Panel title="Logo and colours" id="brand">
        <LogoForm logoUrl={row.logo_url} initials={initials(row.name)} />
        <hr className="border-[#E3EAF3]" />
        <ColourPicker schoolName={row.name} initial={[row.primary_color, row.secondary_color].filter((c): c is string => !!c)} />
      </Panel>

      <Panel title="Marks: how the 100 marks are split" id="marks">
        <MarkSplit initial={parts} />
      </Panel>

      <Panel title="Grading scale" id="grades">
        <GradingScale initial={(scale ?? []).map((g) => ({ grade: g.grade, min: Number(g.min_score), remark: g.remark }))} />
      </Panel>

      <Panel title="People who manage the school" id="admins">
        <ul className="flex flex-col gap-2">
          {leaders.map((m) => {
            const role = m.roles.find((r) => ["owner", "admin", "principal", "bursar"].includes(r))!;
            const nm = m.full_name?.trim() || m.email || "Staff member";
            const isYou = m.user_id === ctx.user.id;
            return (
              <li key={m.user_id} className="flex flex-wrap items-end gap-3 rounded-xl border border-[#E3EAF3] p-3">
                <div className="min-w-[180px] flex-1">
                  <span className="font-bold text-brand-slate">
                    {nm}
                    {isYou ? " (you)" : ""}
                  </span>
                  <span className="block text-xs text-[#4A5A70]">{m.email}</span>
                </div>
                {role === "owner" || isYou ? (
                  <Pill kind="info">{ROLE_NAME[role]}</Pill>
                ) : (
                  <ActionForm action={changeRole} className="flex min-w-0 flex-wrap items-end gap-2">
                    <input type="hidden" name="user_id" value={m.user_id} />
                    <input type="hidden" name="from" value={role} />
                    <div>
                      <label className="label" htmlFor={`rl-${m.user_id.slice(0, 8)}`}>
                        Role for {nm}
                      </label>
                      <select id={`rl-${m.user_id.slice(0, 8)}`} name="role" className="sk-input sk-select py-2" defaultValue={role}>
                        <option value="principal">Principal / Head teacher</option>
                        <option value="admin">Admin</option>
                        <option value="bursar">Bursar</option>
                        <option value="teacher">Teacher</option>
                      </select>
                    </div>
                    <SubmitButton className="s-btn2">
                      Save<span className="sr-only"> role for {nm}</span>
                    </SubmitButton>
                  </ActionForm>
                )}
                <Pill kind={m.joined ? "good" : "warn"}>{m.joined ? "Active" : "Invite sent"}</Pill>
                {role !== "owner" && !isYou && (
                  <ActionForm action={removeStaff}>
                    <input type="hidden" name="user_id" value={m.user_id} />
                    <SubmitButton className="s-btn-danger" pending="Removing…">
                      Remove<span className="sr-only"> {nm}</span>
                    </SubmitButton>
                  </ActionForm>
                )}
              </li>
            );
          })}
        </ul>
        <ActionForm action={inviteStaff} resetOnSuccess className="grid grid-cols-[minmax(0,1fr)] items-end gap-3 rounded-xl bg-brand-cloud p-4 sm:grid-cols-2 xl:grid-cols-4">
          <h3 className="text-base !text-c1 sm:col-span-2 xl:col-span-4">+ Invite admin, principal or bursar</h3>
          <div>
            <label className="label" htmlFor="ia-name">
              Full name
            </label>
            <input id="ia-name" name="name" className="sk-input" required />
          </div>
          <div>
            <label className="label" htmlFor="ia-email">
              Email
            </label>
            <input id="ia-email" name="email" type="email" className="sk-input" required />
          </div>
          <div>
            <label className="label" htmlFor="ia-phone">
              Phone (optional)
            </label>
            <input id="ia-phone" name="phone" type="tel" className="sk-input" />
          </div>
          <div>
            <label className="label" htmlFor="ia-role">
              Role
            </label>
            <select id="ia-role" name="role" className="sk-input sk-select" defaultValue="admin">
              <option value="admin">Admin</option>
              <option value="principal">Principal / Head teacher</option>
              <option value="bursar">Bursar</option>
            </select>
          </div>
          <div className="sm:col-span-2 xl:col-span-4">
            <SubmitButton>Send invite</SubmitButton>
          </div>
        </ActionForm>
        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="What each role can do: scroll sideways to see more">
          <table className="tbl min-w-[640px]">
            <caption className="mb-2 text-left text-sm font-bold text-brand-slate">What each role can do</caption>
            <thead>
              <tr>
                <th scope="col">Area</th>
                <th scope="col">Owner</th>
                <th scope="col">Principal</th>
                <th scope="col">Admin</th>
                <th scope="col">Bursar</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Students, classes, staff, timetable", "Yes", "Yes", "Yes", "View students"],
                ["Results, report cards, lesson notes", "Yes", "Yes", "Yes", "No"],
                ["Staff attendance (clock in and out)", "Yes", "Yes", "View", "No"],
                ["Fees and payments", "Yes", "No", "Yes", "Yes"],
                ["Payroll", "Yes", "No", "No", "Yes"],
                ["School settings and payout account", "Yes", "No", "No", "No"],
              ].map(([a, ...v]) => (
                <tr key={a}>
                  <th scope="row">{a}</th>
                  {v.map((x, i) => (
                    <td key={i}>{x}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Where your fees are paid out" id="payouts">
        <p className="text-sm text-brand-slate">When online payment is switched on, parents pay through Simpliskool and each payment goes straight to this bank account, usually the next working day.</p>
        <ActionForm action={savePayout} className="grid grid-cols-[minmax(0,1fr)] items-end gap-3 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="po-bank">
              Bank
            </label>
            <input id="po-bank" name="bank_name" className="sk-input" list="po-banks" required defaultValue={payout?.bank_name ?? ""} />
            <datalist id="po-banks">
              {["Access Bank", "Ecobank", "Fidelity Bank", "First Bank", "FCMB", "GTBank", "Keystone Bank", "Moniepoint", "OPay", "Polaris Bank", "Providus Bank", "Stanbic IBTC", "Sterling Bank", "UBA", "Union Bank", "Wema Bank", "Zenith Bank"].map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="label" htmlFor="po-acct">
              Account number
            </label>
            <input id="po-acct" name="account_no" className="sk-input" inputMode="numeric" maxLength={10} required defaultValue={payout?.account_no ?? ""} />
          </div>
          <div>
            <label className="label" htmlFor="po-name">
              Account name
            </label>
            <input id="po-name" name="account_name" className="sk-input" required maxLength={120} defaultValue={payout?.account_name ?? ""} />
          </div>
          <div className="sm:col-span-3">
            <SubmitButton>Save payout account</SubmitButton>
          </div>
        </ActionForm>
        {payout && (
          <p className={`rounded-xl px-4 py-3 text-sm font-semibold ${payout.verified_at ? "bg-[#E7F6F2] text-[#0B6B5A]" : "bg-[#FFF6E3] text-[#5C4310]"}`}>
            {payout.verified_at ? "Account verified with the bank." : "This account will be checked with the bank when online payments start."}
          </p>
        )}
        <p className="text-[13px] text-[#4A5A70]">Only the school owner can see or change this account, and every change is kept in the activity log.</p>
      </Panel>

      <Panel title="Plan" id="plan">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-brand-cloud p-4">
          <div>
            <span className="font-heading text-xl font-extrabold text-c1">Pilot plan</span>
            <p className="text-sm text-brand-slate">You&apos;re one of our pilot schools. Everything is included during the pilot.</p>
          </div>
          <div className="text-right">
            <span className="block text-xs font-bold uppercase tracking-[0.05em] text-[#4A5A70]">Active students</span>
            <span className="font-heading text-2xl font-black text-c1">{activeStudents ?? 0}</span>
          </div>
        </div>
        <a className="s-btn2 self-start" href="mailto:hello@simpliskool.com?subject=Pricing">
          Talk to us about pricing
        </a>
      </Panel>
    </AdminPage>
  );
}
