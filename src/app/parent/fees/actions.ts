"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/components/forms";
import { requireSchool } from "@/lib/auth";
import { toKobo } from "@/lib/fees";
import { naira } from "@/lib/format";
import { initializePayment, newReference, paystackReady } from "@/lib/paystack";
import { createAdminClient } from "@/lib/supabase/admin";

const MIN_PART = 100000; // ₦1,000: smallest part payment online

/** Where Paystack sends the parent back to (the same site they paid from). */
async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") || host?.includes(".localhost") ? "http" : "https");
  return host ? `${proto}://${host}` : (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.simpliskool.com");
}

export async function startOnlinePayment(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, school, user } = await requireSchool(["parent"]);
  const id = z.string().uuid().safeParse(fd.get("invoice"));
  if (!id.success) return { error: "Something went wrong. Refresh the page and try again." };
  if (!paystackReady()) return { error: "Online payment isn't available yet. Please pay the school directly." };

  // Read through the parent's own access: they can only pay their own child's bill.
  const { data: inv } = await supabase
    .from("invoices")
    .select("id, school_id, student_id, term_id, balance_kobo, students(first_name, last_name)")
    .eq("id", id.data)
    .eq("school_id", school.id)
    .maybeSingle<{ id: string; school_id: string; student_id: string; term_id: string; balance_kobo: number; students: { first_name: string; last_name: string } | null }>();
  if (!inv) return { error: "We couldn't find that bill." };
  if (inv.balance_kobo <= 0) return { error: "This bill is already paid in full." };
  if (inv.balance_kobo < 10000) return { error: `The balance (${naira(inv.balance_kobo)}) is too small to pay online. Please pay it at the school.` };

  const { data: terms } = await supabase.from("fee_terms").select("allow_part").eq("term_id", inv.term_id).maybeSingle<{ allow_part: boolean }>();
  const allowPart = terms?.allow_part !== false;
  const typed = String(fd.get("amount") ?? "").trim();
  let amount = inv.balance_kobo;
  if (allowPart && typed) {
    const k = toKobo(typed);
    if (k === null || k <= 0) return { error: "Enter the amount in naira, like 50000." };
    if (k > inv.balance_kobo) return { error: `That's more than the balance of ${naira(inv.balance_kobo)}.` };
    if (k < Math.min(MIN_PART, inv.balance_kobo)) return { error: `The smallest online payment is ${naira(MIN_PART)}.` };
    amount = k;
  }

  const admin = createAdminClient();
  const { data: payout } = await admin.from("school_payouts").select("paystack_subaccount").eq("school_id", school.id).maybeSingle<{ paystack_subaccount: string | null }>();
  if (!payout?.paystack_subaccount) return { error: "The school hasn't switched on online payment yet. Please pay the school directly." };

  const { data: me } = await admin.from("profiles").select("email, full_name").eq("id", user.id).maybeSingle<{ email: string | null; full_name: string | null }>();
  // Paystack needs an email address; parents who sign in by phone get a placeholder (no email is sent to it).
  const email = me?.email && !me.email.endsWith("@students.simpliskool.com") ? me.email : `parent-${user.id.slice(0, 8)}@pay.simpliskool.com`;

  const reference = newReference();
  const { error: intentErr } = await admin.from("payment_intents").insert({ reference, school_id: school.id, invoice_id: inv.id, amount_kobo: amount, created_by: user.id });
  if (intentErr) return { error: "We couldn't start the payment. Please try again." };

  const child = inv.students ? `${inv.students.first_name} ${inv.students.last_name}` : "";
  const init = await initializePayment({
    email,
    amountKobo: amount,
    reference,
    subaccount: payout.paystack_subaccount,
    callbackUrl: `${await origin()}/pay/return`,
    metadata: {
      invoice_id: inv.id,
      school_id: school.id,
      cancel_action: `${await origin()}/parent/fees`,
      custom_fields: [
        { display_name: "School", variable_name: "school", value: school.name },
        { display_name: "Student", variable_name: "student", value: child },
      ],
    },
  });
  if (!init.ok) {
    await admin.from("payment_intents").update({ status: "failed", note: init.error.slice(0, 200), updated_at: new Date().toISOString() }).eq("reference", reference);
    return { error: "Paystack couldn't start the payment just now. Please try again in a few minutes." };
  }
  redirect(init.data.authorization_url);
}
