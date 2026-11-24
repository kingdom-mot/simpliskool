import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SiteFooter } from "../SiteFooter";
import { SiteHeader } from "../SiteHeader";
import { WhatsAppFloat } from "@/components/WhatsAppFloat";
import { ENQUIRIES_EMAIL, whatsapp } from "@/lib/contact";

export const metadata: Metadata = {
  title: "About us · Simpliskool",
  description:
    "Simpliskool is built in Lagos by Dream Savvy Solutions to make running a school simple. Our mission, vision and values.",
};

const VALUES = [
  {
    t: "Simplicity",
    d: "Easy to use on any phone, from the first day.",
    icon: "M12 3l1.9 5.8H20l-4.9 3.6 1.9 5.8L12 14.6l-5 3.6 1.9-5.8L4 8.8h6.1z",
    tint: "bg-[#E2F5F1] text-[#07665A]",
  },
  {
    t: "Trust",
    d: "Children's data is protected and never sold.",
    icon: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4",
    tint: "bg-[#E8F0FB] text-brand-navy",
  },
  {
    t: "Built for Africa",
    d: "Works offline, on everyday phones, with local payments.",
    icon: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20",
    tint: "bg-[#FFF1D6] text-[#8A5A00]",
  },
  {
    t: "Partnership",
    d: "We set schools up, train staff and stay close.",
    icon: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8",
    tint: "bg-[#FDE9E4] text-[#A2391F]",
  },
  {
    t: "Excellence",
    d: "Results, fees and records that are right, every time.",
    icon: "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
    tint: "bg-[#E2F5F1] text-[#07665A]",
  },
];

function Glyph({ d, size = 22 }: { d: string; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  );
}

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white">
      <a href="#main" className="sk-skip">
        Skip to main content
      </a>
      <SiteHeader />

      <main id="main">
        {/* Intro */}
        <section className="bg-[#FFFCF6]">
          <div className="mx-auto grid max-w-[1140px] items-center gap-12 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <p className="text-[14px] font-bold uppercase tracking-[0.1em] text-[#07665A]">
                About us
              </p>
              <h1 className="mt-4 text-[38px] font-extrabold leading-[1.08] tracking-[-0.03em] md:text-[52px]">
                We make running a school simple.
              </h1>
              <p className="mt-5 max-w-[520px] text-[17px] leading-relaxed text-[#4A5A70]">
                Simpliskool is built in Lagos by Dream Savvy Solutions. One
                place for admissions, attendance, results, fees and parent
                updates, so school leaders spend less time on paperwork and more
                time on their pupils.
              </p>
            </div>
            <div className="relative">
              <Image
                src="/landing/teacher.jpg"
                alt="A teacher using a tablet in a bright classroom while pupils work behind her"
                width={500}
                height={503}
                priority
                className="aspect-[4/3.4] w-full rounded-[28px] object-cover"
              />
              <div className="absolute -bottom-5 left-5 rounded-2xl bg-white px-5 py-3.5 shadow-[0_18px_40px_-16px_rgba(15,42,82,0.35)]">
                <span className="block font-heading text-[22px] font-extrabold leading-none text-brand-navy">
                  Made in Lagos
                </span>
                <span className="mt-1 block text-[13px] text-[#4A5A70]">
                  for schools across Africa
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Mission and vision */}
        <section aria-label="Mission and vision" className="bg-white py-20">
          <div className="mx-auto grid max-w-[1140px] gap-5 px-4 sm:px-6 md:grid-cols-2">
            <article
              aria-labelledby="mission-h"
              className="rounded-[26px] bg-[#E2F5F1] p-8 md:p-10"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#07665A] text-white">
                <Glyph d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
              </span>
              <h2 id="mission-h" className="mt-6 text-[26px] font-extrabold">
                Our mission
              </h2>
              <p className="mt-3 text-[17px] leading-relaxed text-brand-slate">
                To give every school simple, affordable tools that cut
                paperwork, so teachers can teach and parents stay close to their
                child&apos;s learning.
              </p>
            </article>
            <article
              aria-labelledby="vision-h"
              className="rounded-[26px] bg-[#FFF1D6] p-8 md:p-10"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#8A5A00] text-white">
                <Glyph d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
              </span>
              <h2 id="vision-h" className="mt-6 text-[26px] font-extrabold">
                Our vision
              </h2>
              <p className="mt-3 text-[17px] leading-relaxed text-brand-slate">
                A future where every African school, from a small nursery to a
                group of campuses, runs on clear, connected and trusted
                information.
              </p>
            </article>
          </div>
        </section>

        {/* Values */}
        <section aria-labelledby="values-h" className="bg-[#FAFBFD] py-20">
          <div className="mx-auto max-w-[1140px] px-4 sm:px-6">
            <div className="mb-10 text-center">
              <p className="text-[14px] font-bold uppercase tracking-[0.1em] text-[#07665A]">
                What we stand for
              </p>
              <h2
                id="values-h"
                className="mt-3 text-[30px] font-extrabold tracking-[-0.02em] md:text-[38px]"
              >
                Our core values
              </h2>
            </div>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {VALUES.map((v) => (
                <li
                  key={v.t}
                  className="rounded-[22px] border border-[#ECEFF4] bg-white p-6"
                >
                  <span
                    className={`flex h-11 w-11 items-center justify-center rounded-xl ${v.tint}`}
                  >
                    <Glyph d={v.icon} size={20} />
                  </span>
                  <h3 className="mt-4 text-[18px]">{v.t}</h3>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-[#4A5A70]">
                    {v.d}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Call to action */}
        <section aria-labelledby="cta-h" className="bg-white py-20">
          <div className="mx-auto max-w-[1140px] px-4 sm:px-6">
            <div className="flex flex-col items-center gap-5 rounded-[28px] bg-[#07665A] px-6 py-12 text-center md:py-14">
              <h2
                id="cta-h"
                className="text-[28px] font-extrabold !text-white md:text-[34px]"
              >
                See Simpliskool in your school
              </h2>
              <p className="max-w-[520px] text-[16px] leading-relaxed text-[#E2F5F1]">
                Book a free demo, or try the live demo now. No sign-up needed.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <a
                  href={`mailto:${ENQUIRIES_EMAIL}?subject=Simpliskool%20demo%20request`}
                  className="inline-flex min-h-[50px] items-center rounded-full bg-[#FFD979] px-6 text-[15px] font-extrabold text-[#3A2A00] hover:bg-[#FFCE57]"
                >
                  Book a free demo
                </a>
                <Link
                  href="/demo"
                  className="inline-flex min-h-[50px] items-center rounded-full border-[1.5px] border-white/70 px-6 text-[15px] font-bold text-white hover:bg-white/10"
                >
                  Try the live demo
                </Link>
                <a
                  href={whatsapp(
                    "Hello Simpliskool, I'd like to find out more.",
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[50px] items-center rounded-full border-[1.5px] border-white/70 px-6 text-[15px] font-bold text-white hover:bg-white/10"
                >
                  Chat on WhatsApp
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
      <WhatsAppFloat />
    </div>
  );
}
