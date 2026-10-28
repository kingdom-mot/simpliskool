import { readFlash } from "@/lib/flash";

export async function Flash() {
  const f = await readFlash();
  if (!f) return null;
  return (
    <p role={f.warn ? "alert" : "status"} className={`rounded-xl px-4 py-3 text-sm font-semibold ${f.warn ? "bg-[#FFF6E3] text-[#5C4310]" : "bg-[#E7F6F2] text-[#0B6B5A]"}`}>
      {f.message}
    </p>
  );
}
