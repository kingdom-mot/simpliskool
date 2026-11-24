import Image from "next/image";
import Link from "next/link";
import { HeaderBehaviour } from "@/components/HeaderBehaviour";
import { ENQUIRIES_EMAIL, PRICING_CHAT, WHATSAPP_DISPLAY, whatsapp } from "@/lib/contact";

const DEMO_MAIL = `mailto:${ENQUIRIES_EMAIL}?subject=Simpliskool%20demo%20request`;

type Item = { href: string; t: string; d: string; icon: string; tint: string };
type Menu = { label: string; eyebrow: string; title: string; text: string; cta: [string, string]; img?: string; cols: string; items: Item[] };

const BLUE = "bg-[#E8F0FB] text-brand-navy";
const TEAL = "bg-[#E2F5F1] text-[#07665A]";
const SUN = "bg-[#FFF1D6] text-[#8A5A00]";
const ROSE = "bg-[#FDE9E4] text-[#A2391F]";

const MENUS: Menu[] = [
  {
    label: "Product",
    eyebrow: "School workspace",
    title: "Everything your school runs on, connected.",
    text: "Explore Simpliskool by what it does, or by the people who use it every day.",
    cta: ["Try the live demo", "/demo"],
    img: "/landing/hero.jpg",
    cols: "lg:grid-cols-3",
    items: [
      { href: "/#features", t: "Features", d: "Attendance, results, fees, CBT exams and reports.", icon: "M12 3l1.9 5.8H20l-4.9 3.6 1.9 5.8L12 14.6l-5 3.6 1.9-5.8L4 8.8h6.1z", tint: BLUE },
      { href: "/#portals", t: "Portals", d: "See exactly what each person in your school gets.", icon: "M3 4h7v7H3zM14 4h7v7h-7zM3 15h7v6H3zM14 15h7v6h-7z", tint: TEAL },
      { href: "/demo", t: "Live demo", d: "Click around a made-up school. No sign-up.", icon: "M5 3l14 9-14 9z", tint: SUN },
      { href: "/#people", t: "For admins", d: "Fees, admissions, staff and results on one dashboard.", icon: "M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6", tint: BLUE },
      { href: "/#people", t: "For teachers", d: "Register, scores, lesson notes and homework, even offline.", icon: "M2 7l10-4 10 4-10 4zM6 9v5c0 2 3 4 6 4s6-2 6-4V9", tint: TEAL },
      { href: "/#people", t: "For parents", d: "Results, fees and notices for every child on one phone.", icon: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8", tint: ROSE },
      { href: "/#people", t: "For students", d: "Timetable, homework, tests and results.", icon: "M4 19.5V5a2 2 0 0 1 2-2h14v16H6.5A2.5 2.5 0 0 0 4 21.5", tint: SUN },
      { href: "/#features", t: "Multi-branch groups", d: "Every branch together, each running its own day.", icon: "M6 3v12M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 9a9 9 0 0 1-9 9", tint: BLUE },
      { href: "/privacy", t: "Data protection", d: "How we keep children's data safe, in line with the NDPA.", icon: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4", tint: TEAL },
    ],
  },
  {
    label: "Resources",
    eyebrow: "Learn and get support",
    title: "Helpful answers for every stage.",
    text: "Find out how setup works, get quick answers, or talk to our team.",
    cta: ["Book a free demo", DEMO_MAIL],
    cols: "lg:grid-cols-2",
    items: [
      { href: "/#how", t: "How it works", d: "From demo to go-live in one week.", icon: "M4 12h4l3-8 4 16 3-8h2", tint: BLUE },
      { href: "/#faq", t: "FAQ", d: "Questions schools ask us.", icon: "M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z", tint: TEAL },
      { href: PRICING_CHAT, t: "Pricing", d: "Ask us on WhatsApp for your school's price.", icon: "M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6", tint: SUN },
      { href: "/#pilot", t: "Join the pilot", d: "Free setup, training and use during the pilot.", icon: "M4 22V4M4 4h13l-2 4 2 4H4", tint: ROSE },
      { href: whatsapp("Hello Simpliskool, I have a question."), t: "Chat on WhatsApp", d: WHATSAPP_DISPLAY, icon: "M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l2.1-5.4A8.5 8.5 0 1 1 21 11.5z", tint: BLUE },
      { href: "/privacy", t: "Privacy and terms", d: "Privacy policy, terms of use and data processing.", icon: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6", tint: TEAL },
    ],
  },
];

function Icon({ d, tint, size = "h-11 w-11" }: { d: string; tint: string; size?: string }) {
  return (
    <span className={`flex flex-none items-center justify-center rounded-xl ${size} ${tint}`}>
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d={d} />
      </svg>
    </span>
  );
}

const Arrow = ({ className = "" }: { className?: string }) => (
  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

const go = (href: string, cls: string, children: React.ReactNode) =>
  href.startsWith("/") ? (
    <Link href={href} className={cls}>
      {children}
    </Link>
  ) : href.startsWith("http") ? (
    <a href={href} className={cls} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ) : (
    <a href={href} className={cls}>
      {children}
    </a>
  );

/** Marketing header: wide mega menus on computers (hover or keyboard), a fold-out menu on phones. No JavaScript needed. */
export function SiteHeader() {
  return (
    <header id="site-header" className="sticky top-0 z-40 border-b border-[#ECEFF4] bg-white">
      <HeaderBehaviour headerId="site-header" />
      <div className="mx-auto flex min-h-[72px] max-w-[1240px] items-stretch justify-between gap-6 px-4 sm:px-6">
        <Link href="/" aria-label="Simpliskool home" className="flex flex-none items-center">
          <Image src="/simpliskool-logo-dark.png" alt="Simpliskool" width={157} height={35} priority className="h-8 w-auto sm:h-9" />
        </Link>

        <nav aria-label="Main" className="hidden items-stretch gap-1 lg:flex">
          {MENUS.map((m) => (
            <div key={m.label} className="sk-menu group flex items-center">
              <button type="button" aria-haspopup="true" className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-4 text-[15px] font-semibold text-brand-slate hover:text-brand-teal-dark group-hover:text-brand-teal-dark group-focus-within:text-brand-teal-dark">
                {m.label}
                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" className="transition-transform group-hover:rotate-180 group-focus-within:rotate-180">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
              <div className="sk-mega absolute inset-x-0 top-full px-4 pt-3 sm:px-6">
                <div className="mx-auto grid max-w-[1180px] gap-6 rounded-[28px] border border-[#ECEFF4] bg-white p-5 shadow-[0_30px_70px_-30px_rgba(15,42,82,0.35)] lg:grid-cols-[300px_1fr]">
                  <div className="flex flex-col overflow-hidden rounded-[22px] bg-[#FFF7EA]">
                    <div className="flex flex-1 flex-col p-6">
                      <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-brand-teal-dark">{m.eyebrow}</p>
                      <p className="mt-3 font-heading text-[26px] font-extrabold leading-[1.15] text-brand-navy">{m.title}</p>
                      <p className="mt-3 text-[15px] leading-relaxed text-[#4A5A70]">{m.text}</p>
                      {go(
                        m.cta[1],
                        "mt-auto inline-flex min-h-[44px] items-center gap-2 self-start pt-5 text-[15px] font-bold text-brand-teal-dark hover:gap-3",
                        <>
                          {m.cta[0]} <Arrow />
                        </>,
                      )}
                    </div>
                    {m.img && <Image src={m.img} alt="" width={600} height={300} className="h-28 w-full object-cover" />}
                  </div>
                  <ul className={`grid content-start gap-1 ${m.cols}`}>
                    {m.items.map((i) => (
                      <li key={i.t}>
                        {go(
                          i.href,
                          "group/i flex h-full gap-4 rounded-2xl border border-transparent p-4 hover:border-[#ECEFF4] hover:bg-[#FAFBFD] focus-visible:border-[#ECEFF4] focus-visible:bg-[#FAFBFD]",
                          <>
                            <Icon d={i.icon} tint={i.tint} />
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center justify-between gap-2 text-[16px] font-bold text-brand-navy">
                                {i.t}
                                <Arrow className="flex-none text-[#9AA7B8] transition-transform group-hover/i:translate-x-0.5 group-hover/i:text-brand-teal-dark" />
                              </span>
                              <span className="mt-1 block text-[14px] leading-snug text-[#4A5A70]">{i.d}</span>
                            </span>
                          </>,
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
          <div className="flex items-center">
            <Link href="/about" className="inline-flex min-h-[44px] items-center rounded-full px-4 text-[15px] font-semibold text-brand-slate hover:text-brand-teal-dark">
              About us
            </Link>
          </div>
        </nav>

        <div className="flex items-center gap-2">
          <Link href="/login" className="hidden min-h-[44px] items-center rounded-full px-4 text-[15px] font-bold text-brand-navy hover:text-brand-teal-dark sm:inline-flex">
            Sign in
          </Link>
          <a href={DEMO_MAIL} className="hidden min-h-[46px] items-center rounded-full bg-brand-teal-dark px-6 text-[15px] font-bold text-white hover:bg-[#096A5D] sm:inline-flex">
            Book a demo
          </a>
          <details className="group lg:hidden">
            <summary aria-label="Menu" className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-full border border-[#DCE5F0] bg-white text-brand-navy [&::-webkit-details-marker]:hidden">
              <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className="group-open:hidden">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
              <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className="hidden group-open:block">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </summary>
            <div className="absolute inset-x-0 top-full max-h-[calc(100vh-72px)] overflow-y-auto border-b border-[#ECEFF4] bg-white px-4 pb-6 pt-2 shadow-[0_24px_40px_-20px_rgba(15,42,82,0.35)]">
              {MENUS.map((m) => (
                <div key={m.label} className="mt-3">
                  <p className="px-2 text-xs font-extrabold uppercase tracking-[0.12em] text-[#4A5A70]">{m.label}</p>
                  <ul className="mt-1 grid gap-0.5 sm:grid-cols-2">
                    {m.items.map((i) => (
                      <li key={i.t}>
                        {go(
                          i.href,
                          "flex items-center gap-3 rounded-xl p-2 hover:bg-brand-cloud",
                          <>
                            <Icon d={i.icon} tint={i.tint} size="h-10 w-10" />
                            <span className="text-[15px] font-bold text-brand-navy">{i.t}</span>
                          </>,
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <Link href="/about" className="mt-3 flex min-h-[48px] items-center rounded-xl px-2 text-[15px] font-bold text-brand-navy hover:bg-brand-cloud">
                About us
              </Link>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Link href="/login" className="inline-flex min-h-[48px] items-center justify-center rounded-full border-[1.5px] border-brand-navy font-bold text-brand-navy">
                  Sign in
                </Link>
                <a href={DEMO_MAIL} className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-brand-teal-dark font-bold text-white">
                  Book a demo
                </a>
              </div>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
