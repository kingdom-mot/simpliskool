"use client";

import { useFormState, useFormStatus } from "react-dom";
import { applyForAdmission, type ApplyState } from "./actions";

function Submit({ color }: { color: string }) {
  const { pending } = useFormStatus();
  return (
    <button className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: color }} disabled={pending}>
      {pending ? "Sending…" : "Send application"}
    </button>
  );
}

export function ApplyForm({ schoolId, color }: { schoolId: string; color: string }) {
  const [state, action] = useFormState<ApplyState, FormData>(applyForAdmission, {});
  if (state.ok) {
    return <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Thank you. The school has received your application and will contact you.</p>;
  }
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="school_id" value={schoolId} />
      <div><label className="label">Child&apos;s full name</label><input name="child_name" required className="input" /></div>
      <div><label className="label">Date of birth</label><input name="date_of_birth" type="date" className="input" /></div>
      <div><label className="label">Class applying for</label><input name="class_applied" className="input" placeholder="e.g. JSS 1" /></div>
      <div><label className="label">Parent&apos;s name</label><input name="parent_name" required className="input" /></div>
      <div><label className="label">Phone number</label><input name="parent_phone" type="tel" required className="input" /></div>
      <div><label className="label">Email (optional)</label><input name="parent_email" type="email" className="input" /></div>
      <div className="sm:col-span-2"><label className="label">Anything we should know?</label><textarea name="notes" rows={3} className="input" /></div>
      <div className="sm:col-span-2"><Submit color={color} /></div>
      {state.error && <p className="sm:col-span-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
    </form>
  );
}
