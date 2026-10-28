"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { setFlash } from "@/lib/flash";
import { z } from "zod";
import type { ActionState } from "@/components/forms";
import { requireSchool } from "@/lib/auth";
import { emailReady } from "@/lib/email";
import { toKobo } from "@/lib/fees";
import { naira } from "@/lib/format";
import { computeSlip, parseItems, type Item, type Settings } from "@/lib/payroll";
import { emailFromSchool } from "@/lib/school-email";

const PAYROLL = ["owner", "bursar"] as const;
const uuid = z.string().uuid();

function items(fd: FormData, prefix: string, n: number): Item[] | string {
  const out: Item[] = [];
  for (let i = 0; i < n; i++) {
    const name = String(fd.get(`${prefix}_name_${i}`) ?? "").trim();
    const amt = String(fd.get(`${prefix}_amt_${i}`) ?? "").trim();
    if (!name && !amt) continue;
    const kobo = toKobo(amt);
    if (!name || kobo === null) return `Check ${prefix === "a" ? "allowance" : "deduction"} ${i + 1}: give a name and an amount in naira.`;
    out.push({ name: name.slice(0, 40), kobo });
  }
  return out;
}

export async function saveStructure(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, school } = await requireSchool([...PAYROLL]);
  const name = String(fd.get("name") ?? "").trim();
  if (name.length < 2) return { error: "Name the structure, like Graduate teacher." };
  const basic = toKobo(String(fd.get("basic") ?? ""));
  if (basic === null) return { error: "Enter the basic salary in naira." };
  const a = items(fd, "a", 4);
  const d = items(fd, "d", 3);
  if (typeof a === "string") return { error: a };
  if (typeof d === "string") return { error: d };
  const id = String(fd.get("id") ?? "");
  const row = { school_id: school.id, name: name.slice(0, 60), basic_kobo: basic, allowances: a, deductions: d };
  const { error } = uuid.safeParse(id).success ? await supabase.from("pay_structures").update(row).eq("id", id).eq("school_id", school.id) : await supabase.from("pay_structures").insert(row);
  if (error) return { error: error.code === "23505" ? "A structure with that name already exists." : "We couldn't save the structure." };
  revalidatePath("/admin/payroll");
  return { ok: true, message: `${name} saved.`, at: Date.now() };
}

export async function deleteStructure(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, school } = await requireSchool([...PAYROLL]);
  const id = uuid.safeParse(fd.get("id"));
  if (!id.success) return { error: "Something went wrong." };
  const { error } = await supabase.from("pay_structures").delete().eq("id", id.data).eq("school_id", school.id);
  if (error) return { error: "We couldn't delete it." };
  revalidatePath("/admin/payroll");
  return { ok: true, message: "Structure deleted. Staff on it need a new one.", at: Date.now() };
}

export async function saveStaffPay(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, school } = await requireSchool([...PAYROLL]);
  const user = uuid.safeParse(fd.get("user_id"));
  if (!user.success) return { error: "Something went wrong." };
  const structure = String(fd.get("structure_id") ?? "");
  const acct = String(fd.get("account_no") ?? "").replace(/\s/g, "");
  if (acct && !/^\d{10}$/.test(acct)) return { error: "Account numbers have 10 digits." };
  const rent = String(fd.get("rent") ?? "").trim();
  const rentKobo = rent ? toKobo(rent) : null;
  if (rent && rentKobo === null) return { error: "Enter the monthly rent in naira, or leave it empty." };
  const t = (k: string, n: number) => String(fd.get(k) ?? "").trim().slice(0, n) || null;
  const { error } = await supabase.from("staff_pay").upsert(
    {
      school_id: school.id,
      user_id: user.data,
      structure_id: uuid.safeParse(structure).success ? structure : null,
      job_title: t("job_title", 60),
      bank_name: t("bank_name", 60),
      account_no: acct || null,
      account_name: t("account_name", 120),
      pfa: t("pfa", 80),
      pension_pin: t("pension_pin", 30),
      monthly_rent_kobo: rentKobo,
    },
    { onConflict: "school_id,user_id" },
  );
  if (error) return { error: "We couldn't save the pay details." };
  revalidatePath("/admin/payroll");
  return { ok: true, message: "Pay details saved.", at: Date.now() };
}

export async function saveTaxSettings(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, school } = await requireSchool([...PAYROLL]);
  const pct = (k: string, dflt: number) => {
    const v = Number(fd.get(k));
    return Number.isFinite(v) && v >= 0 && v <= 30 ? v : dflt;
  };
  const { error } = await supabase.from("payroll_settings").upsert(
    {
      school_id: school.id,
      pension_on: fd.get("pension_on") === "1",
      pension_staff_pct: pct("pension_staff_pct", 8),
      pension_employer_pct: pct("pension_employer_pct", 10),
      paye_on: fd.get("paye_on") === "1",
      tax_state: String(fd.get("tax_state") ?? "").slice(0, 40) || null,
      tin: String(fd.get("tin") ?? "").trim().slice(0, 30) || null,
    },
    { onConflict: "school_id" },
  );
  if (error) return { error: "We couldn't save the settings." };
  revalidatePath("/admin/payroll");
  return { ok: true, message: "Pension and tax settings saved. Prepare or recalculate the month's payroll to use them.", at: Date.now() };
}


/** Creates (or recalculates) the month's draft payroll from each staff member's structure. */
export async function preparePayroll(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, school } = await requireSchool([...PAYROLL]);
  const month = String(fd.get("month") ?? "");
  if (!/^\d{4}-\d{2}$/.test(month)) return { error: "Choose the month." };
  const [{ data: run }, { data: pays }, { data: structures }, { data: settings }, { data: staff }] = await Promise.all([
    supabase.from("payroll_runs").select("id, status").eq("school_id", school.id).eq("month", `${month}-01`).maybeSingle<{ id: string; status: string }>(),
    supabase.from("staff_pay").select("user_id, structure_id, job_title, bank_name, account_no, account_name, monthly_rent_kobo").eq("school_id", school.id).returns<{ user_id: string; structure_id: string | null; job_title: string | null; bank_name: string | null; account_no: string | null; account_name: string | null; monthly_rent_kobo: number | null }[]>(),
    supabase.from("pay_structures").select("id, name, basic_kobo, allowances, deductions").eq("school_id", school.id).returns<{ id: string; name: string; basic_kobo: number; allowances: unknown; deductions: unknown }[]>(),
    supabase.from("payroll_settings").select("*").eq("school_id", school.id).maybeSingle<Settings>(),
    supabase.rpc("staff_list", { p_school: school.id }),
  ]);
  if (run && run.status !== "draft") return { error: "This month's payroll is already approved." };
  const s: Settings = settings ?? { pension_on: false, pension_staff_pct: 8, pension_employer_pct: 10, paye_on: false, tax_state: null, tin: null };
  const names = new Map(((staff as { user_id: string; full_name: string | null; email: string | null }[] | null) ?? []).map((x) => [x.user_id, x.full_name?.trim() || x.email || "Staff member"]));
  const st = new Map((structures ?? []).map((x) => [x.id, x]));
  const on = (pays ?? []).filter((p) => p.structure_id && st.has(p.structure_id));
  if (!on.length) return { error: "Give staff a salary structure first (Salary structures tab)." };
  let runId = run?.id;
  if (!runId) {
    const { data: created, error } = await supabase.from("payroll_runs").insert({ school_id: school.id, month: `${month}-01` }).select("id").single<{ id: string }>();
    if (error || !created) return { error: "We couldn't start the payroll." };
    runId = created.id;
  }
  await supabase.from("payslips").delete().eq("run_id", runId);
  const slips = on.map((p) => {
    const x = st.get(p.structure_id!)!;
    const a = parseItems(x.allowances);
    const d = parseItems(x.deductions);
    const c = computeSlip(Number(x.basic_kobo), a, d, s, Number(p.monthly_rent_kobo ?? 0));
    return {
      run_id: runId,
      school_id: school.id,
      user_id: p.user_id,
      name: names.get(p.user_id) ?? "Staff member",
      job_title: p.job_title ?? x.name,
      basic_kobo: Number(x.basic_kobo),
      allowances: a,
      deductions: d,
      gross_kobo: c.gross,
      pension_kobo: c.pension,
      employer_pension_kobo: c.employer,
      paye_kobo: c.paye,
      net_kobo: c.net,
      bank_name: p.bank_name,
      account_no: p.account_no,
      account_name: p.account_name,
    };
  });
  const { error } = await supabase.from("payslips").insert(slips);
  if (error) return { error: "We couldn't work out the payslips." };
  revalidatePath("/admin/payroll");
  return { ok: true, message: `Payroll worked out for ${slips.length} staff. Check it, then approve.`, at: Date.now() };
}

export async function approvePayroll(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, school, user, membership } = await requireSchool([...PAYROLL]);
  if (membership.role !== "owner") return { error: "Only the school owner can approve payroll." };
  const id = uuid.safeParse(fd.get("id"));
  if (!id.success) return { error: "Something went wrong." };
  const { data, error } = await supabase.from("payroll_runs").update({ status: "approved", approved_by: user.id, approved_at: new Date().toISOString() }).eq("id", id.data).eq("school_id", school.id).eq("status", "draft").select("id, month");
  if (error || !data?.length) return { error: "We couldn't approve the payroll." };
  revalidatePath("/admin/payroll");
  await setFlash("Payroll approved. Pay staff from the bank schedule, then mark it as paid.", "/admin/payroll");
  redirect(`/admin/payroll?month=${String(data[0].month).slice(0, 7)}`);
}

export async function markPaid(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, school } = await requireSchool([...PAYROLL]);
  const id = uuid.safeParse(fd.get("id"));
  if (!id.success) return { error: "Something went wrong." };
  const { data, error } = await supabase.from("payroll_runs").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", id.data).eq("school_id", school.id).eq("status", "approved").select("id, month");
  if (error || !data?.length) return { error: "Approve the payroll first." };
  let sent = 0;
  if (emailReady()) {
    const { data: slips } = await supabase.from("payslips").select("id, user_id, name, net_kobo").eq("run_id", id.data).returns<{ id: string; user_id: string; name: string; net_kobo: number }[]>();
    const { data: staff } = await supabase.rpc("staff_list", { p_school: school.id });
    const emails = new Map(((staff as { user_id: string; email: string | null }[] | null) ?? []).map((s) => [s.user_id, s.email]));
    const month = new Date(`${data[0].month}T12:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    for (const sl of slips ?? []) {
      const to = emails.get(sl.user_id);
      if (!to) continue;
      const r = await emailFromSchool(school.id, {
        to,
        heading: `Your payslip for ${month}`,
        paragraphs: [`Hello ${sl.name.split(/\s+/)[0]},`, `Your ${month} salary of ${naira(sl.net_kobo)} has been paid. You can view and print your payslip in Simpliskool.`],
        button: { label: "View payslip", href: `/payslip/${sl.id}` },
      });
      if (r.ok) {
        sent++;
        await supabase.from("payslips").update({ emailed_at: new Date().toISOString() }).eq("id", sl.id);
      }
    }
  }
  revalidatePath("/admin/payroll");
  await setFlash(`Marked as paid.${sent ? ` Payslips emailed to ${sent} staff.` : ""}`, "/admin/payroll");
  redirect(`/admin/payroll?month=${String(data[0].month).slice(0, 7)}`);
}
