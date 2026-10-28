import { NextResponse, type NextRequest } from "next/server";
import { settlePaystack } from "@/lib/online-pay";
import { validSignature } from "@/lib/paystack";

export const dynamic = "force-dynamic";

/**
 * Paystack calls this when a payment succeeds, even if the parent closed the
 * page before coming back. Set it in Paystack → Settings → API Keys & Webhooks:
 * https://www.simpliskool.com/api/paystack/webhook
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!validSignature(raw, req.headers.get("x-paystack-signature"))) return NextResponse.json({ error: "bad signature" }, { status: 401 });
  let event: { event?: string; data?: { reference?: string } };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }
  const ref = event.data?.reference ?? "";
  // Only our own payments (other Paystack products on the same account are ignored).
  if (event.event === "charge.success" && ref.startsWith("SK-")) {
    // Never trust the webhook body for the amount: settlePaystack asks Paystack directly.
    const out = await settlePaystack(ref);
    if (out.status === "pending") return NextResponse.json({ ok: false }, { status: 500 }); // Paystack retries later
  }
  return NextResponse.json({ ok: true });
}
