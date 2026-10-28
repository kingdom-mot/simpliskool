import { AdminPage, Panel, requireAdminPage } from "@/components/admin";
import { ActionForm, SubmitButton } from "@/components/forms";
import { initials } from "@/lib/theme";
import { saveProfile } from "./actions";
import { ColourPicker } from "./ColourPicker";
import { LogoForm } from "./LogoForm";
import { MarkSplit } from "./MarkSplit";
import { GradingScale } from "./GradingScale";
import { pauseOnlinePayments, savePayout, saveSms } from "./actions";
import { createGroup } from "@/app/group/actions";
import { listBanks, paystackReady, paystackTestMode } from "@/lib/paystack";
import { smsReady } from "@/lib/sms";
import { changeRole, inviteStaff, removeStaff } from "@/app/admin/staff/actions";
import { Pill } from "@/components/ui";
import { Flash } from "@/components/Flash";
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
    supabase.from("school_payouts").select("*").eq("school_id", school.id).maybeSingle<{ bank_name: string; bank_code?: string | null; account_no: string; account_name: string; verified_at: string | null; paystack_subaccount?: string | null }>(),
    supabase.from("students").select("id", { count: "exact", head: true }).eq("school_id", school.id).eq("status", "active"),
  ]);
  const parts = asParts(partsRaw);
  const psReady = paystackReady();
  const banks = psReady ? await listBanks() : [];
  const [{ data: smsRow }, { data: usage }] = await Promise.all([
    supabase.from("schools").select("sms_enabled, sms_absence, sms_fees, sms_receipts").eq("id", school.id).maybeSingle<{ sms_enabled: boolean; sms_absence: boolean; sms_fees: boolean; sms_receipts: boolean }>(),
    supabase.rpc("sms_usage", { p_school: school.id }),
  ]);
  const sms = smsRow ?? { sms_enabled: false, sms_absence: true, sms_fees: true, sms_receipts: true };
  const smsUse = (usage as { month: number; failed: number; parents: number } | null) ?? { month: 0, failed: 0, parents: 0 };
  const onlineOn = !!payout?.paystack_subaccount;
  const { data: grp } = await supabase.from("schools").select("group_id, school_groups(name)").eq("id", school.id).maybeSingle<{ group_id: string | null; school_groups: { name: string } | null }>();
  const leaders = ((staff as { user_id: string; full_name: string | null; email: string | null; roles: string[]; joined: boolean }[] | null) ?? []).filter((m) => m.roles.some((r) => ["owner", "admin", "principal", "bursar"].includes(r)));
  const ROLE_NAME: Record<string, string> = { owner: "Owner", admin: "Admin", principal: "Principal / Head teacher", bursar: "Bursar" };

  return (
    <AdminPage ctx={ctx} active="settings" crumb={[{ label: "Settings" }]} title="Settings">
      <Flash />
      <nav aria-label="Settings sections" className="flex flex-wrap gap-2">
        <a href="#profile" className="s-btn2">School profile</a>
        <a href="#brand" className="s-btn2">Logo and colours</a>
        <a href="#marks" className="s-btn2">Marks and grades</a>
        <a href="#admins" className="s-btn2">Admins and roles</a>
        <a href="#payouts" className="s-btn2">Online fee payments</a>
        <a href="#sms" className="s-btn2">SMS</a>
        <a href="#group" className="s-btn2">Branches</a>
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

      <Panel title="Online fee payments" id="payouts">
        <div className="flex flex-wrap items-center gap-2">
          {onlineOn ? <Pill kind="good">On: parents can pay online</Pill> : <Pill kind="warn">Off</Pill>}
          {psReady && paystackTestMode() && <Pill kind="info">Test mode: no real money moves</Pill>}
        </div>
        <p className="text-sm text-brand-slate">Parents pay by card, bank transfer or USSD through Paystack. Each payment goes straight into this bank account, usually the next working day, and the receipt is issued automatically. Paystack&apos;s charge (1.5%, capped at ₦2,000) is taken from each payment.</p>
        {psReady ? (
          <ActionForm action={savePayout} className="grid grid-cols-[minmax(0,1fr)] items-end gap-3 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="po-bank">
                Bank
              </label>
              <select id="po-bank" name="bank_code" className="sk-input" required defaultValue={payout?.bank_code ?? ""}>
                <option value="" disabled>
                  Choose the bank
                </option>
                {banks.map((b) => (
                  <option key={b.code} value={b.code}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="po-acct">
                Account number
              </label>
              <input id="po-acct" name="account_no" className="sk-input" inputMode="numeric" pattern="\d{10}" maxLength={10} required defaultValue={payout?.account_no ?? ""} aria-describedby="po-acct-h" />
              <span id="po-acct-h" className="mt-1 block text-[13px] text-[#4A5A70]">
                10 digits. We check the name with the bank.
              </span>
            </div>
            {paystackTestMode() ? (
              <div>
                <label className="label" htmlFor="po-name">
                  Account name (test mode only)
                </label>
                <input id="po-name" name="account_name" className="sk-input" maxLength={120} defaultValue={payout?.account_name ?? ""} aria-describedby="po-name-h" />
                <span id="po-name-h" className="mt-1 block text-[13px] text-[#4A5A70]">
                  Used if the test bank can&apos;t look the account up.
                </span>
              </div>
            ) : (
              <div />
            )}
            <div className="sm:col-span-3">
              <SubmitButton pending="Checking with the bank…">{onlineOn ? "Update account" : "Check account and switch on"}</SubmitButton>
            </div>
          </ActionForm>
        ) : (
          <>
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
            <p className="rounded-xl bg-[#FFF6E3] px-4 py-3 text-sm font-semibold text-[#5C4310]">Online payment isn&apos;t connected to Paystack yet. Your account is saved and will be checked with the bank once it is.</p>
          </>
        )}
        {payout && (
          <div className="flex flex-col gap-1 rounded-xl bg-brand-cloud px-4 py-3 text-sm">
            <span>
              <strong>{payout.account_name}</strong> · {payout.bank_name} · {payout.account_no}
            </span>
            <span className="text-[#4A5A70]">{payout.verified_at ? "Name confirmed with the bank." : "Name not confirmed with the bank yet."}</span>
          </div>
        )}
        {onlineOn && (
          <ActionForm action={pauseOnlinePayments} className="flex flex-col gap-2">
            <div>
              <SubmitButton className="s-btn-danger" pending="Switching off…">
                Switch off online payment
              </SubmitButton>
            </div>
          </ActionForm>
        )}
        <p className="text-[13px] text-[#4A5A70]">Only the school owner can see or change this account, and every change is kept in the activity log.</p>
      </Panel>

      <Panel title="SMS to parents" id="sms">
        <p className="text-sm text-brand-slate">Texts reach parents who don&apos;t read email. Each text costs a few naira, so SMS stays off until you switch it on. {smsUse.parents} parent{smsUse.parents === 1 ? " has" : "s have"} a phone number on Simpliskool.</p>
        {!smsReady() && <p className="rounded-xl bg-[#FFF6E3] px-4 py-3 text-sm font-semibold text-[#5C4310]">SMS isn&apos;t connected yet, so no texts will go out even when switched on.</p>}
        <ActionForm action={saveSms} className="flex flex-col gap-2">
          <label className="flex min-h-[44px] items-center gap-3 text-sm font-bold text-brand-slate">
            <input type="checkbox" name="sms_enabled" value="1" defaultChecked={sms.sms_enabled} className="h-5 w-5" /> Send SMS to parents
          </label>
          <fieldset className="ml-2 flex flex-col gap-1 border-l-2 border-[#E3EAF3] pl-4">
            <legend className="label">Send a text for</legend>
            <label className="flex min-h-[44px] items-center gap-3 text-sm text-brand-slate">
              <input type="checkbox" name="sms_absence" value="1" defaultChecked={sms.sms_absence} className="h-5 w-5" /> A child marked absent
            </label>
            <label className="flex min-h-[44px] items-center gap-3 text-sm text-brand-slate">
              <input type="checkbox" name="sms_fees" value="1" defaultChecked={sms.sms_fees} className="h-5 w-5" /> Fee reminders
            </label>
            <label className="flex min-h-[44px] items-center gap-3 text-sm text-brand-slate">
              <input type="checkbox" name="sms_receipts" value="1" defaultChecked={sms.sms_receipts} className="h-5 w-5" /> Payment received (receipt number and balance)
            </label>
          </fieldset>
          <p className="text-[13px] text-[#4A5A70]">Announcements: you choose &quot;SMS&quot; each time you send one.</p>
          <div>
            <SubmitButton>Save SMS settings</SubmitButton>
          </div>
        </ActionForm>
        <p className="text-sm text-brand-slate">
          Texts sent this month: <strong>{smsUse.month}</strong>
          {smsUse.failed > 0 && <span className="text-[#912018]"> · {smsUse.failed} failed in the last 7 days (usually a wrong number)</span>}
        </p>
      </Panel>

      <Panel title="More than one branch?" id="group">
        {grp?.group_id ? (
          <>
            <p className="text-sm text-brand-slate">
              {school.name} is a branch of <strong>{grp.school_groups?.name ?? "a school group"}</strong>. See every branch side by side on the group dashboard.
            </p>
            <a className="s-btn2 self-start" href="/dashboard">
              Open the group dashboard
            </a>
          </>
        ) : (
          <>
            <p className="text-sm text-brand-slate">If you run several campuses, make this school the first branch of a group. You&apos;ll get one dashboard for all branches: fees, attendance, results, payroll and staff, plus shared settings. Each branch keeps its own principal, staff and fees.</p>
            <ActionForm action={createGroup} className="flex flex-wrap items-end gap-3">
              <div className="min-w-[240px] flex-1">
                <label className="label" htmlFor="grp-name">
                  Group name
                </label>
                <input id="grp-name" name="group_name" required minLength={3} maxLength={120} placeholder="e.g. Bright Stars Group" className="sk-input" />
              </div>
              <SubmitButton pending="Creating…">Create a school group</SubmitButton>
            </ActionForm>
          </>
        )}
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
