"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { releaseResults } from "@/lib/results-actions";

export function ReleaseButton({ classId, termId, className, count, released, emailReady }: { classId: string; termId: string; className: string; count: number; released: boolean; emailReady: boolean }) {
  const [open, setOpen] = useState(false);
  if (released) {
    return (
      <ActionForm action={releaseResults} className="flex flex-col items-start gap-2">
        <input type="hidden" name="class" value={classId} />
        <input type="hidden" name="term" value={termId} />
        <input type="hidden" name="release" value="1" />
        <div className="flex flex-wrap gap-2">
          <SubmitButton className="s-btn2" pending="Releasing…">
            Release again (adds new students and changes)
          </SubmitButton>
        </div>
      </ActionForm>
    );
  }
  if (!open) {
    return (
      <button type="button" className="s-btn" onClick={() => setOpen(true)}>
        Release to parents
      </button>
    );
  }
  return (
    <ActionForm action={releaseResults} className="flex flex-col gap-3 rounded-xl border-[1.5px] border-c1 bg-white p-4">
      <input type="hidden" name="class" value={classId} />
      <input type="hidden" name="term" value={termId} />
      <input type="hidden" name="release" value="1" />
      <h3 className="text-base !text-c1">
        Release {count} report card{count === 1 ? "" : "s"} for {className}?
      </h3>
      <p className="text-sm text-brand-slate">Parents and students can view and print them right away. Scores are locked once released; you can take the report cards back if something needs fixing.</p>
      <label className="flex min-h-[44px] items-center gap-2 text-sm font-semibold text-brand-slate">
        <input type="checkbox" name="email" value="1" defaultChecked={emailReady} disabled={!emailReady} className="h-5 w-5" />
        Email parents that the report card is ready
      </label>
      <div className="flex flex-wrap gap-2">
        <SubmitButton pending="Releasing…">Release now</SubmitButton>
        <button type="button" className="s-btn2" onClick={() => setOpen(false)}>
          Not yet
        </button>
      </div>
    </ActionForm>
  );
}
