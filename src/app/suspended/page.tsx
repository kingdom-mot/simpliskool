import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/SignOutButton";
import { requireUser, ROLE_LABEL } from "@/lib/auth";

export const metadata = { title: "School paused — Simpliskool" };

export default async function SuspendedPage() {
  const { suspended } = await requireUser();
  if (!suspended.length) redirect("/dashboard");
  const isParent = suspended.some((m) => m.role === "parent");
  return (
    <main id="main" className="flex min-h-screen items-center justify-center bg-brand-mist px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Image src="/simpliskool-logo-dark.png" alt="Simpliskool" width={200} height={45} />
        </div>
        <div className="card flex flex-col gap-3">
          <h1 className="text-xl font-semibold text-brand-navy">This school&apos;s portal is paused</h1>
          <ul className="flex flex-col gap-1 text-sm text-slate-700">
            {suspended.map((m) => (
              <li key={`${m.school_id}-${m.role}`}>
                <strong>{m.schools?.name}</strong> · {ROLE_LABEL[m.role]}
              </li>
            ))}
          </ul>
          <p className="text-sm text-slate-700">Nothing has been deleted. The school can contact Simpliskool on support@simpliskool.com to switch it back on.</p>
          {isParent && (
            <p className="text-sm text-slate-700">
              Parents can still see and pay outstanding fees.{" "}
              <Link href="/parent/fees" className="font-bold text-brand-teal underline">
                Go to fees
              </Link>
            </p>
          )}
          <SignOutButton className="s-btn2 self-start" />
        </div>
      </div>
    </main>
  );
}
