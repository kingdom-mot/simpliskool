import Image from "next/image";
import Link from "next/link";

const DEMO_MAIL = "mailto:enquiries@simpliskool.com?subject=Simpliskool%20demo%20request";

type Item = { href: string; t: string; d: string; icon: string };
const MENUS: { label: string; items: Item[] }[] = [
  {
    label: "Product",
    items: [
      { href: "#features", t: "Features", d: "Results, fees, CBT, lesson notes and more", icon: "M4 6h16M4 12h16M4 18h10" },
      { href: "#portals", t: "Portals", d: "A view for admins, teachers, parents and students", icon: "M3 4h7v7H3zM14 4h7v7h-7zM3 15h7v6H3zM14 15h7v6h-7z" },
      { href: "/demo", t: "Live demo", d: "Click around a made-up school, no sign-up", icon: "M5 3l14 9-14 9z" },
      { href: "#pricing", t: "Pricing", d: "Free for pilot schools", icon: "M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" },
    ],
  },
  {
    label: "Resources",
    items: [
      { href: "#how", t: "How it works", d: "From demo to go-live in one week", icon: "M4 12h4l3-8 4 16 3-8h2" },
      { href: "#faq", t: "FAQ", d: "Questions schools ask us", icon: "M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z" },
      { href: "/privacy", t: "Data protection", d: "How we look after your school's data", icon: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" },
      { href: "mailto:enquiries@simpliskool.com", t: "Contact us", d: "enquiries@simpliskool.com", icon: "M4 4h16v16H4zM4 6l8 7 8-7" },
    ],
  },
];

function Icon({ d }: { d: string }) {
  return (
    <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-[#E7F6F2] text-brand-teal-dark">
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d={d} />
      </svg>
    </span>
  );
}

/** The marketing site header: dropdown menus on computers, a fold-out menu on phones. No JavaScript needed. */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-[#E3EAF3]/80 bg-white/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-6 px-4 py-3 sm:px-6">
        <Link href="/" aria-label="Simpliskool home" className="flex-none">
          <Image src="/simpliskool-logo-dark.png" alt="Simpliskool" width={157} height={35} priority className="h-8 w-auto sm:h-9" />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          {MENUS.map((m) => (
            <div key={m.label} className="group relative">
              <button type="button" aria-haspopup="true" className="inline-flex min-h-[44px] items-center gap-1 rounded-full px-4 text-[15px] font-semibold text-brand-slate hover:bg-brand-mist group-focus-within:bg-brand-mist">
                {m.label}
                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" className="transition-transform group-hover:rotate-180 group-focus-within:rotate-180">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
              <div className="invisible absolute left-1/2 top-full w-[380px] -translate-x-1/2 pt-2 opacity-0 transition-all duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                <ul className="rounded-2xl border border-[#E3EAF3] bg-white p-2 shadow-[0_24px_60px_-20px_rgba(15,42,82,0.35)]">
                  {m.items.map((i) => (
                    <li key={i.t}>
                      <a href={i.href} className="flex items-center gap-3 rounded-xl p-3 hover:bg-brand-cloud focus-visible:bg-brand-cloud">
                        <Icon d={i.icon} />
                        <span>
                          <span className="block text-[15px] font-bold text-brand-navy">{i.t}</span>
                          <span className="block text-[13px] text-[#4A5A70]">{i.d}</span>
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
          <a href="#pricing" className="inline-flex min-h-[44px] items-center rounded-full px-4 text-[15px] font-semibold text-brand-slate hover:bg-brand-mist">
            Pricing
          </a>
        </nav>

        <div className="flex items-center gap-2">
          <Link href="/login" className="hidden min-h-[44px] items-center rounded-full px-4 text-[15px] font-bold text-brand-navy hover:bg-brand-mist sm:inline-flex">
            Sign in
          </Link>
          <a href={DEMO_MAIL} className="hidden min-h-[44px] items-center rounded-full bg-brand-navy px-5 text-[15px] font-bold text-white shadow-[0_10px_24px_-10px_rgba(23,59,112,0.7)] hover:bg-brand-navy-dark sm:inline-flex">
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
            <div className="absolute inset-x-0 top-full max-h-[calc(100vh-64px)] overflow-y-auto border-b border-[#E3EAF3] bg-white px-4 pb-6 pt-2 shadow-[0_24px_40px_-20px_rgba(15,42,82,0.35)]">
              {MENUS.map((m) => (
                <div key={m.label} className="mt-3">
                  <p className="px-3 text-xs font-extrabold uppercase tracking-[0.12em] text-[#4A5A70]">{m.label}</p>
                  <ul className="mt-1">
                    {m.items.map((i) => (
                      <li key={i.t}>
                        <a href={i.href} className="flex items-center gap-3 rounded-xl p-2.5 hover:bg-brand-cloud">
                          <Icon d={i.icon} />
                          <span className="text-[15px] font-bold text-brand-navy">{i.t}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <div className="mt-5 grid grid-cols-2 gap-2">
                <Link href="/login" className="inline-flex min-h-[48px] items-center justify-center rounded-full border-[1.5px] border-brand-navy font-bold text-brand-navy">
                  Sign in
                </Link>
                <a href={DEMO_MAIL} className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-brand-navy font-bold text-white">
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
