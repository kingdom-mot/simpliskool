"use client";

import { useEffect, useRef } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

export type ActionState = { ok?: boolean; error?: string | null; message?: string | null; at?: number };

export function SubmitButton({ children, pending, className = "s-btn" }: { children: React.ReactNode; pending?: string; className?: string }) {
  const { pending: busy } = useFormStatus();
  return (
    <button className={className} disabled={busy} aria-disabled={busy}>
      {busy ? (pending ?? "Saving…") : children}
    </button>
  );
}

export function FormMessage({ state }: { state: ActionState }) {
  if (state.error) {
    return (
      <p role="alert" className="rounded-xl bg-[#FEF3F2] px-4 py-3 text-sm font-semibold text-[#912018]">
        {state.error}
      </p>
    );
  }
  if (state.ok && state.message) {
    return (
      <p role="status" className="rounded-xl bg-[#E7F6F2] px-4 py-3 text-sm font-semibold text-[#0B6B5A]">
        {state.message}
      </p>
    );
  }
  return <p role="status" className="sr-only" />;
}

/**
 * A form that runs a server action and shows its success or error message.
 * `resetOnSuccess` clears the fields after a successful save (for "add" forms).
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
  id,
  onSuccess,
}: {
  action: (prev: ActionState, data: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  /** Lets fields elsewhere on the page join this form with form="id". */
  id?: string;
  /** Called after each successful save (e.g. to clear a form's own state). */
  onSuccess?: () => void;
}) {
  const [state, run] = useActionState(action, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok && resetOnSuccess) ref.current?.reset();
    if (state.ok) onSuccess?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, resetOnSuccess]);
  return (
    <form ref={ref} id={id} action={run} className={className}>
      {children}
      <FormMessage state={state} />
    </form>
  );
}
