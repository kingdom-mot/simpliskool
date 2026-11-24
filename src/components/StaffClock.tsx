"use client";

import { startTransition, useActionState, useRef, useState } from "react";
import type { ActionState } from "@/components/forms";
import { requestDuty, selfClock } from "@/lib/staff-clock-actions";

export type MyClock = {
  geo_set: boolean;
  late_after: string;
  close_at: string | null;
  clock_in: string | null;
  clock_out: string | null;
  status: "present" | "absent" | "leave" | "duty" | null;
  duty_request: string | null;
  duty_state: "pending" | "approved" | "declined" | null;
};

const tm = (iso: string) =>
  new Date(iso)
    .toLocaleTimeString("en-GB", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "Africa/Lagos",
    })
    .replace(" ", "")
    .toLowerCase();
const hm = (h: string) => {
  const [H, M] = h.split(":").map(Number);
  return `${H % 12 || 12}:${String(M).padStart(2, "0")}${H >= 12 ? "pm" : "am"}`;
};
const hhmm = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Africa/Lagos",
  }).format(new Date(iso));

/**
 * Clock in and out from your own phone. The button asks the phone for its location and the server
 * checks it is at school; the time is the server's, not the phone's.
 */
export function StaffClock({ c }: { c: MyClock }) {
  const [state, run, pending] = useActionState<ActionState, FormData>(
    selfClock,
    {},
  );
  const [dutyState, sendDuty, dutyPending] = useActionState<
    ActionState,
    FormData
  >(requestDuty, {});
  const [finding, setFinding] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const live = useRef<HTMLParagraphElement>(null);

  const clock = (kind: "in" | "out") => {
    setGeoError(null);
    if (!("geolocation" in navigator)) {
      setGeoError(
        "This browser can't share your location. Open Simpliskool in Chrome or Safari on your phone.",
      );
      return;
    }
    setFinding(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFinding(false);
        const fd = new FormData();
        fd.set("kind", kind);
        fd.set("lat", String(pos.coords.latitude));
        fd.set("lng", String(pos.coords.longitude));
        fd.set("accuracy", String(pos.coords.accuracy));
        startTransition(() => run(fd));
      },
      (err) => {
        setFinding(false);
        setGeoError(
          err.code === err.PERMISSION_DENIED
            ? "Simpliskool needs your location to clock you in. Allow location for this site in your browser settings, then try again."
            : "Your phone couldn't find your location. Turn on Location (GPS), move near a window or outside, and try again.",
        );
      },
      { enableHighAccuracy: true, timeout: 25000, maximumAge: 0 },
    );
  };

  const late = c.clock_in && hhmm(c.clock_in) > c.late_after;
  const early = c.clock_out && c.close_at && hhmm(c.clock_out) < c.close_at;
  const busy = finding || pending;
  const msg = geoError ?? state.error ?? null;

  return (
    <section
      aria-labelledby="clock-h"
      className="rounded-[20px] border border-[#DCE5F0] bg-white p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="clock-h" className="text-lg">
            My attendance today
          </h2>
          <p className="mt-0.5 text-sm text-[#4A5A70]">
            Late after {hm(c.late_after)}
            {c.close_at ? ` · Closing ${hm(c.close_at)}` : ""} · Clock in and
            out at school
          </p>
        </div>
        {c.clock_in && (
          <span
            className={`rounded-full px-3 py-1 text-xs font-extrabold ${late ? "bg-[#FFF1D6] text-[#7A5300]" : "bg-[#E2F5F1] text-[#07665A]"}`}
          >
            {late ? "Late" : "On time"}
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {c.status === "leave" ? (
          <p className="text-[15px] font-semibold text-brand-slate">
            You&apos;re marked on leave today.
          </p>
        ) : !c.geo_set ? (
          <p className="text-[15px] text-brand-slate">
            Clocking in opens once the school owner sets the school&apos;s
            location on the Staff attendance page.
          </p>
        ) : !c.clock_in ? (
          <button
            type="button"
            onClick={() => clock("in")}
            disabled={busy}
            className="s-btn min-h-[52px] px-6 text-base"
          >
            {finding
              ? "Finding your location…"
              : pending
                ? "Clocking in…"
                : "Clock in"}
          </button>
        ) : (
          <>
            <p className="text-[15px] text-brand-slate">
              In at <strong>{tm(c.clock_in)}</strong>
              {c.clock_out ? (
                <>
                  {" "}
                  · Out at <strong>{tm(c.clock_out)}</strong>
                  {early && (
                    <span className="ml-2 rounded-full bg-[#FFF1D6] px-2.5 py-0.5 text-xs font-extrabold text-[#7A5300]">
                      Left early
                    </span>
                  )}
                </>
              ) : null}
            </p>
            {!c.clock_out && (
              <button
                type="button"
                onClick={() => clock("out")}
                disabled={busy}
                className="s-btn2 min-h-[48px]"
              >
                {finding
                  ? "Finding your location…"
                  : pending
                    ? "Clocking out…"
                    : "Clock out"}
              </button>
            )}
          </>
        )}
      </div>

      <p
        ref={live}
        role="status"
        aria-live="polite"
        className={`mt-3 text-sm font-semibold empty:hidden ${msg ? "text-[#912018]" : "text-[#07665A]"}`}
      >
        {msg ?? (state.ok ? state.message : "")}
      </p>

      {c.status !== "leave" && (
        <div className="mt-3 border-t border-[#EEF3F9] pt-3">
          {c.duty_state === "pending" ? (
            <p className="text-sm text-brand-slate">
              <span className="mr-2 rounded-full bg-[#E8F0FB] px-2.5 py-0.5 text-xs font-extrabold text-brand-navy">
                Waiting for the principal
              </span>
              Official duty: {c.duty_request}
            </p>
          ) : c.duty_state === "approved" ? (
            <p className="text-sm text-brand-slate">
              <span className="mr-2 rounded-full bg-[#E2F5F1] px-2.5 py-0.5 text-xs font-extrabold text-[#07665A]">
                Approved
              </span>
              Official duty: {c.duty_request}
            </p>
          ) : (
            <details className="group">
              <summary className="inline-flex min-h-[44px] cursor-pointer list-none items-center text-sm font-bold text-c1 underline underline-offset-2 [&::-webkit-details-marker]:hidden">
                I&apos;m on official duty
              </summary>
              {c.duty_state === "declined" && (
                <p className="mb-2 text-sm text-[#912018]">
                  The principal declined your last request.
                </p>
              )}
              <form action={sendDuty} className="mt-1 flex flex-col gap-2">
                <label htmlFor="duty-note" className="label !mb-0">
                  Where are you, and why?
                </label>
                <input
                  id="duty-note"
                  name="note"
                  className="sk-input"
                  maxLength={200}
                  placeholder="For example: At the exam board in Ikeja"
                  required
                />
                <button className="s-btn2 self-start" disabled={dutyPending}>
                  {dutyPending ? "Sending…" : "Send to the principal"}
                </button>
                <p
                  role="status"
                  className={`text-sm font-semibold empty:hidden ${dutyState.error ? "text-[#912018]" : "text-[#07665A]"}`}
                >
                  {dutyState.error ?? (dutyState.ok ? dutyState.message : "")}
                </p>
              </form>
            </details>
          )}
        </div>
      )}
    </section>
  );
}
