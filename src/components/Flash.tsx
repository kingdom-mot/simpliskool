import { readFlash } from "@/lib/flash";

export async function Flash() {
  const m = await readFlash();
  if (!m) return null;
  return (
    <p role="status" className="rounded-xl bg-[#E7F6F2] px-4 py-3 text-sm font-semibold text-[#0B6B5A]">
      {m}
    </p>
  );
}
