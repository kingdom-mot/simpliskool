"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { applyForAdmission, type ApplyState } from "./actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button className="min-h-[52px] w-full rounded-xl bg-c2 px-4 text-base font-bold text-white hover:opacity-90 disabled:opacity-60" disabled={pending}>
      {pending ? "Sending…" : "Submit application"}
    </button>
  );
}

const CLASSES = ["Creche", "Nursery 1", "Nursery 2", "Primary 1", "Primary 2", "Primary 3", "Primary 4", "Primary 5", "Primary 6", "JSS 1", "JSS 2", "JSS 3", "SS 1", "SS 2", "SS 3"];

export function ApplyForm({ schoolId, classes }: { schoolId: string; classes?: string[] }) {
  const options = classes?.length ? classes : CLASSES;
  const [state, action] = useActionState<ApplyState, FormData>(applyForAdmission, {});
  if (state.ok) {
    return (
      <div role="status" className="flex flex-col items-start gap-3">
        <span aria-hidden="true" className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-[#E7F6F2]">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0B6B5A" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </span>
        <h4 className="text-xl font-extrabold text-brand-slate">Application received</h4>
        <p className="text-[15px] text-[#4A5560]">Thank you. The school has your application and will contact you soon.</p>
      </div>
    );
  }
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="school_id" value={schoolId} />
      <div className="sm:col-span-2">
        <label htmlFor="child_name" className="label">Child&apos;s full name</label>
        <input id="child_name" name="child_name" required autoComplete="off" className="sk-input" />
      </div>
      <div>
        <label htmlFor="date_of_birth" className="label">Date of birth</label>
        <input id="date_of_birth" name="date_of_birth" type="date" className="sk-input" />
      </div>
      <div>
        <label htmlFor="class_applied" className="label">Class applying for</label>
        <select id="class_applied" name="class_applied" className="sk-input sk-select" defaultValue="">
          <option value="" disabled>
            Choose a class
          </option>
          {options.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="gender" className="label">Gender</label>
        <select id="gender" name="gender" className="sk-input sk-select" defaultValue="">
          <option value="">Prefer not to say</option>
          <option value="female">Female</option>
          <option value="male">Male</option>
        </select>
      </div>
      <div>
        <label htmlFor="previous_school" className="label">Current school (optional)</label>
        <input id="previous_school" name="previous_school" maxLength={120} autoComplete="off" className="sk-input" />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="parent_name" className="label">Parent&apos;s full name</label>
        <input id="parent_name" name="parent_name" required autoComplete="name" className="sk-input" />
      </div>
      <div>
        <label htmlFor="parent_phone" className="label">Phone number</label>
        <input id="parent_phone" name="parent_phone" type="tel" required autoComplete="tel" className="sk-input" />
      </div>
      <div>
        <label htmlFor="parent_email" className="label">Email (optional)</label>
        <input id="parent_email" name="parent_email" type="email" autoComplete="email" className="sk-input" />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="notes" className="label">Anything we should know?</label>
        <textarea id="notes" name="notes" rows={3} className="sk-input" />
      </div>
      {state.error && (
        <p role="alert" className="rounded-xl bg-[#FEF3F2] px-4 py-3 text-sm font-semibold text-[#912018] sm:col-span-2">
          {state.error}
        </p>
      )}
      <div className="sm:col-span-2">
        <Submit />
      </div>
    </form>
  );
}
