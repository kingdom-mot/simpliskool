import { NextResponse, type NextRequest } from "next/server";
import { setFlash } from "@/lib/flash";
import { naira } from "@/lib/format";
import { settlePaystack } from "@/lib/online-pay";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Paystack sends the parent back here after paying (?reference=...). */
export async function GET(req: NextRequest) {
  const ref = (req.nextUrl.searchParams.get("reference") ?? req.nextUrl.searchParams.get("trxref") ?? "").trim();
  const back = new URL("/parent/fees", req.nextUrl.origin);
  if (!/^SK-[A-Z0-9-]{6,40}$/.test(ref)) {
    await setFlash("We couldn't find that payment. If money left your account, contact the school with your bank's reference.", "/parent/fees", "warn");
    return NextResponse.redirect(back, 303);
  }
  const out = await settlePaystack(ref);
  if (out.status === "paid") {
    const { data } = await createAdminClient().from("payments").select("amount_kobo").eq("id", out.paymentId).maybeSingle<{ amount_kobo: number }>();
    await setFlash(`Payment received${data ? `: ${naira(data.amount_kobo)}` : ""}. Thank you! Your receipt number is ${out.receiptNo}. It's in "Payments made" below and has been emailed to you.`, "/parent/fees");
  } else {
    await setFlash(out.message, "/parent/fees", "warn");
  }
  return NextResponse.redirect(back, 303);
}
