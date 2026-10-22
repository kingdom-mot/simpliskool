"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } });
    setBusy(false);
    if (error) return setError(error.message);
    setStep("code");
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
    setBusy(false);
    if (error) return setError("That code is wrong or has expired. Request a new one.");
    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-mist px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <Image src="/simpliskool-logo-dark.png" alt="Simpliskool" width={220} height={49} priority />
        </div>
        <div className="card shadow-sm">
          <h1 className="text-xl font-semibold text-brand-navy">Sign in</h1>
          <p className="mt-1 text-sm text-slate-600">
            {step === "email" ? "We'll email you a 6-digit code. No password needed." : `Enter the code we sent to ${email}.`}
          </p>

          {step === "email" ? (
            <form onSubmit={sendCode} className="mt-5 space-y-4">
              <div>
                <label className="label" htmlFor="email">Email address</label>
                <input id="email" type="email" required autoComplete="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <button className="btn-primary w-full" disabled={busy}>{busy ? "Sending…" : "Send code"}</button>
            </form>
          ) : (
            <form onSubmit={verifyCode} className="mt-5 space-y-4">
              <div>
                <label className="label" htmlFor="code">6-digit code</label>
                <input id="code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required autoComplete="one-time-code" className="input tracking-[0.4em]" value={code} onChange={(e) => setCode(e.target.value)} />
              </div>
              <button className="btn-primary w-full" disabled={busy}>{busy ? "Checking…" : "Sign in"}</button>
              <button type="button" className="w-full text-sm text-brand-teal hover:underline" onClick={() => setStep("email")}>
                Use a different email
              </button>
            </form>
          )}

          {error && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        </div>
        <p className="mt-6 text-center text-xs text-slate-500">Simpliskool · Simplifying school management</p>
      </div>
    </main>
  );
}
