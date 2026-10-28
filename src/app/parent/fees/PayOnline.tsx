"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { startOnlinePayment } from "./actions";

const fmt = (kobo: number) => `₦${(kobo / 100).toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;

/** "Pay online" for one bill: the full balance, or part of it when the school allows. */
export function PayOnline({ invoiceId, balanceKobo, allowPart, child }: { invoiceId: string; balanceKobo: number; allowPart: boolean; child: string }) {
  const [part, setPart] = useState(false);
  const [amount, setAmount] = useState("");
  const typed = Number(amount.replace(/[,\s₦]/g, ""));
  const shown = part && typed > 0 ? Math.round(typed * 100) : balanceKobo;
  const id = `amt-${invoiceId}`;
  return (
    <ActionForm action={startOnlinePayment} className="flex flex-col gap-3 rounded-2xl bg-brand-cloud p-3">
      <input type="hidden" name="invoice" value={invoiceId} />
      {allowPart && (
        <fieldset className="flex flex-wrap gap-2">
          <legend className="sr-only">How much to pay for {child}</legend>
          {[false, true].map((p) => (
            <label key={String(p)} className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border-[1.5px] border-[#DCE5F0] bg-white px-3 text-sm font-bold text-brand-slate has-[:checked]:border-c2 has-[:checked]:bg-[#F3FBF9] has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-c2">
              <input type="radio" name={`mode-${invoiceId}`} checked={part === p} onChange={() => setPart(p)} className="h-4 w-4" />
              {p ? "Pay part" : `Full balance (${fmt(balanceKobo)})`}
            </label>
          ))}
        </fieldset>
      )}
      {allowPart && part && (
        <div>
          <label className="label" htmlFor={id}>
            Amount to pay (₦)
          </label>
          <input id={id} name="amount" className="sk-input" inputMode="decimal" autoComplete="off" required placeholder="e.g. 50000" value={amount} onChange={(e) => setAmount(e.target.value)} aria-describedby={`${id}-h`} />
          <p id={`${id}-h`} className="mt-1 text-[13px] text-[#4A5A70]">
            At least ₦1,000, up to {fmt(balanceKobo)}.
          </p>
        </div>
      )}
      <SubmitButton pending="Opening Paystack…" className="s-btn w-full">
        Pay {fmt(Math.min(shown, balanceKobo))} online<span className="sr-only"> for {child}</span>
      </SubmitButton>
      <p className="text-center text-[13px] text-[#4A5A70]">Card, bank transfer or USSD, through Paystack. The money goes straight to the school.</p>
    </ActionForm>
  );
}
