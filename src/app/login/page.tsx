"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { signInWithPin, type PinState } from "./actions";

type Method = "email" | "phone" | "pin";

const METHODS: { id: Method; label: string }[] = [
  { id: "email", label: "Email" },
  { id: "phone", label: "Phone" },
  { id: "pin", label: "Student PIN" },
];

const COUNTRIES = [
  { code: "+234", label: "NG +234" },
  { code: "+233", label: "GH +233" },
  { code: "+254", label: "KE +254" },
  { code: "+44", label: "GB +44" },
];

/** 0803 123 4567 → +2348031234567 */
function toE164(country: string, raw: string): string | null {
  let digits = raw.replace(/\D/g, "");
  if (raw.trim().startsWith("+")) return digits.length >= 10 ? `+${digits}` : null;
  if (digits.startsWith(country.slice(1))) digits = digits.slice(country.length - 1);
  if (digits.startsWith("0")) digits = digits.slice(1);
  return digits.length >= 7 && digits.length <= 12 ? `${country}${digits}` : null;
}

function friendlyError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("rate") || m.includes("security purposes") || m.includes("too many")) return "Please wait a minute before asking for another code.";
  if (m.includes("sms") || m.includes("phone provider") || m.includes("unsupported phone")) return "We can't send text messages yet. Please use your email address for now.";
  if (m.includes("invalid") && m.includes("email")) return "Enter a full email address, like name@example.com.";
  if (m.includes("signups not allowed")) return "We couldn't find an account for that. Check with your school office.";
  return "Something went wrong. Please try again.";
}

export default function LoginPage() {
  return (
    <Suspense>
      <SignIn />
    </Suspense>
  );
}

function SignIn() {
  const router = useRouter();
  const params = useSearchParams();
  const isNew = params.get("new") === "1";
  const supabase = createClient();
  const NOT_READY = "Sign-in isn't available on this version of the site yet. Please try again later or contact enquiries@simpliskool.com.";

  const [method, setMethod] = useState<Method>(params.get("as") === "student" ? "pin" : "email");
  const [step, setStep] = useState<"start" | "code">("start");
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState("+234");
  const [phone, setPhone] = useState("");
  const [target, setTarget] = useState<{ kind: "email" | "phone"; value: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [wrongTries, setWrongTries] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string | null>(
    params.get("error") === "link"
      ? "That sign-in link has expired or was opened in a different browser. Request a new code."
      : params.get("error") === "setup"
        ? "Sign-in isn't available on this version of the site yet. Please try again later or contact enquiries@simpliskool.com."
        : null,
  );
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  useEffect(() => {
    if (step === "code") codeRef.current?.focus();
  }, [step]);

  function pickMethod(m: Method) {
    setMethod(m);
    setError(null);
  }

  function onTabKey(e: React.KeyboardEvent, i: number) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = (i + (e.key === "ArrowRight" ? 1 : METHODS.length - 1)) % METHODS.length;
    pickMethod(METHODS[next].id);
    tabRefs.current[next]?.focus();
  }

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    let t = target;
    if (step === "start") {
      if (method === "email") {
        const v = email.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return setError("Enter a full email address, like name@example.com.");
        t = { kind: "email", value: v };
      } else {
        const v = toE164(country, phone);
        if (!v) return setError("Enter your phone number, like 0803 123 4567.");
        t = { kind: "phone", value: v };
      }
    }
    if (!t) return;
    if (!supabase) return setError(NOT_READY);
    setBusy(true);
    const { error } =
      t.kind === "email"
        ? await supabase.auth.signInWithOtp({ email: t.value, options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/auth/callback` } })
        : await supabase.auth.signInWithOtp({ phone: t.value, options: { shouldCreateUser: true } });
    setBusy(false);
    if (error) return setError(friendlyError(error.message));
    setTarget(t);
    setStep("code");
    setCode("");
    setWrongTries(0);
    setCooldown(60);
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (!target) return;
    if (!supabase) return setError(NOT_READY);
    if (wrongTries >= 5) return setError("Too many tries. For your safety, please wait 15 minutes before trying again.");
    setBusy(true);
    setError(null);
    const { error } =
      target.kind === "email"
        ? await supabase.auth.verifyOtp({ email: target.value, token: code.trim(), type: "email" })
        : await supabase.auth.verifyOtp({ phone: target.value, token: code.trim(), type: "sms" });
    setBusy(false);
    if (error) {
      const tries = wrongTries + 1;
      setWrongTries(tries);
      if (error.message.toLowerCase().includes("expired")) return setError("This code has expired. Tap Resend code to get a new one.");
      return setError(tries >= 5 ? "Too many tries. For your safety, please wait 15 minutes before trying again." : `That code isn't right. Check the latest message and try again. You have ${5 - tries} ${5 - tries === 1 ? "try" : "tries"} left.`);
    }
    router.replace("/dashboard");
    router.refresh();
  }

  const shownTarget = target?.kind === "phone" ? target.value.replace(/^(\+\d{3})(\d{3})(\d{3})(\d+)$/, "$1 $2 $3 $4") : target?.value;

  return (
    <div className="sk-dots flex min-h-screen flex-col bg-brand-cloud">
      <header className="px-6 py-6 sm:px-8">
        <Link href="/" aria-label="Simpliskool home" className="inline-block">
          <Image src="/simpliskool-logo-dark.png" alt="Simpliskool" width={143} height={32} priority className="h-8 w-auto" />
        </Link>
      </header>

      <main id="main" className="flex flex-1 items-center justify-center px-4 pb-10 pt-2">
        <div className="w-full max-w-[440px] rounded-3xl border border-[#E3EAF3] bg-white px-6 py-9 shadow-[0_24px_48px_-24px_rgba(15,42,82,0.25)] sm:px-8">
          {step === "start" ? (
            <>
              <h1 className="text-[28px] leading-tight">{isNew ? "Create your school account" : "Sign in to Simpliskool"}</h1>
              <p className="mt-2 text-base text-[#4A5A70]">
                {method === "pin"
                  ? "Students without a phone or email: sign in with your admission number and PIN."
                  : isNew
                    ? "Start with your email or phone number. We'll send you a 6-digit code, then you'll set up your school."
                    : "Use the email or phone number your school has for you. We'll send you a 6-digit code."}
              </p>

              {!isNew && (
                <div role="tablist" aria-label="Sign in with" className="mt-6 grid grid-cols-3 gap-1 rounded-2xl bg-[#EEF3F9] p-1">
                  {METHODS.map((m, i) => (
                    <button
                      key={m.id}
                      ref={(el) => {
                        tabRefs.current[i] = el;
                      }}
                      type="button"
                      role="tab"
                      id={`tab-${m.id}`}
                      aria-selected={method === m.id}
                      aria-controls="signin-panel"
                      tabIndex={method === m.id ? 0 : -1}
                      onClick={() => pickMethod(m.id)}
                      onKeyDown={(e) => onTabKey(e, i)}
                      className={`min-h-[44px] rounded-xl px-2 text-[15px] ${method === m.id ? "bg-white font-bold text-brand-navy shadow-[0_1px_3px_rgba(15,42,82,0.15)]" : "font-semibold text-brand-slate hover:bg-white/60"}`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              )}

              <div id="signin-panel" role="tabpanel" aria-labelledby={`tab-${method}`} className="mt-6">
                {method === "pin" && !isNew ? (
                  <PinForm />
                ) : (
                  <form onSubmit={sendCode} noValidate className="space-y-5">
                    {method === "email" || isNew ? (
                      <Field id="email" label="Email address" error={error}>
                        <input
                          id="email"
                          type="email"
                          autoComplete="email"
                          placeholder="name@example.com"
                          className="sk-input"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          aria-invalid={!!error}
                          aria-describedby={error ? "form-error" : undefined}
                        />
                      </Field>
                    ) : (
                      <Field id="phone" label="Phone number" error={error}>
                        <div className="flex gap-2">
                          <label htmlFor="cc" className="sr-only">Country code</label>
                          <select id="cc" autoComplete="tel-country-code" className="sk-input sk-select w-auto flex-none" value={country} onChange={(e) => setCountry(e.target.value)}>
                            {COUNTRIES.map((c) => (
                              <option key={c.code} value={c.code}>{c.label}</option>
                            ))}
                          </select>
                          <input
                            id="phone"
                            type="tel"
                            inputMode="tel"
                            autoComplete="tel-national"
                            placeholder="803 123 4567"
                            className="sk-input min-w-0 flex-1"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            aria-invalid={!!error}
                            aria-describedby={error ? "form-error phone-hint" : "phone-hint"}
                          />
                        </div>
                        <p id="phone-hint" className="mt-2 text-sm text-[#4A5A70]">We&apos;ll text the code by SMS.</p>
                      </Field>
                    )}
                    {isNew && (
                      <p className="text-sm text-[#4A5A70]">
                        Prefer your phone?{" "}
                        <button type="button" className="font-bold text-brand-teal-dark underline" onClick={() => { router.replace("/login"); pickMethod("phone"); }}>
                          Use your phone number
                        </button>
                      </p>
                    )}
                    <button className="sk-btn w-full" disabled={busy}>{busy ? "Sending…" : "Send my code"}</button>
                  </form>
                )}
              </div>
            </>
          ) : (
            <>
              <h1 className="text-[28px] leading-tight">Enter your code</h1>
              <p className="mt-2 text-base text-[#4A5A70]">
                We sent a code to <strong className="text-brand-navy">{shownTarget}</strong>.
                {target?.kind === "email" && " You can also tap the link in the email on this device."}
              </p>
              <form onSubmit={verifyCode} noValidate className="mt-6 space-y-5">
                <Field id="code" label="Sign-in code" error={error}>
                  <input
                    ref={codeRef}
                    id="code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={10}
                    className="sk-input text-center text-2xl font-bold tracking-[0.4em]"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    aria-invalid={!!error}
                    aria-describedby={error ? "form-error" : undefined}
                  />
                </Field>
                <button className="sk-btn w-full" disabled={busy || code.length < 6}>{busy ? "Checking…" : "Sign in"}</button>
              </form>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-[15px]">
                {cooldown > 0 ? (
                  <span className="text-[#4A5A70]" aria-live="polite">Resend code in {cooldown}s</span>
                ) : (
                  <button type="button" className="min-h-[44px] font-bold text-brand-teal-dark underline" onClick={() => sendCode()} disabled={busy}>
                    Resend code
                  </button>
                )}
                <button type="button" className="min-h-[44px] font-bold text-brand-teal-dark underline" onClick={() => { setStep("start"); setError(null); }}>
                  {target?.kind === "phone" ? "Change number" : "Change email"}
                </button>
              </div>
            </>
          )}

          <div className="mt-6 flex flex-col items-center gap-3 border-t border-[#EEF3F9] pt-5 text-[15px]">
            <Link href="/help" className="p-1.5 font-bold text-brand-teal-dark underline-offset-2 hover:underline">Can&apos;t sign in?</Link>
            {isNew ? (
              <p className="text-[#4A5A70]">Already have an account? <Link href="/login" className="font-bold text-brand-teal-dark hover:underline">Sign in</Link></p>
            ) : (
              <p className="text-[#4A5A70]">New to Simpliskool? <Link href="/login?new=1" className="font-bold text-brand-teal-dark hover:underline">Create a school account</Link></p>
            )}
          </div>
        </div>
      </main>

      <footer className="flex flex-wrap justify-center gap-x-5 gap-y-2 px-4 pb-7 pt-5 text-sm text-[#4A5A70]">
        <Link href="/help" className="text-brand-slate hover:underline">Help</Link>
        <a href="mailto:enquiries@simpliskool.com" className="text-brand-slate hover:underline">Contact us</a>
        <span>© {new Date().getFullYear()} Dream Savvy Solutions</span>
      </footer>
    </div>
  );
}

function Field({ id, label, error, children }: { id: string; label: string; error: string | null; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-[15px] font-bold text-brand-navy">{label}</label>
      {children}
      {error && <ErrorText message={error} />}
    </div>
  );
}

function ErrorText({ message }: { message: string }) {
  return (
    <p id="form-error" role="alert" className="mt-2 flex items-start gap-2 text-sm font-semibold text-[#B42318]">
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="mt-px flex-none">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4M12 16h.01" />
      </svg>
      {message}
    </p>
  );
}

function PinForm() {
  const params = useSearchParams();
  const [state, action] = useFormState<PinState, FormData>(signInWithPin, { error: null });
  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="school" className="mb-2 block text-[15px] font-bold text-brand-navy">School code</label>
        <input id="school" name="school" defaultValue={params.get("school") ?? ""} required autoCapitalize="none" autoComplete="organization" spellCheck={false} placeholder="e.g. brightstars" className="sk-input" aria-describedby="school-hint" />
        <p id="school-hint" className="mt-2 text-sm text-[#4A5A70]">It&apos;s on your login slip, and in your school&apos;s web address.</p>
      </div>
      <div>
        <label htmlFor="admission" className="mb-2 block text-[15px] font-bold text-brand-navy">Admission number</label>
        <input id="admission" name="admission" required autoComplete="username" autoCapitalize="characters" spellCheck={false} placeholder="e.g. BSC/2024/118" className="sk-input" />
      </div>
      <div>
        <label htmlFor="pin" className="mb-2 block text-[15px] font-bold text-brand-navy">PIN</label>
        <input id="pin" name="pin" type="password" required inputMode="numeric" pattern="[0-9]{4,6}" maxLength={6} autoComplete="current-password" placeholder="4 to 6 digits" className="sk-input text-xl tracking-[0.3em] placeholder:text-base placeholder:tracking-normal" aria-describedby={state.error ? "form-error pin-hint" : "pin-hint"} aria-invalid={!!state.error} />
        <p id="pin-hint" className="mt-2 text-sm text-[#4A5A70]">Forgot your PIN? Ask your class teacher or the school office to reset it.</p>
      </div>
      {state.error && <ErrorText message={state.error} />}
      <PinSubmit />
    </form>
  );
}

function PinSubmit() {
  const { pending } = useFormStatus();
  return <button className="sk-btn w-full" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>;
}
