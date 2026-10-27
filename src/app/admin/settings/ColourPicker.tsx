"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { DEFAULT_MAIN, DEFAULT_SECOND, SCHOOL_PALETTE, schoolColours } from "@/lib/theme";
import { saveColours } from "./actions";

const nameOf = (hex: string) => SCHOOL_PALETTE.find((c) => c.hex === hex)?.name ?? hex;

/** Pick 0, 1 or 2 school colours from the palette, with a live preview. */
export function ColourPicker({ schoolName, initial }: { schoolName: string; initial: string[] }) {
  const [chosen, setChosen] = useState<string[]>(initial.filter((h) => SCHOOL_PALETTE.some((c) => c.hex === h)).slice(0, 2));
  const [full, setFull] = useState(false);
  const { c1, c2 } = schoolColours(chosen[0], chosen[1]);

  function toggle(hex: string) {
    if (chosen.includes(hex)) {
      setChosen(chosen.filter((h) => h !== hex));
      setFull(false);
    } else if (chosen.length >= 2) setFull(true);
    else {
      setChosen([...chosen, hex]);
      setFull(false);
    }
  }

  return (
    <ActionForm action={saveColours} className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[1.3fr_1fr]">
      {chosen.map((h) => (
        <input key={h} type="hidden" name="colour" value={h} />
      ))}
      <fieldset className="flex flex-col gap-3">
        <legend className="label">School colours (website, portals and report cards)</legend>
        <p id="col-h" className="text-sm text-[#4A5A70]">
          Choose up to 2 colours: a main colour and a second colour. Choose none to use the Simpliskool colours.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <span aria-live="polite" className="rounded-full bg-[#EEF3F9] px-3 py-1.5 text-sm font-extrabold text-[#173B70]">
            {chosen.length} of 2 chosen
          </span>
          {chosen.map((h, i) => (
            <span key={h} className="flex items-center gap-2 rounded-full border border-[#DCE5F0] bg-white py-1 pl-1.5 pr-1 text-sm font-bold">
              <span aria-hidden="true" className="h-6 w-6 rounded-full" style={{ background: h }} />
              {i === 0 ? "Main colour" : "Second colour"}: {nameOf(h)}
              <button type="button" onClick={() => toggle(h)} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-brand-cloud">
                <span aria-hidden="true">×</span>
                <span className="sr-only">Remove {nameOf(h)}</span>
              </button>
            </span>
          ))}
        </div>
        <div role="group" aria-describedby="col-h" className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {SCHOOL_PALETTE.map((c) => {
            const idx = chosen.indexOf(c.hex);
            const on = idx >= 0;
            return (
              <button
                key={c.hex}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(c.hex)}
                className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-2 text-[13px] font-bold ${on ? "border-brand-slate" : "border-[#E3EAF3]"}`}
              >
                <span
                  aria-hidden="true"
                  className="flex h-10 w-full items-center justify-center rounded-lg text-sm font-black text-white"
                  style={{ background: c.hex, opacity: !on && chosen.length >= 2 ? 0.45 : 1 }}
                >
                  {on ? idx + 1 : ""}
                </span>
                <span className="text-center leading-tight text-brand-slate">
                  {c.name}
                  {on && <span className="sr-only">, {idx === 0 ? "main colour" : "second colour"}</span>}
                </span>
              </button>
            );
          })}
        </div>
        {full && (
          <p role="status" className="rounded-xl bg-[#FFF6E3] px-4 py-3 text-sm font-semibold text-[#5C4310]">
            You&apos;ve chosen 2 colours, the maximum. Remove one to pick a different colour.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="s-btn2"
            onClick={() => {
              setChosen([]);
              setFull(false);
            }}
          >
            Use Simpliskool colours (none)
          </button>
          <span className="text-[13px] text-[#4A5A70]">Every colour here is dark enough for white text, so your pages stay readable.</span>
        </div>
      </fieldset>

      <div className="flex flex-col gap-3">
        <span className="label">Preview</span>
        <div className="overflow-hidden rounded-2xl border border-[#E3EAF3] bg-white">
          <div className="px-4 py-3 font-heading text-lg font-extrabold text-white" style={{ background: c1 }}>
            {schoolName}
          </div>
          <div className="flex flex-col gap-2 p-4">
            <span className="text-sm text-brand-slate">First Term Report Card</span>
            <span aria-hidden="true" className="h-1.5 rounded-full" style={{ background: `linear-gradient(90deg, ${c1} 0 60%, ${c2} 60% 100%)` }} />
            <span className="text-[13px] text-[#4A5A70]">
              {chosen.length === 0 ? "No colours chosen: Simpliskool navy and teal." : chosen.length === 1 ? "Main colour for headers; Simpliskool teal for buttons." : "Main colour for headers, second colour for buttons and highlights."}
            </span>
            <span className="self-start rounded-lg px-3 py-2 text-sm font-bold text-white" style={{ background: c2 }}>
              Apply now
            </span>
          </div>
        </div>
        <div>
          <SubmitButton>Save colours</SubmitButton>
        </div>
        <p className="text-[13px] text-[#4A5A70]">
          Simpliskool colours: navy <span className="font-mono">{DEFAULT_MAIN}</span> and teal <span className="font-mono">{DEFAULT_SECOND}</span>.
        </p>
      </div>
    </ActionForm>
  );
}
