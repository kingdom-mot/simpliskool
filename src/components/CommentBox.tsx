"use client";

import { useState } from "react";

/** Comment textarea with a "Suggest a starting comment" button built from the student's results. */
export function CommentBox({ id, name, label, initial, suggestion, hint }: { id: string; name: string; label: string; initial: string; suggestion: string; hint?: string }) {
  const [v, setV] = useState(initial);
  const [used, setUsed] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="label !mb-0" htmlFor={id}>
          {label}
        </label>
        {suggestion && (
          <button
            type="button"
            className="s-btn2 !min-h-[40px] !px-3 text-sm"
            onClick={() => {
              setV(suggestion);
              setUsed(true);
            }}
          >
            Suggest a starting comment
          </button>
        )}
      </div>
      <textarea id={id} name={name} rows={4} maxLength={600} className="sk-input min-h-[110px] py-3" value={v} onChange={(e) => setV(e.target.value)} aria-describedby={`${id}-h`} />
      <span id={`${id}-h`} className="text-[13px] text-[#4A5A70]">
        {used ? "This suggestion comes from the student's scores. Read it and make it personal before saving." : (hint ?? "Up to 600 characters.")}
      </span>
    </div>
  );
}
