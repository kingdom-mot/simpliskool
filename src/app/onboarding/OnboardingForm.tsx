"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useState } from "react";
import { createSchool, type OnboardingState } from "./actions";

function toSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function Submit() {
  const { pending } = useFormStatus();
  return <button className="btn-primary w-full" disabled={pending}>{pending ? "Creating…" : "Create my school"}</button>;
}

export function OnboardingForm({ rootDomain }: { rootDomain: string }) {
  const [state, action] = useActionState<OnboardingState, FormData>(createSchool, {});
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);

  return (
    <form action={action} className="mt-5 space-y-4">
      <div>
        <label className="label" htmlFor="name">School name</label>
        <input
          id="name"
          name="name"
          required
          className="input"
          placeholder="Bright Future Academy"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!slugEdited) setSlug(toSlug(e.target.value));
          }}
        />
      </div>
      <div>
        <label className="label" htmlFor="slug">School web address</label>
        <div className="flex items-center rounded-lg border border-slate-300 focus-within:border-brand-teal">
          <input
            id="slug"
            name="slug"
            required
            className="w-full rounded-l-lg px-3 py-2.5 text-sm focus:outline-none"
            value={slug}
            onChange={(e) => {
              setSlugEdited(true);
              setSlug(toSlug(e.target.value));
            }}
          />
          <span className="whitespace-nowrap pr-3 text-sm text-slate-500">.{rootDomain}</span>
        </div>
      </div>
      <Submit />
      {state.error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
    </form>
  );
}
