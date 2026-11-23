"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { matches } from "@/lib/paging";

export type PickerOption = {
  value: string;
  /** Main line, e.g. the student's name. */
  label: string;
  /** Second line, e.g. "JSS 2A · owes ₦45,000". */
  sub?: string;
  /** Extra words the search should find (admission number, phone…). */
  keywords?: string;
};

const SHOW = 60;

/**
 * A type-to-search picker that replaces a long dropdown. Type part of a name
 * (or any keyword) and pick from the matches with the mouse, a tap, or the
 * arrow keys and Enter. The chosen value is sent with the form under `name`.
 */
export function Picker({
  id,
  name,
  label,
  options,
  defaultValue,
  required = false,
  placeholder = "Type a name to search",
  emptyText = "No matches. Check the spelling or try part of the name.",
  hint,
}: {
  id: string;
  name: string;
  label: string;
  options: PickerOption[];
  defaultValue?: string;
  required?: boolean;
  placeholder?: string;
  emptyText?: string;
  hint?: string;
}) {
  const start = options.find((o) => o.value === defaultValue);
  const [value, setValue] = useState(start?.value ?? "");
  const [text, setText] = useState(start?.label ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const uid = useId();
  const listId = `${id}-list`;
  const hintId = hint ? `${id}-hint` : undefined;
  const statusId = `${id}-status`;

  // A choice that is no longer in the list (e.g. the student has now paid in full) counts as no choice.
  const chosen = options.find((o) => o.value === value);
  const picked = chosen ? value : "";
  // While a choice is shown, list everything; once the person types, filter.
  const typing = !chosen || text !== chosen.label;
  const found = useMemo(() => (typing ? options.filter((o) => matches(text, o.label, o.sub, o.keywords)) : options), [options, text, typing]);
  const shown = found.slice(0, SHOW);

  // Clear when the form is reset after a successful save.
  useEffect(() => {
    const form = input.current?.form;
    if (!form) return;
    const onReset = () => {
      setValue("");
      setText("");
      setOpen(false);
    };
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, []);

  // Tell the browser's own form check when something is typed but not picked.
  useEffect(() => {
    input.current?.setCustomValidity(!picked && text.trim() ? "Choose one from the list." : "");
  }, [picked, text]);

  // Keep the highlighted match in view.
  useEffect(() => {
    if (!open) return;
    list.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const pick = (o: PickerOption) => {
    setValue(o.value);
    setText(o.label);
    setOpen(false);
  };

  return (
    <div className="relative">
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <input type="hidden" name={name} value={picked} />
      <input
        ref={input}
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && shown[active] ? `${uid}-o${active}` : undefined}
        aria-describedby={[hintId, statusId].filter(Boolean).join(" ")}
        autoComplete="off"
        spellCheck={false}
        required={required}
        className="sk-input"
        placeholder={placeholder}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setValue("");
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((a) => Math.min(a + 1, Math.max(0, shown.length - 1)));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && open && shown[active]) {
            e.preventDefault();
            pick(shown[active]);
          } else if (e.key === "Escape") {
            if (open) {
              e.preventDefault();
              setOpen(false);
            }
          }
        }}
      />
      {hint && (
        <p id={hintId} className="mt-1 text-[13px] text-[#4A5A70]">
          {hint}
        </p>
      )}
      <p id={statusId} className="sr-only" aria-live="polite">
        {open && typing && text.trim() ? (found.length ? `${found.length} match${found.length === 1 ? "" : "es"}. Use the arrow keys to choose.` : emptyText) : ""}
      </p>
      <ul
        ref={list}
        id={listId}
        role="listbox"
        aria-label={label}
        hidden={!open}
        className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-xl border border-[#DCE5F0] bg-white p-1 shadow-[0_18px_40px_-12px_rgba(15,42,82,0.3)]"
      >
        {shown.map((o, i) => (
          <li
            key={o.value}
            id={`${uid}-o${i}`}
            data-i={i}
            role="option"
            aria-selected={o.value === picked}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => pick(o)}
            onMouseMove={() => setActive(i)}
            className={`flex min-h-[44px] cursor-pointer flex-col justify-center rounded-lg px-3 py-2 ${i === active ? "bg-brand-cloud" : ""}`}
          >
            <span className="font-bold text-[#1B2433]">{o.label}</span>
            {o.sub && <span className="text-[13px] text-[#4A5A70]">{o.sub}</span>}
          </li>
        ))}
        {!shown.length && <li className="px-3 py-3 text-sm text-[#4A5A70]">{emptyText}</li>}
        {found.length > SHOW && <li className="px-3 py-2 text-[13px] text-[#4A5A70]">Showing the first {SHOW} of {found.length}. Keep typing to narrow it down.</li>}
      </ul>
    </div>
  );
}
