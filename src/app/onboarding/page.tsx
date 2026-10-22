import Image from "next/image";
import { requireUser } from "@/lib/auth";
import { OnboardingForm } from "./OnboardingForm";

export default async function OnboardingPage() {
  await requireUser();
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "simpliskool.com";

  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-mist px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Image src="/simpliskool-logo-dark.png" alt="Simpliskool" width={200} height={45} />
        </div>
        <div className="card">
          <h1 className="text-xl font-semibold text-brand-navy">Set up your school</h1>
          <p className="mt-1 text-sm text-slate-600">You&apos;ll be the owner. You can invite staff and parents next.</p>
          <OnboardingForm rootDomain={rootDomain} />
        </div>
      </div>
    </main>
  );
}
