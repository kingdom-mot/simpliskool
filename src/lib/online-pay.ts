import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendReceiptEmail } from "@/lib/fee-emails";
import { verifyPayment } from "@/lib/paystack";
import { smsReceipt } from "@/lib/sms-notices";

export type Outcome =
  | { status: "paid"; paymentId: string; receiptNo: string; isNew: boolean }
  | { status: "pending" | "failed" | "unknown"; message: string };

/**
 * Asks Paystack whether this payment went through and, if it did, records it with
 * a receipt number. Called by the return page and by the webhook, so it must be
 * safe to run twice: the database function returns the same payment the second time.
 */
export async function settlePaystack(reference: string): Promise<Outcome> {
  const admin = createAdminClient();
  const { data: intent } = await admin.from("payment_intents").select("reference, status, payment_id, amount_kobo").eq("reference", reference).maybeSingle<{ reference: string; status: string; payment_id: string | null; amount_kobo: number }>();
  if (!intent) return { status: "unknown", message: "We couldn't find this payment." };

  const v = await verifyPayment(reference);
  if (!v.ok) return { status: "pending", message: "We couldn't confirm the payment with Paystack yet. If money left your account, it will show here within a few minutes." };
  if (v.data.status !== "success") {
    if (["failed", "abandoned", "reversed"].includes(v.data.status) && intent.status === "started") {
      await admin.from("payment_intents").update({ status: "failed", note: v.data.status, updated_at: new Date().toISOString() }).eq("reference", reference).eq("status", "started");
    }
    return v.data.status === "pending" || v.data.status === "ongoing" || v.data.status === "processing" || v.data.status === "queued"
      ? { status: "pending", message: "Paystack is still processing this payment. It will show here once the bank confirms it." }
      : { status: "failed", message: "The payment didn't go through, so no money was taken. You can try again." };
  }
  if (v.data.currency && v.data.currency !== "NGN") return { status: "failed", message: "This payment wasn't in naira. Please contact the school." };
  if (v.data.amount !== intent.amount_kobo && !intent.payment_id) {
    // Should never happen; keep a note for the school and Simpliskool support to look into.
    await admin.from("payment_intents").update({ status: "failed", note: `Paid amount ${v.data.amount} kobo did not match ${intent.amount_kobo}`, updated_at: new Date().toISOString() }).eq("reference", reference);
    return { status: "failed", message: `Paystack reported a different amount for this payment, so it wasn't added automatically. Please show the school your payment reference: ${reference}.` };
  }

  const { data, error } = await admin.rpc("complete_online_payment", {
    p_reference: reference,
    p_amount_kobo: v.data.amount,
    p_paid_at: v.data.paid_at,
    p_channel: v.data.channel,
    p_fees_kobo: v.data.fees,
  });
  if (error || !data) return { status: "pending", message: "Your payment went through, but we couldn't record it yet. The school will see it shortly." };
  const r = data as { id: string; receipt_no: string; new: boolean };
  if (r.new) await announceReceipt(r.id);
  return { status: "paid", paymentId: r.id, receiptNo: r.receipt_no, isNew: r.new };
}

/** Emails the receipt and, if the school uses SMS, texts the parents. */
export async function announceReceipt(paymentId: string) {
  await sendReceiptEmail(paymentId).catch(() => null);
  await smsReceipt(paymentId).catch(() => null);
}
