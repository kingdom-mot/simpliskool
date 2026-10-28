"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { publishInvoices } from "./actions";

/** Publish step with a confirmation, as in the design. */
export function PublishInvoices({ termId, termName, students, hasItems, again, emailReady }: { termId: string; termName: string; students: number; hasItems: boolean; again: boolean; emailReady: boolean }) {
  const [open, setOpen] = useState(false);
  if (!hasItems) return <p className="text-sm text-[#4A5A70]">Add fee items first, then publish the invoices.</p>;
  if (!open) {
    return (
      <div>
        <button type="button" className="s-btn" aria-expanded={false} onClick={() => setOpen(true)}>
          {again ? "Publish invoices again" : "Publish invoices"}
        </button>
      </div>
    );
  }
  return (
    <ActionForm action={publishInvoices} className="flex flex-col gap-3 rounded-xl border-[1.5px] border-c1 bg-white p-4">
      <input type="hidden" name="term" value={termId} />
      <h3 className="text-base !text-c1">
        {again ? "Update" : "Send"} {termName} invoices for {students} student{students === 1 ? "" : "s"}?
      </h3>
      <p className="text-sm text-brand-slate">Each student gets one invoice with the items for their class. Parents see the balance in their app.</p>
      <label className="flex min-h-[44px] items-center gap-2 text-sm font-semibold text-brand-slate">
        <input type="checkbox" name="email" value="1" defaultChecked={emailReady} disabled={!emailReady} className="h-5 w-5" />
        Email each parent their child&apos;s bill
      </label>
      {!emailReady && <p className="text-[13px] text-[#4A5A70]">Emails aren&apos;t switched on yet, so parents will only see the bill in the app.</p>}
      <div className="flex flex-wrap gap-2">
        <SubmitButton pending="Publishing…">{again ? "Update invoices" : "Send invoices"}</SubmitButton>
        <button type="button" className="s-btn2" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </ActionForm>
  );
}
