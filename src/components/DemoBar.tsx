import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { isDemoEmail } from "@/lib/demo";

/** Shown on every page while someone is exploring the demo. */
export async function DemoBar() {
  const user = await currentUser().catch(() => null);
  if (!isDemoEmail(user?.email)) return null;
  return (
    <div role="region" aria-label="Simpliskool demo" className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-[14px] bg-[#FFF6E3] px-4 py-2.5 text-sm text-[#5C3E00]">
      <span className="flex-1">
        <strong>Simpliskool demo.</strong> Made-up data that resets every night. Emails, texts and payments are switched off.
      </span>
      <Link href="/demo" className="font-extrabold underline">
        Switch role
      </Link>
    </div>
  );
}
