"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSchool } from "@/lib/auth";
import type { ActionState } from "@/components/forms";
import { emailReady } from "@/lib/email";
import { sendFeeReminders, sendReceiptEmail } from "@/lib/fee-emails";
import { smsFeeReminders, smsReceipt } from "@/lib/sms-notices";
import { FINANCE_ROLES, toKobo } from "@/lib/fees";
import { naira } from "@/lib/format";

const uuid = z.string().uuid();

function refresh() {
  revalidatePath("/admin/payments");
  revalidatePath("/admin");
}

export async function recordPayment(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, school } = await requireSchool(FINANCE_ROLES);
  const invoice = uuid.safeParse(fd.get("invoice"));
  if (!invoice.success) return { error: "Choose the student who paid." };
  const kobo = toKobo(String(fd.get("amount") ?? ""));
  if (!kobo) return { error: "Enter the amount paid in naira, like 50000." };
  const method = String(fd.get("method") ?? "");
  if (!["transfer", "cash", "pos"].includes(method)) return { error: "Choose how the parent paid." };
  const paidOn = String(fd.get("paid_on") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paidOn)) return { error: "Enter the date paid." };
  const reference = String(fd.get("reference") ?? "").trim().slice(0, 80);

  // The invoice must be this school's (the database checks again).
  const { data: inv } = await supabase.from("invoices").select("id, balance_kobo").eq("id", invoice.data).eq("school_id", school.id).maybeSingle<{ id: string; balance_kobo: number }>();
  if (!inv) return { error: "Choose the student who paid." };
  if (kobo > inv.balance_kobo) return { error: `That's more than the balance of ${naira(inv.balance_kobo)}. Check the amount.` };

  const { data, error } = await supabase.rpc("record_payment", { p_invoice: inv.id, p_amount_kobo: kobo, p_method: method, p_paid_on: paidOn, p_reference: reference });
  if (error) {
    if (/future/.test(error.message)) return { error: "The date paid can't be in the future." };
    if (/balance/.test(error.message)) return { error: "That's more than the balance. Check the amount." };
    return { error: "We couldn't save the payment. Please try again." };
  }
  const r = data as { id: string; receipt_no: string };
  let mail = "";
  if (fd.get("email") === "1") {
    const t = await sendReceiptEmail(r.id);
    mail = t.sent ? " Receipt emailed to the parent." : t.noEmail ? " No parent email on file, so print or share the receipt." : t.skipped ? " Email isn't set up yet, so print or share the receipt." : " The receipt email didn't send; you can try again from the payments list.";
  }
  const sms = await smsReceipt(r.id).catch(() => null);
  if (sms?.sent) mail += ` Texted to ${sms.sent === 1 ? "the parent" : `${sms.sent} parents`}.`;
  refresh();
  return { ok: true, message: `${naira(kobo)} saved. Receipt ${r.receipt_no}.${mail}`, at: Date.now() };
}

export async function voidPayment(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, membership } = await requireSchool(FINANCE_ROLES);
  if (membership.role === "bursar") return { error: "Only the owner or an admin can cancel a payment." };
  const id = uuid.safeParse(fd.get("id"));
  if (!id.success) return { error: "Something went wrong. Refresh the page and try again." };
  const reason = String(fd.get("reason") ?? "").trim();
  if (reason.length < 3) return { error: "Say why the payment is being cancelled." };
  const { error } = await supabase.rpc("void_payment", { p_payment: id.data, p_reason: reason });
  if (error) return { error: /Online/.test(error.message) ? "Online payments can't be cancelled here." : "We couldn't cancel the payment. Please try again." };
  refresh();
  return { ok: true, message: "Payment cancelled. The student's balance has gone back up.", at: Date.now() };
}

export async function resendReceipt(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, school } = await requireSchool(FINANCE_ROLES);
  const id = uuid.safeParse(fd.get("id"));
  if (!id.success) return { error: "Something went wrong." };
  const { data } = await supabase.from("payments").select("id").eq("id", id.data).eq("school_id", school.id).eq("status", "success").maybeSingle();
  if (!data) return { error: "Payment not found." };
  if (!emailReady()) return { error: "Email isn't set up yet." };
  const t = await sendReceiptEmail(id.data);
  refresh();
  if (t.noEmail) return { error: "No parent email on file for this student." };
  return t.sent ? { ok: true, message: "Receipt emailed.", at: Date.now() } : { error: "The email didn't send. Please try again later." };
}

export async function sendReminders(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { school } = await requireSchool(FINANCE_ROLES);
  const ids = [...new Set(fd.getAll("student").map(String))].filter((s) => uuid.safeParse(s).success);
  if (!ids.length) return { error: "Tick the students whose parents should get a reminder." };
  const sms = await smsFeeReminders(school.id, ids);
  if (!emailReady() && sms.off) return { error: "Email and SMS aren't set up yet, so reminders can't be sent." };
  const t = emailReady() ? await sendFeeReminders(school.id, ids) : { sent: 0, failed: 0, skipped: 0, noEmail: 0 };
  refresh();
  const parts = [
    t.sent && `${t.sent} email${t.sent === 1 ? "" : "s"} sent`,
    sms.sent && `${sms.sent} text${sms.sent === 1 ? "" : "s"} sent`,
    (t.failed || sms.failed) && `${t.failed + sms.failed} failed`,
    t.noEmail && `${t.noEmail} student${t.noEmail === 1 ? " has" : "s have"} no parent email`,
    !sms.off && sms.noPhone && `${sms.noPhone} no parent phone`,
  ].filter(Boolean);
  if (!parts.length) return { ok: true, message: "These parents already got a reminder today.", at: Date.now() };
  return { ok: true, message: `Reminders: ${parts.join(", ")}.`, at: Date.now() };
}
