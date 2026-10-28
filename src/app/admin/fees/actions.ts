"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSchool } from "@/lib/auth";
import type { ActionState } from "@/components/forms";
import { FEE_SECTIONS, FINANCE_ROLES, toKobo, type FeeSection } from "@/lib/fees";
import { naira } from "@/lib/format";
import { sendInvoiceEmails } from "@/lib/fee-emails";

const uuid = z.string().uuid();
const SECTION_KEYS = FEE_SECTIONS.map((s) => s.key) as [FeeSection, ...FeeSection[]];

function done(message: string): ActionState {
  revalidatePath("/admin/fees");
  revalidatePath("/admin/payments");
  return { ok: true, message, at: Date.now() };
}

/** The term must belong to this school. */
async function ownTerm(supabase: Awaited<ReturnType<typeof requireSchool>>["supabase"], schoolId: string, termId: unknown) {
  const id = uuid.safeParse(termId);
  if (!id.success) return null;
  const { data } = await supabase.from("terms").select("id").eq("id", id.data).eq("school_id", schoolId).maybeSingle();
  return data ? id.data : null;
}

const itemSchema = z.object({
  name: z.string().trim().min(1, "Enter the item name, like Tuition").max(80, "Keep the name under 80 characters"),
  amount: z.string().trim().min(1, "Enter the amount"),
  level: z.string().trim().max(40),
  optional: z.string().optional(),
});

export async function addFeeItem(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, school } = await requireSchool(FINANCE_ROLES);
  const term = await ownTerm(supabase, school.id, fd.get("term"));
  const section = z.enum(SECTION_KEYS).safeParse(fd.get("section"));
  if (!term || !section.success) return { error: "Something went wrong. Refresh the page and try again." };
  const p = itemSchema.safeParse({ name: fd.get("name"), amount: fd.get("amount"), level: fd.get("level") ?? "", optional: fd.get("optional") ?? undefined });
  if (!p.success) return { error: p.error.issues[0].message };
  const kobo = toKobo(p.data.amount);
  if (kobo === null) return { error: "Enter the amount in naira, like 65000." };
  const { count } = await supabase.from("fee_items").select("id", { count: "exact", head: true }).eq("term_id", term).eq("section", section.data);
  const { error } = await supabase.from("fee_items").insert({
    school_id: school.id,
    term_id: term,
    section: section.data,
    level: p.data.level || null,
    name: p.data.name,
    amount_kobo: kobo,
    optional: p.data.optional === "1",
    position: count ?? 0,
  });
  if (error) return { error: "We couldn't add the item. Please try again." };
  return done(`${p.data.name} (${naira(kobo)}) added.`);
}

export async function updateFeeItem(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, school } = await requireSchool(FINANCE_ROLES);
  const id = uuid.safeParse(fd.get("id"));
  if (!id.success) return { error: "Something went wrong. Refresh the page and try again." };
  const p = itemSchema.safeParse({ name: fd.get("name"), amount: fd.get("amount"), level: fd.get("level") ?? "", optional: fd.get("optional") ?? undefined });
  if (!p.success) return { error: p.error.issues[0].message };
  const kobo = toKobo(p.data.amount);
  if (kobo === null) return { error: "Enter the amount in naira, like 65000." };
  const { data, error } = await supabase
    .from("fee_items")
    .update({ name: p.data.name, amount_kobo: kobo, level: p.data.level || null, optional: p.data.optional === "1" })
    .eq("id", id.data)
    .eq("school_id", school.id)
    .select("id");
  if (error || !data?.length) return { error: "We couldn't save the item. Please try again." };
  return done(`${p.data.name} saved.`);
}

export async function deleteFeeItem(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, school } = await requireSchool(FINANCE_ROLES);
  const id = uuid.safeParse(fd.get("id"));
  if (!id.success) return { error: "Something went wrong. Refresh the page and try again." };
  const { data, error } = await supabase.from("fee_items").delete().eq("id", id.data).eq("school_id", school.id).select("name");
  if (error || !data?.length) return { error: "We couldn't remove the item. Please try again." };
  return done(`${data[0].name} removed. Publish the invoices again to update what parents see.`);
}

export async function copyLastTerm(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, school } = await requireSchool(FINANCE_ROLES);
  const to = await ownTerm(supabase, school.id, fd.get("term"));
  const from = await ownTerm(supabase, school.id, fd.get("from"));
  if (!to || !from) return { error: "Something went wrong. Refresh the page and try again." };
  const { data, error } = await supabase.rpc("copy_fee_items", { p_from: from, p_to: to });
  if (error) return { error: /already has fees/.test(error.message) ? "This term already has fee items." : "We couldn't copy the fees. Please try again." };
  revalidatePath("/admin/fees");
  // The copy banner goes away once the term has items, so say so on the page itself.
  redirect(`/admin/fees?term=${to}&copied=${Number(data) || 0}`);
}

export async function saveTermSettings(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, school } = await requireSchool(FINANCE_ROLES);
  const term = await ownTerm(supabase, school.id, fd.get("term"));
  if (!term) return { error: "Something went wrong. Refresh the page and try again." };
  const due = String(fd.get("due_on") ?? "");
  if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) return { error: "Choose a valid due date." };
  const instructions = String(fd.get("instructions") ?? "").trim();
  if (instructions.length > 600) return { error: "Keep the payment details under 600 characters." };
  const { error } = await supabase
    .from("fee_terms")
    .upsert({ term_id: term, school_id: school.id, due_on: due || null, allow_part: fd.get("allow_part") === "1", updated_at: new Date().toISOString() }, { onConflict: "term_id" });
  const { error: e2 } = await supabase.rpc("set_payment_instructions", { p_school: school.id, p_text: instructions });
  if (error || e2) return { error: "We couldn't save. Please try again." };
  return done("Payment settings saved.");
}

export async function publishInvoices(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, school } = await requireSchool(FINANCE_ROLES);
  const term = await ownTerm(supabase, school.id, fd.get("term"));
  if (!term) return { error: "Something went wrong. Refresh the page and try again." };
  const { data, error } = await supabase.rpc("publish_invoices", { p_term: term });
  if (error) return { error: /Add fee items first/.test(error.message) ? "Add fee items first." : "We couldn't publish the invoices. Please try again." };
  const r = data as { created: number; updated: number; no_class: number; invoices: number };
  const mail = fd.get("email") === "1" ? await sendInvoiceEmails(school.id, term) : null;
  const parts = [
    `${r.invoices} invoice${r.invoices === 1 ? "" : "s"} published`,
    r.created ? `${r.created} new` : null,
    r.updated ? `${r.updated} changed` : null,
  ].filter(Boolean);
  let msg = `${parts.join(", ")}. Parents can see the balance in their app.`;
  if (mail) msg += mail.sent || mail.failed ? ` Emails: ${mail.sent} sent${mail.failed ? `, ${mail.failed} failed` : ""}.` : mail.skipped ? " Emails weren't sent: email isn't set up yet." : " No new emails to send.";
  if (r.no_class) msg += ` ${r.no_class} student${r.no_class === 1 ? " has" : "s have"} no class, so no invoice.`;
  return done(msg);
}

export async function saveOptionalStudents(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, school } = await requireSchool(FINANCE_ROLES);
  const id = uuid.safeParse(fd.get("item"));
  if (!id.success) return { error: "Something went wrong. Refresh the page and try again." };
  const { data: item } = await supabase.from("fee_items").select("id, name, optional").eq("id", id.data).eq("school_id", school.id).maybeSingle<{ id: string; name: string; optional: boolean }>();
  if (!item?.optional) return { error: "This item isn't optional." };
  const picked = [...new Set(fd.getAll("student").map(String))].filter((s) => uuid.safeParse(s).success);
  // Only students of this school.
  const { data: valid } = picked.length
    ? await supabase.from("students").select("id").eq("school_id", school.id).in("id", picked)
    : { data: [] as { id: string }[] };
  const ids = (valid ?? []).map((s) => s.id);
  const { error: e1 } = await supabase.from("fee_item_students").delete().eq("fee_item_id", item.id);
  const { error: e2 } = ids.length ? await supabase.from("fee_item_students").insert(ids.map((s) => ({ fee_item_id: item.id, student_id: s, school_id: school.id }))) : { error: null };
  if (e1 || e2) return { error: "We couldn't save. Please try again." };
  revalidatePath(`/admin/fees/optional/${item.id}`);
  return done(`${ids.length} student${ids.length === 1 ? "" : "s"} will be billed for ${item.name}. Publish the invoices again to update their bills.`);
}
