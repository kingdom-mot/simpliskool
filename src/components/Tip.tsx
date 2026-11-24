"use client";

import { useEffect, useId, useRef, useState } from "react";

const WIDTH = 280;

/**
 * A small "?" that explains something in plain words. It opens on hover, keyboard focus or a tap,
 * stays open while the pointer is over it, and closes with Escape or a tap elsewhere. It opens
 * towards whichever side has room, so it never runs off a phone screen.
 * Put it next to a label or heading, never inside a <label> (it would change the field's name).
 */
export function Tip({ children, label = "What does this mean?", align = "left", light = false }: { children: React.ReactNode; label?: string; align?: "left" | "right" | "center"; light?: boolean }) {
  const [tapped, setTapped] = useState(false);
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [hushed, setHushed] = useState(false);
  const [side, setSide] = useState(align);
  const wrap = useRef<HTMLSpanElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setTapped(false);
        setHushed(true);
      }
    };
    const tap = (e: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setTapped(false);
    };
    document.addEventListener("keydown", key);
    document.addEventListener("pointerdown", tap);
    return () => {
      document.removeEventListener("keydown", key);
      document.removeEventListener("pointerdown", tap);
    };
  }, []);

  /** Opens towards the side with room: right-aligned near the right edge, left-aligned near the left. */
  const place = () => {
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    const w = Math.min(WIDTH, window.innerWidth * 0.78);
    const vw = window.innerWidth;
    if (align === "center" && r.left + r.width / 2 - w / 2 >= 8 && r.left + r.width / 2 + w / 2 <= vw - 8) setSide("center");
    else if (r.left + w <= vw - 8) setSide("left");
    else if (r.right - w >= 8) setSide("right");
    else setSide("center");
  };

  const open = !hushed && (tapped || hover || focus);
  const pos = side === "right" ? "right-0" : side === "center" ? "left-1/2 -translate-x-1/2" : "left-0";
  return (
    <span
      ref={wrap}
      className="relative inline-flex align-middle"
      onMouseEnter={() => {
        place();
        setHover(true);
      }}
      onMouseLeave={() => {
        setHover(false);
        setHushed(false);
      }}
    >
      <button
        ref={btn}
        type="button"
        aria-label={label}
        aria-describedby={id}
        aria-expanded={open}
        onFocus={() => {
          place();
          setFocus(true);
        }}
        onBlur={() => {
          setFocus(false);
          setHushed(false);
        }}
        onClick={() => {
          place();
          setTapped((t) => !t);
          setHushed(false);
        }}
        className={`ml-1 inline-flex h-6 w-6 flex-none items-center justify-center rounded-full border-[1.5px] text-[12px] font-extrabold leading-none ${light ? "border-white/70 text-white hover:bg-white/15" : "border-[#9FB0C6] bg-white text-[#4A5A70] hover:border-c1 hover:text-c1"}`}
      >
        ?
      </button>
      <span
        role="tooltip"
        id={id}
        className={`absolute top-full z-50 mt-1.5 w-[min(280px,78vw)] rounded-xl bg-[#0A1F3D] px-3 py-2.5 text-left text-[13px] font-medium normal-case leading-snug tracking-normal text-white shadow-[0_14px_32px_-10px_rgba(10,31,61,0.6)] ${pos} ${open ? "block" : "hidden"}`}
      >
        {children}
      </span>
    </span>
  );
}

/** A form label with a tip beside it. */
export function TipLabel({ htmlFor, children, tip, align }: { htmlFor: string; children: React.ReactNode; tip: React.ReactNode; align?: "left" | "right" | "center" }) {
  return (
    <div className="mb-1 flex items-center">
      <label className="label !mb-0" htmlFor={htmlFor}>
        {children}
      </label>
      <Tip align={align}>{tip}</Tip>
    </div>
  );
}
