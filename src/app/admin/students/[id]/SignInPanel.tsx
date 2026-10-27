"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { PinSlip, type Slip } from "@/components/PinSlip";
import { resetStudentPin } from "@/lib/student-pin";
import { setOwnSignIn } from "../actions";

export function SignInPanel(props: {
  studentId: string;
  firstName: string;
  name: string;
  className: string;
  admissionNo: string;
  schoolName: string;
  schoolCode: string;
  loginHost: string;
  method: "pin" | "own";
  hasPin: boolean;
  pinSetAt: string | null;
  failedCount: number;
  ownContact: string | null;
}) {
  const [method, setMethod] = useState(props.method);
  const [slip, setSlip] = useState<Slip | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPin, setHasPin] = useState(props.hasPin);

  async function newPin() {
    if (hasPin && !confirm(`Make a new PIN for ${props.firstName}? The old PIN will stop working.`)) return;
    setBusy(true);
    setError(null);
    const res = await resetStudentPin(props.studentId).catch(() => ({ ok: false as const, error: "Connection lost. Please try again." }));
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setHasPin(true);
    setMethod("pin");
    setSlip({ name: props.name, className: props.className, admissionNo: res.admissionNo, pin: res.pin });
  }

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">How {props.firstName} signs in</legend>
        {(
          [
            ["pin", "Admission number + PIN", "For younger students without their own phone or email"],
            ["own", "Own phone or email", "A one-time code is sent each time they sign in"],
          ] as const
        ).map(([k, title, hint]) => (
          <label key={k} className="flex min-h-[56px] cursor-pointer items-start gap-3 rounded-xl border-[1.5px] p-3" style={{ borderColor: method === k ? "var(--c2,#0B7D6E)" : "#DCE5F0" }}>
            <input type="radio" name="method" value={k} checked={method === k} onChange={() => setMethod(k)} className="mt-1 h-5 w-5 accent-[var(--c2,#0B7D6E)]" />
            <span>
              <strong className="block text-brand-slate">{title}</strong>
              <span className="block text-[13px] text-[#4A5A70]">{hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {method === "pin" ? (
        <div className="flex flex-col gap-3">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-[13px] font-semibold text-[#4A5A70]">Admission number</dt>
              <dd className="font-bold text-c1">{props.admissionNo}</dd>
            </div>
            <div>
              <dt className="text-[13px] font-semibold text-[#4A5A70]">PIN</dt>
              <dd className="font-bold text-c1">
                {hasPin && props.method === "pin"
                  ? `Set ${props.pinSetAt ? new Date(props.pinSetAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : ""}${props.failedCount ? ` · ${props.failedCount} wrong tries` : ""}`
                  : slip
                    ? "Just created"
                    : "No PIN yet"}
              </dd>
            </div>
          </dl>
          {slip && (
            <div role="status" className="flex flex-col gap-3 rounded-2xl bg-[#FFF6E3] p-4">
              <p className="text-sm font-bold text-[#5C4310]">New PIN, shown only once. Print the slip or write it down now. The old PIN no longer works.</p>
              <div className="print-area">
                <PinSlip slip={slip} schoolName={props.schoolName} schoolCode={props.schoolCode} loginHost={props.loginHost} />
              </div>
              <div>
                <button type="button" className="s-btn" onClick={() => window.print()}>
                  Print slip
                </button>
              </div>
            </div>
          )}
          {error && (
            <p role="alert" className="rounded-xl bg-[#FEF3F2] px-4 py-3 text-sm font-semibold text-[#912018]">
              {error}
            </p>
          )}
          <div>
            <button type="button" className="s-btn2" onClick={newPin} disabled={busy}>
              {busy ? "Making a PIN…" : hasPin && props.method === "pin" ? "Reset PIN and print slip" : "Create PIN and print slip"}
            </button>
          </div>
          <p className="text-[13px] text-[#4A5A70]">After 5 wrong PINs the account locks for 15 minutes.</p>
        </div>
      ) : (
        <ActionForm action={setOwnSignIn} className="flex flex-col gap-3">
          <input type="hidden" name="student_id" value={props.studentId} />
          <div>
            <label className="label" htmlFor="own-contact">
              {props.firstName}&apos;s own phone number or email
            </label>
            <input className="sk-input" id="own-contact" name="contact" defaultValue={props.ownContact ?? ""} required placeholder="08031234567 or name@gmail.com" />
          </div>
          <div>
            <SubmitButton>Save</SubmitButton>
          </div>
        </ActionForm>
      )}
    </div>
  );
}
