import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = { title: "Can't sign in? — Simpliskool" };

const ITEMS: { q: string; steps: string[]; cta: { label: string; href: string } }[] = [
  {
    q: "I didn't get my code",
    steps: [
      "Wait up to 60 seconds. SMS can be slow on some networks.",
      "If you used email, check your spam or promotions folder.",
      "Make sure the number or email is typed correctly.",
      "Try the other option: email instead of phone, or phone instead of email.",
    ],
    cta: { label: "Try again", href: "/login" },
  },
  {
    q: "I forgot my student PIN",
    steps: [
      "Ask your class teacher or the school office to reset your PIN.",
      "They will give you a new login slip with your admission number and new PIN.",
      "Your old PIN stops working as soon as a new one is made.",
    ],
    cta: { label: "Back to sign in", href: "/login?as=student" },
  },
  {
    q: "I forgot which email or phone I used",
    steps: [
      "Use the email or phone number you gave the school when you registered.",
      "Parents: it is usually the contact on your child's admission form.",
      "Your school office can tell you which one is on record.",
    ],
    cta: { label: "Back to sign in", href: "/login" },
  },
  {
    q: "I changed my phone number or email",
    steps: [
      "If you still have the other one, sign in with it and update your details in My profile.",
      "If you have neither, ask your school office to update your details.",
      "School owners can contact Simpliskool support to verify and update their account.",
    ],
    cta: { label: "Contact support", href: "mailto:enquiries@simpliskool.com?subject=Help%20signing%20in" },
  },
  {
    q: "It says I have tried too many times",
    steps: [
      "For your safety, sign-in pauses for 15 minutes after 5 wrong codes or PINs.",
      "After 15 minutes, request a new code and use only the latest one.",
      "Students can ask their class teacher to reset their PIN straight away.",
    ],
    cta: { label: "Back to sign in", href: "/login" },
  },
];

export default function HelpPage() {
  return (
    <div className="sk-dots flex min-h-screen flex-col bg-brand-cloud">
      <a href="#main" className="sk-skip">Skip to main content</a>
      <header className="px-6 py-6 sm:px-8">
        <Link href="/" aria-label="Simpliskool home" className="inline-block">
          <Image src="/simpliskool-logo-dark.png" alt="Simpliskool" width={143} height={32} className="h-8 w-auto" />
        </Link>
      </header>
      <main id="main" className="flex flex-1 justify-center px-4 pb-12 pt-2">
        <div className="w-full max-w-[560px]">
          <Link href="/login" className="inline-flex min-h-[44px] items-center gap-2 font-bold text-brand-teal-dark hover:underline">
            <span aria-hidden="true">←</span> Back to sign in
          </Link>
          <h1 className="mt-2 text-[32px] leading-tight">Can&apos;t sign in?</h1>
          <p className="mt-2 text-base text-[#4A5A70]">
            Simpliskool doesn&apos;t use passwords. You sign in with a code we send to your email or phone, or with your admission number and PIN if you&apos;re a student. Pick what&apos;s happening:
          </p>
          <div className="mt-6 space-y-3">
            {ITEMS.map((item, i) => (
              <details key={item.q} className="group rounded-2xl border border-[#E3EAF3] bg-white" open={i === 0}>
                <summary className="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-base font-bold text-brand-navy [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <span aria-hidden="true" className="text-xl text-brand-teal-dark group-open:hidden">+</span>
                  <span aria-hidden="true" className="hidden text-xl text-brand-teal-dark group-open:inline">−</span>
                </summary>
                <div className="px-5 pb-5">
                  <ol className="list-decimal space-y-2 pl-5 text-[15px] leading-relaxed">
                    {item.steps.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ol>
                  <Link href={item.cta.href} className="sk-btn-outline mt-4">{item.cta.label}</Link>
                </div>
              </details>
            ))}
          </div>
          <p className="mt-8 text-center text-[15px] text-[#4A5A70]">
            Still stuck? Email <a href="mailto:enquiries@simpliskool.com" className="font-bold text-brand-teal-dark hover:underline">enquiries@simpliskool.com</a>
          </p>
        </div>
      </main>
    </div>
  );
}
