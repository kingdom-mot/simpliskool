"use client";

import { useActionState, useState } from "react";
import { ActionForm, FormMessage, SubmitButton } from "@/components/forms";
import { removeLogo, uploadLogo } from "./actions";

export function LogoForm({ logoUrl, initials }: { logoUrl: string | null; initials: string }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [removed, remove] = useActionState(removeLogo, {});
  const shown = preview ?? logoUrl;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-4">
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt="Current school logo" className="h-20 w-20 rounded-2xl border border-[#E3EAF3] bg-white object-contain p-1" />
        ) : (
          <span aria-hidden="true" className="flex h-20 w-20 items-center justify-center rounded-2xl bg-c1 text-2xl font-extrabold text-white">
            {initials}
          </span>
        )}
        <p className="max-w-sm text-sm text-[#4A5A70]">
          A square PNG, JPG or WebP, up to 1 MB. It shows on your website, the portals, PIN slips and report cards. Without a logo, your school&apos;s initials show instead.
        </p>
      </div>

      <ActionForm action={uploadLogo} className="flex flex-col gap-3">
        <div>
          <label className="label" htmlFor="logo">
            Choose a new logo
          </label>
          <input
            id="logo"
            name="logo"
            type="file"
            required
            accept="image/png,image/jpeg,image/webp"
            className="block w-full text-sm file:mr-3 file:min-h-[44px] file:cursor-pointer file:rounded-xl file:border-[1.5px] file:border-c1 file:bg-white file:px-4 file:font-bold file:text-c1"
            onChange={(e) => {
              const f = e.target.files?.[0];
              setProblem(null);
              setPreview(null);
              if (!f) return;
              if (f.size > 1024 * 1024) return setProblem("That file is bigger than 1 MB. Save a smaller version and try again.");
              setPreview(URL.createObjectURL(f));
            }}
          />
        </div>
        {problem && (
          <p role="alert" className="rounded-xl bg-[#FEF3F2] px-4 py-3 text-sm font-semibold text-[#912018]">
            {problem}
          </p>
        )}
        <div>
          <SubmitButton pending="Uploading…">Upload logo</SubmitButton>
        </div>
      </ActionForm>

      {logoUrl && (
        <form action={remove}>
          <SubmitButton className="s-btn-danger" pending="Removing…">
            Remove logo
          </SubmitButton>
        </form>
      )}
      {/* Outside the form: the button goes once the logo is removed, the message stays. */}
      <FormMessage state={removed} />
    </div>
  );
}
