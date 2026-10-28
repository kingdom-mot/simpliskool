"use client";

import { useEffect, useRef, useState } from "react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { handIn } from "@/lib/homework-actions";
import type { HwFile } from "@/lib/teaching";

const MAX_TOTAL = 3.9 * 1024 * 1024;

/** Shrinks a phone photo to at most 1600px wide/high as a JPEG (usually 200–500 KB). */
async function shrink(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.82));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

const kb = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export function HandIn({ hw, student, back, modes, existing, answer, note }: { hw: string; student: string; back: string; modes: string[]; existing: HwFile[]; answer: string; note: string }) {
  const [files, setFiles] = useState<File[]>([]);
  const [keep, setKeep] = useState<string[]>(existing.map((f) => f.path));
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const hidden = useRef<HTMLInputElement>(null);
  const total = files.reduce((a, f) => a + f.size, 0);

  // Keep the real (hidden) file field in step with the list on screen.
  useEffect(() => {
    if (!hidden.current) return;
    const dt = new DataTransfer();
    files.forEach((f) => dt.items.add(f));
    hidden.current.files = dt.files;
  }, [files]);

  const add = async (list: FileList | null) => {
    if (!list?.length) return;
    setBusy(true);
    setProblem(null);
    const shrunk = await Promise.all([...list].map(shrink));
    setBusy(false);
    const next = [...files, ...shrunk].slice(0, 5 - keep.length);
    if (next.reduce((a, f) => a + f.size, 0) > MAX_TOTAL) setProblem("That's more than 4 MB in all. Remove a file, or use a smaller one.");
    else setFiles(next);
  };
  const photo = modes.includes("photo");
  const file = modes.includes("file");
  const text = modes.includes("text");

  return (
    <ActionForm action={handIn} className="flex flex-col gap-4">
      <input type="hidden" name="hw" value={hw} />
      <input type="hidden" name="student" value={student} />
      <input type="hidden" name="back" value={back} />
      <input ref={hidden} type="file" name="work" multiple hidden aria-hidden="true" tabIndex={-1} />
      {(photo || file) && (
        <div className="flex flex-col gap-2">
          <span className="label">Your work</span>
          <div className="flex flex-wrap gap-2">
            {photo && (
              <label className="s-btn2 cursor-pointer has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-c2">
                <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => add(e.target.files).then(() => (e.target.value = ""))} />
                Take a photo
              </label>
            )}
            {(photo || file) && (
              <label className="s-btn2 cursor-pointer has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-c2">
                <input type="file" multiple accept={file ? "image/*,.pdf,.docx,.xlsx,.pptx" : "image/*"} className="sr-only" onChange={(e) => add(e.target.files).then(() => (e.target.value = ""))} />
                {file ? "Upload a file" : "Choose photos"}
              </label>
            )}
          </div>
          {busy && <p className="text-sm text-[#4A5A70]">Getting your photo ready…</p>}
          {problem && (
            <p role="alert" className="text-sm font-semibold text-[#912018]">
              {problem}
            </p>
          )}
          <ul className="flex flex-col gap-1.5" aria-label="Files to hand in">
            {existing
              .filter((f) => keep.includes(f.path))
              .map((f) => (
                <li key={f.path} className="flex min-h-[44px] items-center justify-between gap-2 rounded-xl bg-brand-cloud px-3 text-sm">
                  <input type="hidden" name="keep" value={f.path} />
                  <span className="truncate">{f.name}</span>
                  <button type="button" className="min-h-[44px] min-w-[44px] font-bold text-[#912018]" onClick={() => setKeep(keep.filter((k) => k !== f.path))} aria-label={`Remove ${f.name}`}>
                    ×
                  </button>
                </li>
              ))}
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex min-h-[44px] items-center justify-between gap-2 rounded-xl bg-brand-cloud px-3 text-sm">
                <span className="truncate">
                  {f.name} <span className="text-[#4A5A70]">({kb(f.size)})</span>
                </span>
                <button type="button" className="min-h-[44px] min-w-[44px] font-bold text-[#912018]" onClick={() => setFiles(files.filter((_, k) => k !== i))} aria-label={`Remove ${f.name}`}>
                  ×
                </button>
              </li>
            ))}
          </ul>
          {total > 0 && <span className="text-[13px] text-[#4A5A70]">{kb(total)} of 4 MB</span>}
        </div>
      )}
      {text && (
        <div>
          <label className="label" htmlFor={`ans-${hw}`}>
            {photo || file ? "Or type your answer" : "Your answer"}
          </label>
          <textarea id={`ans-${hw}`} name="answer" rows={6} maxLength={8000} defaultValue={answer} className="sk-input min-h-[140px] py-3" />
        </div>
      )}
      <div>
        <label className="label" htmlFor={`note-${hw}`}>
          Note to your teacher <span className="font-normal text-[#4A5A70]">(optional)</span>
        </label>
        <input id={`note-${hw}`} name="note" maxLength={500} defaultValue={note} className="sk-input" />
      </div>
      <div>
        <SubmitButton pending="Handing in…" className="s-btn w-full sm:w-auto">
          Hand in
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
