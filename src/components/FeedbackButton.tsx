"use client";

import { usePathname } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/components/forms";
import { sendFeedback } from "@/lib/feedback-actions";

const KINDS = [
  ["problem", "Something isn't working"],
  ["hard", "Something is hard to use"],
  ["idea", "I have an idea"],
  ["like", "Something I like"],
] as const;

function Send() {
  const { pending } = useFormStatus();
  return (
    <button className="s-btn" disabled={pending}>
      {pending ? "Sending…" : "Send feedback"}
    </button>
  );
}

/**
 * A small "Feedback" button that stays in the corner of every school portal. It opens a short
 * form; the page the person was on is sent with it so the team can see where the problem is.
 */
/** raised: above bottom tabs (always, or "phone" for layouts whose tabs show only on phones). */
export function FeedbackButton({ raised = false }: { raised?: boolean | "phone" }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const page = usePathname();
  const [state, action] = useActionState<ActionState, FormData>(sendFeedback, {});
  const [done, setDone] = useState<number | null>(null);

  useEffect(() => {
    if (!state.ok || !state.at || state.at === done) return;
    form.current?.reset();
    const t = setTimeout(() => {
      setDone(state.at ?? null);
      dialog.current?.close();
    }, 2200);
    return () => clearTimeout(t);
  }, [state, done]);

  const showThanks = state.ok && state.at !== done;

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className={`fixed right-4 z-40 flex min-h-[44px] items-center gap-2 rounded-full bg-c1 px-4 text-sm font-bold text-white shadow-[0_10px_28px_-8px_rgba(10,31,61,0.55)] hover:opacity-90 print:hidden ${raised === "phone" ? "bottom-[84px] md:bottom-4" : raised ? "bottom-[84px]" : "bottom-4"}`}
      >
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        Feedback
      </button>
      <dialog ref={dialog} aria-labelledby="fb-h" className="w-[min(92vw,480px)] rounded-[20px] p-0 backdrop:bg-[#0A1F3D]/50">
        <div className="flex flex-col gap-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="fb-h" className="text-lg !text-c1">
                Send feedback
              </h2>
              <p className="text-sm text-[#4A5A70]">Tell the Simpliskool team what&apos;s working and what isn&apos;t. Every message is read.</p>
            </div>
            <button type="button" onClick={() => dialog.current?.close()} className="flex h-11 w-11 flex-none items-center justify-center rounded-full text-[#4A5A70] hover:bg-brand-cloud" aria-label="Close">
              <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
          {showThanks ? (
            <p role="status" className="rounded-xl bg-[#E7F6F2] px-4 py-3 text-sm font-semibold text-[#0B6B5A]">
              {state.message}
            </p>
          ) : (
            <form ref={form} action={action} className="flex flex-col gap-4">
              <input type="hidden" name="page" value={page} />
              <fieldset>
                <legend className="label">What is it about?</legend>
                <div className="grid grid-cols-[minmax(0,1fr)] gap-1.5 sm:grid-cols-2">
                  {KINDS.map(([v, l], i) => (
                    <label key={v} className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border-[1.5px] border-[#DCE5F0] px-3 text-sm font-semibold has-[:checked]:border-c1 has-[:checked]:bg-brand-cloud">
                      <input type="radio" name="kind" value={v} defaultChecked={i === 0} className="h-4 w-4" />
                      {l}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div>
                <label className="label" htmlFor="fb-msg">
                  Your message
                </label>
                <textarea id="fb-msg" name="message" rows={4} required minLength={3} maxLength={2000} className="sk-input min-h-[100px] py-3" placeholder="e.g. The register page was slow this morning." />
              </div>
              <fieldset>
                <legend className="label">How easy is Simpliskool to use? (optional)</legend>
                <div className="flex flex-wrap items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <label key={n} className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border-[1.5px] border-[#DCE5F0] text-sm font-bold has-[:checked]:border-c1 has-[:checked]:bg-c1 has-[:checked]:text-white">
                      <input type="radio" name="rating" value={n} className="sr-only" />
                      {n}
                      <span className="sr-only">{n === 1 ? " (very hard)" : n === 5 ? " (very easy)" : ""}</span>
                    </label>
                  ))}
                  <span className="text-xs text-[#4A5A70]">1 very hard · 5 very easy</span>
                </div>
              </fieldset>
              {state.error && (
                <p role="alert" className="rounded-xl bg-[#FEF3F2] px-4 py-3 text-sm font-semibold text-[#912018]">
                  {state.error}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Send />
                <button type="button" className="s-btn2" onClick={() => dialog.current?.close()}>
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </dialog>
    </>
  );
}
