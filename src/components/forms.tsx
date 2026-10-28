"use client";

import { createContext, startTransition, useContext, useEffect, useRef } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

export type ActionState = { ok?: boolean; error?: string | null; message?: string | null; at?: number };

/** Set by ActionForm (which submits without React's automatic form reset). */
const Pending = createContext<boolean | null>(null);

export function SubmitButton({ children, pending, className = "s-btn" }: { children: React.ReactNode; pending?: string; className?: string }) {
  const fromForm = useContext(Pending);
  const { pending: status } = useFormStatus();
  const busy = fromForm ?? status;
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
  const [state, run, busy] = useActionState(action, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok && resetOnSuccess) ref.current?.reset();
    if (state.ok) onSuccess?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, resetOnSuccess]);
  return (
    // Submitted by hand rather than with action={...}: React would otherwise clear every
    // field after each submit, so a typo in one field would wipe the whole form.
    <form
      ref={ref}
      id={id}
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        if (busy) return;
        const data = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
        startTransition(() => run(data));
      }}
    >
      <Pending.Provider value={busy}>{children}</Pending.Provider>
      <FormMessage state={state} />
    </form>
  );
}
