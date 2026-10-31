"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { publishNotice } from "../actions";

const LOOK = {
  feat: { bg: "#E7F6F2", fg: "#0B4F43", icon: "★", label: "New feature", hl: "New: share lesson notes with your class in one tap" },
  down: { bg: "#FFF6E3", fg: "#5C3E00", icon: "!", label: "Planned downtime", hl: "Planned maintenance: Sunday, 1am to 3am" },
  change: { bg: "#EEF3F9", fg: "#173B70", icon: "i", label: "Important change", hl: "Change to how payouts work" },
};
type Kind = keyof typeof LOOK;

/** New notice form with a live preview of how it looks in a school's portal. */
export function NoticeComposer({ schools, defaultUntil }: { schools: { id: string; name: string }[]; defaultUntil: string }) {
  const [kind, setKind] = useState<Kind>("feat");
  const [hl, setHl] = useState("");
  const [det, setDet] = useState("");
  const [aud, setAud] = useState("admins");
  const L = LOOK[kind];
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 xl:grid-cols-2">
      <section aria-labelledby="nn-h" className="flex flex-col gap-3.5 rounded-[18px] border border-[#E3EAF3] bg-white p-[22px]">
        <h2 id="nn-h" className="text-lg !text-c1">
          New notice
        </h2>
        <ActionForm
          action={publishNotice}
          resetOnSuccess
          onSuccess={() => {
            setHl("");
            setDet("");
          }}
          className="flex flex-col gap-3.5"
        >
          <fieldset>
            <legend className="label">Type</legend>
            <div className="flex flex-wrap gap-x-5">
              {(Object.keys(LOOK) as Kind[]).map((k) => (
                <label key={k} className="flex min-h-[44px] items-center gap-2 text-sm font-semibold">
                  <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="h-5 w-5" />
                  {LOOK[k].label}
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <label className="label" htmlFor="nh">
              Headline
            </label>
            <input id="nh" name="headline" className="sk-input" required minLength={3} maxLength={120} value={hl} onChange={(e) => setHl(e.target.value)} placeholder={L.hl} />
          </div>
          <div>
            <label className="label" htmlFor="nb">
              Details
            </label>
            <textarea id="nb" name="details" rows={3} className="sk-input" maxLength={500} value={det} onChange={(e) => setDet(e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="na">
                Who sees it
              </label>
              <select id="na" name="audience" className="sk-input" value={aud} onChange={(e) => setAud(e.target.value)}>
                <option value="admins">All school owners and admins</option>
                <option value="bursars">Bursars (and owners)</option>
                <option value="pilot">Pilot schools</option>
                <option value="chosen">Choose schools…</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="nd">
                Show until
              </label>
              <input id="nd" name="show_until" type="date" className="sk-input" required defaultValue={defaultUntil} />
            </div>
          </div>
          {aud === "chosen" && (
            <fieldset className="max-h-56 overflow-y-auto rounded-xl border border-[#E3EAF3] px-3 py-2">
              <legend className="label px-1">Schools</legend>
              {schools.map((s) => (
                <label key={s.id} className="flex min-h-[40px] items-center gap-2 text-sm">
                  <input type="checkbox" name="schools" value={s.id} className="h-5 w-5" />
                  {s.name}
                </label>
              ))}
            </fieldset>
          )}
          <label className="flex min-h-[44px] items-center gap-2 text-sm font-semibold">
            <input type="checkbox" name="email_owners" className="h-5 w-5" />
            Also email it to school owners
          </label>
          <div className="flex justify-end">
            <SubmitButton pending="Publishing…">Publish notice</SubmitButton>
          </div>
        </ActionForm>
      </section>
      <section aria-labelledby="pv-h" className="flex flex-col gap-2.5">
        <h2 id="pv-h" className="text-lg !text-c1">
          How it looks in a school&apos;s portal
        </h2>
        <div role="presentation" className="flex items-start gap-3 rounded-[14px] px-4 py-3.5" style={{ background: L.bg, color: L.fg }}>
          <span aria-hidden="true" className="text-lg font-black">
            {L.icon}
          </span>
          <span className="flex-1">
            <strong className="block">{hl || L.hl}</strong>
            {det && <span className="mt-0.5 block text-sm">{det}</span>}
          </span>
          <span aria-hidden="true" className="font-extrabold">
            ×
          </span>
        </div>
        <p className="text-sm text-[#4A5A70]">Admins can hide a notice with ×. It stops showing after the last day.</p>
      </section>
    </div>
  );
}
