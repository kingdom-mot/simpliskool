import fs from "node:fs";
import path from "node:path";
import Image from "next/image";
import Link from "next/link";
import { PortalTabs } from "./PortalTabs";
import { SiteHeader } from "./SiteHeader";

const DEMO = "mailto:enquiries@simpliskool.com?subject=Simpliskool%20demo%20request";
const WHATSAPP = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;

/**
 * Photos for the landing page live in public/landing/. Each slot shows the photo once the file is
 * there (hero.jpg, setup.jpg, training.jpg, data.jpg, benefit-1.jpg … benefit-8.jpg; .webp or .png
 * work too), and a drawn stand-in until then, so the page never shows a gap.
 */
function photo(name: string): string | null {
  for (const ext of ["webp", "jpg", "jpeg", "png"]) {
    if (fs.existsSync(path.join(process.cwd(), "public", "landing", `${name}.${ext}`))) return `/landing/${name}.${ext}`;
  }
  return null;
}

const MODULES = ["Admissions", "Student records", "Attendance", "Results & report cards", "Fee payments", "CBT exams", "Lesson notes", "Homework", "Timetables", "Staff clock-in", "Payroll", "School website", "AI assistant", "Multi-branch"];

const TEAMS = [
  {
    t: "School operations",
    d: "Set up sessions, classes and staff once. Then watch fees, attendance and admissions update in real time.",
    tags: ["Admissions", "Fee payments", "Staff clock-in", "Payroll"],
    icon: "M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6",
    tint: "bg-[#E8F0FB] text-brand-navy",
  },
  {
    t: "Teaching and academics",
    d: "Teachers mark attendance in seconds, enter scores once, and the AI assistant helps with notes and comments.",
    tags: ["Results", "CBT exams", "Lesson notes", "Homework"],
    icon: "M2 7l10-4 10 4-10 4zM6 9v5c0 2 3 4 6 4s6-2 6-4V9",
    tint: "bg-[#E7F6F2] text-brand-teal-dark",
  },
  {
    t: "Parents and students",
    d: "One login for all their children. Results, fees, attendance and school news, right on their phone.",
    tags: ["Report cards", "Pay fees online", "Attendance", "Notices"],
    icon: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8",
    tint: "bg-[#FFF3DA] text-[#7A5300]",
  },
];

const BENEFITS = [
  { t: "Results and report cards in minutes", d: "Teachers enter CA and exam scores; totals, grades, positions and class averages calculate themselves.", k: "Upon approval, branded report cards are released to parents at once.", icon: "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" },
  { t: "Online fee payments", d: "Invoices, part payments, receipts and defaulter lists, matched automatically.", k: "Paid straight into your school's bank account.", icon: "M2 5h20v14H2zM2 10h20M6 15h4" },
  { t: "CBT exams", d: "Timed computer-based tests with question banks and shuffling.", k: "Marked instantly.", icon: "M3 4h18v12H3zM8 20h8M12 16v4" },
  { t: "Works when network is unavailable", d: "Take attendance and enter scores offline.", k: "They sync the moment you're back online.", icon: "M1 1l22 22M16.7 11.1A10.9 10.9 0 0 1 19 12.6M5 12.6a10.9 10.9 0 0 1 5.2-2.5M10.7 5.1A16 16 0 0 1 22.6 9M1.4 9a15.9 15.9 0 0 1 4.3-2.7M8.5 16.1a5 5 0 0 1 7 0M12 20h.01" },
  { t: "Lesson notes and staff clock-in", d: "Teachers submit notes for the principal to approve.", k: "The principal clocks staff in and out each day.", icon: "M12 6v6l4 2M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z" },
  { t: "Your own school website, included", d: "A clean, mobile-ready site at yourschool.simpliskool.com, with news, gallery and online admission forms.", k: "Admission forms land straight in your admin portal.", icon: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" },
  { t: "Multi-branch groups", d: "Proprietors see every branch together while each branch runs its own day-to-day.", k: "Fees, attendance and results from one dashboard.", icon: "M6 3v12M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 9a9 9 0 0 1-9 9" },
  { t: "Your data, protected", d: "Each school's data is kept separate, encrypted and backed up daily, in line with the Nigeria Data Protection Act 2023.", k: "Your school owns its data. We never sell it.", icon: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4" },
];

const STEPS = [
  { t: "Book a demo", d: "We walk you through Simpliskool using your school's real setup." },
  { t: "We set you up", d: "Sessions, classes, subjects and fees configured, and your records imported." },
  { t: "Train your staff", d: "A short hands-on session for admins and teachers, in person or online." },
  { t: "Go live", d: "Website is officially launched and ready to use." },
];

const PLANS = [
  { name: "Starter", for: "Small schools getting organised", items: ["Admin, teacher, parent and student portals", "Attendance, results and report cards", "Fees and online payments", "School website"] },
  { name: "Standard", for: "Growing schools that want it all", popular: true, items: ["Everything in Starter", "CBT exams and lesson notes", "AI teaching assistant", "Staff clock-in, payroll and timetables"] },
  { name: "Group", for: "Proprietors with several branches", items: ["Everything in Standard", "Multi-branch dashboard", "Shared settings across branches", "Priority support"] },
];

const FAQS = [
  { q: "Do we need computers or special equipment?", a: "No. Simpliskool runs in the browser on any smartphone, tablet or laptop. Teachers can take attendance offline and it syncs later." },
  { q: "Can you move our existing student records in?", a: "Yes. Upload your student and parent lists from Excel, or send them to us and our team will import them during setup." },
  { q: "How do parents pay fees?", a: "Parents pay by card, bank transfer or USSD. Each payment is matched to the right invoice, receipts are issued instantly, and the money is paid into the school's bank account." },
  { q: "How do young pupils sign in without a phone?", a: "Older students and parents sign in with a code sent to their phone or email. Younger pupils sign in with their admission number and a PIN printed on a login slip by the school." },
  { q: "Is our school data safe?", a: "Each school's data is kept separate and protected with role-based access, so teachers, parents and students only see what they should. Data is encrypted and backed up daily. We handle personal data in line with the Nigeria Data Protection Act 2023: your school owns its data, we only use it to run Simpliskool, we never sell it, and you can export or delete it at any time." },
  { q: "We have more than one campus. Does that work?", a: "Yes. The group dashboard lets proprietors see every branch together while each branch runs its own day-to-day." },
];

const DEMO_ROLES = [
  { t: "Admin & proprietor", d: "Fees, attendance, results and staff for the whole school.", icon: "M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z" },
  { t: "Teacher", d: "Register, scores, lesson notes, homework and CBT.", icon: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" },
  { t: "Parent", d: "Report cards, fees, attendance and notices for each child.", icon: "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21.2l8.8-8.8a5.5 5.5 0 0 0 0-7.8z" },
  { t: "Student", d: "Timetable, homework, tests and results on a phone.", icon: "M4 19.5V5a2 2 0 0 1 2-2h14v16H6.5A2.5 2.5 0 0 0 4 21.5" },
];

function Check({ className = "", color = "#0B7D6E" }: { className?: string; color?: string }) {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className={`flex-none ${className}`}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function Glyph({ d, size = 22 }: { d: string; size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

function Eyebrow({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return (
    <p className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[13px] font-extrabold uppercase tracking-[0.1em] ${light ? "bg-white/10 text-[#7FE0D2]" : "bg-[#E7F6F2] text-brand-teal-dark"}`}>
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${light ? "bg-[#7FE0D2]" : "bg-brand-teal"}`} />
      {children}
    </p>
  );
}

function SectionHead({ id, eyebrow, title, intro, light = false, center = true }: { id: string; eyebrow: string; title: React.ReactNode; intro?: string; light?: boolean; center?: boolean }) {
  return (
    <div className={`mb-12 flex flex-col gap-4 ${center ? "items-center text-center" : "items-start"}`}>
      <Eyebrow light={light}>{eyebrow}</Eyebrow>
      <h2 id={id} className={`max-w-3xl text-[32px] leading-[1.1] tracking-[-0.02em] md:text-[46px] ${light ? "!text-white" : ""}`}>
        {title}
      </h2>
      {intro && <p className={`max-w-2xl text-lg leading-relaxed ${light ? "text-[#C9D6EA]" : "text-[#4A5A70]"}`}>{intro}</p>}
    </div>
  );
}

export default function Home() {
  const hero = photo("hero");
  const partners = [
    {
      img: photo("setup"),
      eyebrow: "We set you up",
      t: "Your records moved in. Your school configured.",
      d: "Sessions, classes, subjects and fees configured, and your records imported. Upload your student and parent lists from Excel, or send them to us and our team will import them during setup.",
      points: ["Student and parent lists imported for you", "Classes, subjects and fees ready on day one", "Your school website set up at yourschool.simpliskool.com"],
      art: "setup",
    },
    {
      img: photo("training"),
      eyebrow: "We train your staff",
      t: "A short, hands-on session for your whole team.",
      d: "Admins and teachers learn Simpliskool on the phones and laptops they already use, in person or online. Pilot schools get setup and training free.",
      points: ["In person or online", "Works on any smartphone, tablet or laptop", "Help guides inside the portal for every role"],
      art: "training",
    },
    {
      img: photo("data"),
      eyebrow: "Your data stays yours",
      t: "Children's data, handled with care.",
      d: "Each school's data is kept separate and protected with role-based access, so teachers, parents and students only see what they should. We handle personal data in line with the Nigeria Data Protection Act 2023.",
      points: ["Encrypted and backed up daily", "We only use it to run Simpliskool, and never sell it", "Export or delete your data at any time"],
      art: "data",
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      <a href="#main" className="sk-skip">
        Skip to main content
      </a>

      <aside aria-label="Announcement" className="bg-gradient-to-r from-brand-navy-dark via-brand-navy to-[#0B5E63] px-4 py-2.5 text-center text-sm font-semibold text-white">
        <span aria-hidden="true" className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-[#7FE0D2] motion-reduce:animate-none" />
        Now onboarding pilot schools in Lagos and its environs.{" "}
        <a href="#pilot" className="font-bold text-[#7FE0D2] underline underline-offset-2 hover:text-white">
          Join the pilot →
        </a>
      </aside>

      <SiteHeader />

      <main id="main">
        {/* Hero */}
        <section className="relative overflow-hidden bg-brand-cloud">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <div className="absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full bg-[#BFEDE4] opacity-60 blur-[110px]" />
            <div className="absolute -right-32 top-10 h-[460px] w-[460px] rounded-full bg-[#C9DAF5] opacity-70 blur-[110px]" />
            <div className="absolute bottom-[-180px] left-1/3 h-[380px] w-[380px] rounded-full bg-[#FDE6B4] opacity-50 blur-[110px]" />
            <div className="sk-dots absolute inset-0 opacity-40" />
          </div>
          <div className="relative mx-auto grid max-w-[1240px] items-center gap-14 px-4 pb-20 pt-14 sm:px-6 md:pt-20 lg:grid-cols-[1.02fr_1fr]">
            <div className="flex flex-col gap-6">
              <span className="inline-flex items-center gap-2 self-start rounded-full border border-[#DCE5F0] bg-white/80 py-1.5 pl-1.5 pr-3.5 text-[13px] font-semibold text-brand-navy backdrop-blur">
                <span className="rounded-full bg-[#F4B740] px-2.5 py-0.5 text-xs font-extrabold">NEW</span>
                Lesson notes approved by the principal, shared with the class
              </span>
              <h1 className="text-[42px] leading-[1.03] tracking-[-0.035em] md:text-[64px]">
                Run your whole school from{" "}
                <span className="relative whitespace-nowrap">
                  <span className="bg-gradient-to-r from-brand-teal-dark to-brand-navy bg-clip-text text-transparent">one simple place.</span>
                  <svg aria-hidden="true" className="absolute -bottom-2 left-0 w-full" height="12" viewBox="0 0 300 12" preserveAspectRatio="none">
                    <path d="M2 9C60 3 140 2 298 7" stroke="#F4B740" strokeWidth="4" strokeLinecap="round" fill="none" />
                  </svg>
                </span>
              </h1>
              <p className="max-w-[540px] text-lg leading-relaxed text-[#4A5A70] md:text-[19px]">
                Admissions, attendance, results, fees, computer-based exams and parent updates, connected in one platform. Built for schools in Africa.
              </p>
              <div className="flex flex-wrap gap-3">
                <a href={DEMO} className="inline-flex min-h-[54px] items-center gap-2 rounded-full bg-brand-navy px-7 text-base font-bold text-white shadow-[0_16px_32px_-12px_rgba(23,59,112,0.7)] hover:bg-brand-navy-dark">
                  Book a free demo
                  <Glyph d="M5 12h14M13 6l6 6-6 6" size={18} />
                </a>
                <Link href="/demo" className="inline-flex min-h-[54px] items-center gap-2.5 rounded-full border border-[#DCE5F0] bg-white px-6 text-base font-bold text-brand-navy hover:border-brand-navy">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#E7F6F2] text-brand-teal-dark">
                    <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M6 4l14 8-14 8z" />
                    </svg>
                  </span>
                  Try the live demo
                </Link>
              </div>
              <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-[#4A5A70]">
                {["Works on any phone", "Fees paid online", "Keeps working offline"].map((t) => (
                  <li key={t} className="flex items-center gap-1.5">
                    <Check />
                    {t}
                  </li>
                ))}
              </ul>
            </div>

            <HeroVisual photoSrc={hero} />
          </div>

          {/* Modules marquee */}
          <section aria-labelledby="modules-h" className="relative border-t border-[#E3EAF3] bg-white/70 py-7 backdrop-blur">
            <h2 id="modules-h" className="sr-only">
              Everything your school runs on
            </h2>
            <div className="sk-marquee overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]">
              <ul className="sk-marquee-track flex w-max gap-3">
                {[...MODULES, ...MODULES].map((m, i) => (
                  <li key={i} aria-hidden={i >= MODULES.length || undefined} className="flex items-center gap-2 whitespace-nowrap rounded-full border border-[#DCE5F0] bg-white px-4 py-2 text-sm font-semibold text-brand-navy">
                    <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand-teal" />
                    {m}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </section>

        {/* Built for every school team */}
        <section id="features" aria-labelledby="features-h" className="scroll-mt-20 bg-white py-24">
          <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
            <SectionHead id="features-h" eyebrow="Built for how schools really work" title="Less paperwork. More teaching." intro="One platform for the office, the classroom and the home, so everyone works from the same up-to-date records." />
            <div className="grid gap-5 md:grid-cols-3">
              {TEAMS.map((t) => (
                <article key={t.t} className="group flex flex-col rounded-[28px] border border-[#E3EAF3] bg-white p-7 transition-all hover:-translate-y-1 hover:shadow-[0_30px_60px_-30px_rgba(15,42,82,0.35)]">
                  <span className={`flex h-14 w-14 items-center justify-center rounded-2xl ${t.tint}`}>
                    <Glyph d={t.icon} size={26} />
                  </span>
                  <h3 className="mt-6 text-2xl">{t.t}</h3>
                  <p className="mt-3 flex-1 text-base leading-relaxed text-[#4A5A70]">{t.d}</p>
                  <ul className="mt-6 flex flex-wrap gap-2">
                    {t.tags.map((g) => (
                      <li key={g} className="rounded-full bg-brand-cloud px-3 py-1.5 text-[13px] font-semibold text-brand-navy">
                        {g}
                      </li>
                    ))}
                  </ul>
                  <a href="#portals" className="mt-6 inline-flex min-h-[44px] items-center gap-1.5 self-start text-[15px] font-bold text-brand-teal-dark hover:gap-2.5">
                    See the portals <span className="sr-only">for {t.t.toLowerCase()}</span>
                    <Glyph d="M5 12h14M13 6l6 6-6 6" size={16} />
                  </a>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Portals */}
        <section id="portals" aria-labelledby="portals-h" className="relative scroll-mt-20 overflow-hidden bg-brand-navy-dark py-24">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <div className="absolute -right-40 -top-40 h-[480px] w-[480px] rounded-full bg-brand-teal opacity-25 blur-[120px]" />
            <div className="absolute -bottom-48 -left-40 h-[480px] w-[480px] rounded-full bg-[#3B6CC4] opacity-30 blur-[120px]" />
          </div>
          <div className="relative mx-auto max-w-[1240px] px-4 sm:px-6">
            <SectionHead id="portals-h" light eyebrow="One platform, a portal for everyone" title="Everyone in your school gets the view they need" />
            <PortalTabs />
          </div>
        </section>

        {/* Benefits */}
        <section aria-labelledby="benefits-h" className="bg-brand-cloud py-24">
          <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
            <SectionHead id="benefits-h" eyebrow="What changes in your school" title="Every school day becomes easier to run." />
            <ol className="-mx-4 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-4 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4" tabIndex={0} aria-label="Benefits">
              {BENEFITS.map((b, i) => {
                const img = photo(`benefit-${i + 1}`);
                return (
                  <li key={b.t} className="flex w-[82vw] max-w-[340px] flex-none snap-start flex-col overflow-hidden rounded-[24px] border border-[#E3EAF3] bg-white sm:w-auto sm:max-w-none">
                    {img ? (
                      <Image src={img} alt="" width={640} height={400} className="h-40 w-full object-cover" />
                    ) : (
                      <div aria-hidden="true" className="relative flex h-32 items-end overflow-hidden bg-gradient-to-br from-[#E8F0FB] to-[#E7F6F2] p-5">
                        <span className="absolute -right-4 -top-6 font-heading text-[110px] font-extrabold leading-none text-white/70">{String(i + 1).padStart(2, "0")}</span>
                        <span className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-brand-teal-dark shadow-[0_10px_20px_-10px_rgba(15,42,82,0.4)]">
                          <Glyph d={b.icon} />
                        </span>
                      </div>
                    )}
                    <div className="flex flex-1 flex-col p-6">
                      <span className="text-sm font-extrabold text-brand-teal-dark">{String(i + 1).padStart(2, "0")}</span>
                      <h3 className="mt-1 text-xl leading-snug">{b.t}</h3>
                      <p className="mt-2 flex-1 text-[15px] leading-relaxed text-[#4A5A70]">{b.d}</p>
                      <p className="mt-4 border-t border-[#E3EAF3] pt-4 text-[15px] font-bold text-brand-navy">{b.k}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
            <p className="mt-2 text-center text-sm text-[#4A5A70] sm:hidden">Swipe to see more</p>
          </div>
        </section>

        {/* Partnership */}
        <section aria-labelledby="partner-h" className="overflow-x-clip bg-white py-24">
          <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
            <SectionHead id="partner-h" eyebrow="More than software" title="We set you up, train your team and stay with you." intro="Pilot schools get free setup, staff training and free use during the pilot. We'll move your existing records in for you." />
            <div className="flex flex-col gap-20">
              {partners.map((p, i) => (
                <div key={p.eyebrow} className={`grid items-center gap-10 lg:grid-cols-2 lg:gap-16 ${i % 2 ? "lg:[&>*:first-child]:order-2" : ""}`}>
                  <div className="relative">
                    <div aria-hidden="true" className={`absolute -inset-3 -z-0 rounded-[36px] ${["bg-[#E7F6F2]", "bg-[#E8F0FB]", "bg-[#FFF3DA]"][i]} rotate-[-2deg]`} />
                    {p.img ? (
                      <Image src={p.img} alt="" width={1200} height={860} className="relative aspect-[7/5] w-full rounded-[28px] object-cover" />
                    ) : (
                      <PartnerArt kind={p.art} />
                    )}
                  </div>
                  <div className="flex flex-col gap-4">
                    <p className="text-sm font-extrabold uppercase tracking-[0.12em] text-brand-teal-dark">{p.eyebrow}</p>
                    <h3 className="text-[28px] leading-tight md:text-[36px]">{p.t}</h3>
                    <p className="text-lg leading-relaxed text-[#4A5A70]">{p.d}</p>
                    <ul className="mt-2 flex flex-col gap-3">
                      {p.points.map((x) => (
                        <li key={x} className="flex items-start gap-3 text-base font-semibold text-brand-slate">
                          <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-[#E7F6F2]">
                            <Check className="h-3.5 w-3.5" />
                          </span>
                          {x}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Live demo */}
        <section id="demo" aria-labelledby="demo-h" className="scroll-mt-20 bg-brand-cloud py-24">
          <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
            <SectionHead id="demo-h" eyebrow="Live demo" title="Try it now. No sign-up." intro="Bright Future Academy is a made-up school in Lekki, Lagos. Pick a role and click around. Nothing is real and everything resets every night." />
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {DEMO_ROLES.map((r) => (
                <li key={r.t}>
                  <Link href="/demo" className="group flex h-full flex-col rounded-[24px] border border-[#E3EAF3] bg-white p-6 transition-all hover:-translate-y-1 hover:border-brand-teal hover:shadow-[0_24px_48px_-24px_rgba(15,42,82,0.35)]">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-navy text-white">
                      <Glyph d={r.icon} />
                    </span>
                    <span className="mt-5 font-heading text-xl font-extrabold text-brand-navy">{r.t}</span>
                    <span className="mt-2 flex-1 text-[15px] leading-relaxed text-[#4A5A70]">{r.d}</span>
                    <span className="mt-5 inline-flex items-center gap-1.5 text-[15px] font-bold text-brand-teal-dark group-hover:gap-2.5">
                      Open the demo <Glyph d="M5 12h14M13 6l6 6-6 6" size={16} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* How it works */}
        <section id="how" aria-labelledby="how-h" className="scroll-mt-20 bg-white py-24">
          <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
            <SectionHead id="how-h" eyebrow="How it works" title="Live in one week, not one term" />
            <ol className="relative grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
              <span aria-hidden="true" className="absolute left-[12%] right-[12%] top-7 hidden border-t-2 border-dashed border-[#C9D6EA] lg:block" />
              {STEPS.map((s, i) => (
                <li key={s.t} className="relative flex flex-col items-center text-center">
                  <span className={`relative flex h-14 w-14 items-center justify-center rounded-full font-heading text-xl font-extrabold ring-8 ring-white ${i === STEPS.length - 1 ? "bg-brand-teal-dark text-white" : "bg-brand-navy text-white"}`}>{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="mt-5 text-xl">{s.t}</h3>
                  <p className="mt-2 max-w-[260px] text-[15px] leading-relaxed text-[#4A5A70]">{s.d}</p>
                </li>
              ))}
            </ol>
            <div className="mt-12 flex justify-center">
              <a href={DEMO} className="inline-flex min-h-[52px] items-center gap-2 rounded-full bg-brand-navy px-7 text-base font-bold text-white hover:bg-brand-navy-dark">
                Talk to our team <Glyph d="M5 12h14M13 6l6 6-6 6" size={18} />
              </a>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" aria-labelledby="pricing-h" className="scroll-mt-20 bg-brand-cloud py-24">
          <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
            <SectionHead id="pricing-h" eyebrow="Simple pricing" title="Pay per student, per term" intro="Pilot schools use Simpliskool free during the pilot. Prices for everyone else will be announced soon." />
            <div className="grid items-stretch gap-5 md:grid-cols-3">
              {PLANS.map((p) => (
                <div key={p.name} className={`relative flex flex-col rounded-[28px] p-8 ${p.popular ? "bg-brand-navy text-white shadow-[0_40px_80px_-30px_rgba(15,42,82,0.6)] md:-my-3 md:py-11" : "border border-[#E3EAF3] bg-white"}`}>
                  {p.popular && <span className="absolute -top-3.5 left-8 rounded-full bg-[#F4B740] px-3.5 py-1 text-xs font-extrabold text-[#0A1F3D]">Most popular</span>}
                  <h3 className={`text-2xl ${p.popular ? "!text-white" : ""}`}>{p.name}</h3>
                  <p className={`mt-1 text-[15px] ${p.popular ? "text-[#C9D6EA]" : "text-[#4A5A70]"}`}>{p.for}</p>
                  <p className={`mt-6 font-heading text-[30px] font-extrabold ${p.popular ? "text-white" : "text-brand-navy"}`}>Free in the pilot</p>
                  <ul className="mt-6 flex-1 space-y-3.5">
                    {p.items.map((i) => (
                      <li key={i} className="flex items-start gap-2.5 text-[15px]">
                        <Check className="mt-0.5" color={p.popular ? "#7FE0D2" : "#0B7D6E"} />
                        {i}
                      </li>
                    ))}
                  </ul>
                  <a href="#pilot" className={`mt-8 inline-flex min-h-[50px] items-center justify-center rounded-full text-base font-bold ${p.popular ? "bg-brand-teal text-[#0A1F3D] hover:bg-[#3FD1B4]" : "border-[1.5px] border-brand-navy text-brand-navy hover:bg-brand-mist"}`}>
                    Join the pilot
                  </a>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Ready band with numbers */}
        <section id="pilot" aria-labelledby="pilot-h" className="scroll-mt-20 bg-white py-24">
          <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
            <div className="relative overflow-hidden rounded-[36px] bg-gradient-to-br from-brand-navy-dark via-brand-navy to-[#0B5E63] px-7 py-14 md:px-14 md:py-16">
              <div aria-hidden="true" className="pointer-events-none absolute inset-0">
                <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-brand-teal opacity-30 blur-[90px]" />
                <Image src="/simpliskool-icon.png" alt="" width={192} height={192} className="absolute -bottom-12 -right-10 h-72 w-72 opacity-10" />
              </div>
              <div className="relative grid items-center gap-10 lg:grid-cols-[1.3fr_1fr]">
                <div>
                  <Eyebrow light>Pilot program · Lagos and its environs</Eyebrow>
                  <h2 id="pilot-h" className="mt-4 text-[32px] leading-[1.1] !text-white md:text-[48px]">
                    Be one of our first pilot schools
                  </h2>
                  <p className="mt-4 max-w-xl text-lg leading-relaxed text-[#DCE5F0]">Pilot schools get free setup, staff training and free use during the pilot. We&apos;ll move your existing records in for you.</p>
                  <div className="mt-8 flex flex-wrap gap-3">
                    <a href={DEMO} className="inline-flex min-h-[54px] items-center justify-center rounded-full bg-brand-teal px-7 text-base font-extrabold text-[#0A1F3D] hover:bg-[#3FD1B4]">
                      Book a free demo
                    </a>
                    <Link href="/demo" className="inline-flex min-h-[54px] items-center justify-center rounded-full border-[1.5px] border-white/60 px-7 text-base font-bold text-white hover:bg-white/10">
                      Try the live demo
                    </Link>
                    {WHATSAPP && (
                      <a href={`https://wa.me/${WHATSAPP}`} className="inline-flex min-h-[54px] items-center justify-center rounded-full border-[1.5px] border-white/60 px-7 text-base font-bold text-white hover:bg-white/10">
                        Chat on WhatsApp
                      </a>
                    )}
                  </div>
                </div>
                <dl className="grid grid-cols-2 gap-3">
                  {[
                    [String(MODULES.length), "modules in one platform"],
                    ["4", "portals: admin, teacher, parent, student"],
                    ["1 week", "from demo to go-live"],
                    ["Offline", "registers and scores keep working"],
                  ].map(([n, l]) => (
                    <div key={l} className="rounded-2xl border border-white/15 bg-white/[0.07] p-5 backdrop-blur">
                      <dt className="sr-only">{l}</dt>
                      <dd>
                        <span className="block font-heading text-[34px] font-extrabold leading-none text-white">{n}</span>
                        <span className="mt-2 block text-sm leading-snug text-[#C9D6EA]">{l}</span>
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" aria-labelledby="faq-h" className="scroll-mt-20 bg-white pb-24">
          <div className="mx-auto grid max-w-[1240px] gap-10 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
            <div className="lg:sticky lg:top-28 lg:self-start">
              <SectionHead id="faq-h" center={false} eyebrow="FAQ" title="Questions schools ask us" />
              <p className="-mt-6 text-lg leading-relaxed text-[#4A5A70]">
                Something else on your mind?{" "}
                <a href="mailto:enquiries@simpliskool.com" className="font-bold text-brand-teal-dark underline underline-offset-2">
                  Email our team
                </a>
                .
              </p>
            </div>
            <div className="space-y-3">
              {FAQS.map((f, i) => (
                <details key={f.q} className="group rounded-2xl border border-[#E3EAF3] bg-white open:border-brand-teal open:bg-brand-cloud open:shadow-[0_20px_40px_-28px_rgba(15,42,82,0.35)]" open={i === 0}>
                  <summary className="flex min-h-[64px] cursor-pointer list-none items-center justify-between gap-4 px-6 py-4 text-[17px] font-bold text-brand-navy [&::-webkit-details-marker]:hidden">
                    {f.q}
                    <span aria-hidden="true" className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[#E7F6F2] text-xl text-brand-teal-dark transition-transform group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="px-6 pb-5 text-base leading-relaxed text-brand-slate">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="relative overflow-hidden bg-[#0A1F3D] text-[#C9D6EA]">
        <div aria-hidden="true" className="pointer-events-none absolute -right-40 -top-40 h-[420px] w-[420px] rounded-full bg-brand-teal opacity-15 blur-[120px]" />
        <div className="relative mx-auto grid max-w-[1240px] gap-12 px-4 pb-10 pt-16 sm:px-6 lg:grid-cols-[1.3fr_2fr]">
          <div className="max-w-sm">
            <Image src="/simpliskool-logo.png" alt="Simpliskool" width={157} height={35} className="h-9 w-auto" />
            <p className="mt-5 text-[15px] leading-relaxed">Simplifying school management for schools across Africa. Admissions, attendance, results, fees and parent updates in one simple place.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href={DEMO} className="inline-flex min-h-[46px] items-center rounded-full bg-brand-teal px-5 text-[15px] font-extrabold text-[#0A1F3D] hover:bg-[#3FD1B4]">
                Book a demo
              </a>
              {WHATSAPP && (
                <a href={`https://wa.me/${WHATSAPP}`} className="inline-flex min-h-[46px] items-center gap-2 rounded-full border border-white/25 px-5 text-[15px] font-bold text-white hover:bg-white/10">
                  WhatsApp us
                </a>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-8 text-[15px] sm:grid-cols-4">
            <FooterCol title="Product" links={[["Features", "#features"], ["Portals", "#portals"], ["Live demo", "/demo"], ["Pricing", "#pricing"]]} />
            <FooterCol title="Company" links={[["Dream Savvy Solutions", "https://dreamsavvysolutions.com"], ["Contact us", "mailto:enquiries@simpliskool.com"], ["Join the pilot", "#pilot"], ["Sign in", "/login"]]} />
            <FooterCol title="Resources" links={[["How it works", "#how"], ["FAQ", "#faq"], ["Book a demo", DEMO]]} />
            <FooterCol title="Legal" links={[["Privacy policy", "/privacy"], ["Terms of use", "/terms"], ["Data processing agreement", "/dpa"]]} />
          </div>
        </div>
        <div className="relative mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-3 border-t border-white/10 px-4 py-6 text-sm sm:px-6">
          <p>© {new Date().getFullYear()} Dream Savvy Solutions. All rights reserved.</p>
          <p>Made in Lagos for schools across Africa.</p>
        </div>
      </footer>

      {WHATSAPP && (
        <a href={`https://wa.me/${WHATSAPP}`} aria-label="Chat with us on WhatsApp" className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#1F8A4C] text-white shadow-[0_16px_32px_-10px_rgba(0,0,0,0.45)] hover:bg-[#18713E]">
          <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.8-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3z" />
          </svg>
        </a>
      )}
    </div>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="!font-sans text-sm !font-extrabold uppercase tracking-[0.12em] !text-white">{title}</h2>
      <ul className="flex flex-col gap-2.5">
        {links.map(([t, h]) => (
          <li key={t}>
            {h.startsWith("/") ? (
              <Link href={h} className="hover:text-white">
                {t}
              </Link>
            ) : (
              <a href={h} className="hover:text-white">
                {t}
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The hero picture: a photo with live cards over it once hero.jpg is added, a drawn dashboard and phone until then. */
function HeroVisual({ photoSrc }: { photoSrc: string | null }) {
  const cards = (
    <>
      <div className="absolute -left-2 bottom-2 flex items-center gap-3 rounded-2xl border border-white/70 bg-white/95 px-4 py-3.5 shadow-[0_18px_40px_-12px_rgba(15,42,82,0.35)] backdrop-blur sm:-left-8">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E7F6F2] text-brand-teal-dark">
          <Glyph d="M2 5h20v14H2zM2 10h20" size={20} />
        </div>
        <div>
          <div className="text-[13px] font-bold text-brand-navy">₦85,000 fee received</div>
          <div className="text-xs text-[#4A5A70]">Tolu A. · JSS 2</div>
        </div>
      </div>
      <div className="absolute -right-2 top-4 w-[210px] rounded-2xl bg-[#0F2A52] px-4 py-3.5 text-white shadow-[0_18px_40px_-12px_rgba(15,42,82,0.45)] sm:-right-6">
        <div className="text-[11px] font-bold tracking-[0.06em] text-[#F4B740]">RESULT RELEASED</div>
        <div className="mt-1 text-[13px] font-semibold">First Term report cards sent to 588 parents</div>
      </div>
    </>
  );

  if (photoSrc) {
    return (
      <div className="relative px-2 py-8" aria-hidden="true">
        <div className="overflow-hidden rounded-[32px] border-[6px] border-white shadow-[0_40px_80px_-30px_rgba(15,42,82,0.45)]">
          <Image src={photoSrc} alt="" width={1200} height={900} priority className="aspect-[4/3] w-full object-cover" />
        </div>
        {cards}
      </div>
    );
  }

  return (
    <div className="relative px-2 pb-20 pt-8 lg:mr-6" aria-hidden="true">
      <div className="overflow-hidden rounded-[24px] border border-[#E3EAF3] bg-white shadow-[0_40px_80px_-30px_rgba(15,42,82,0.45)]">
        <div className="flex items-center gap-2 border-b border-[#E3EAF3] bg-[#F8FAFD] px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-[#F3A0A0]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#F4D27A]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#9ED8B4]" />
          <span className="ml-3 rounded-md bg-white px-3 py-0.5 text-[11px] text-[#4A5A70] ring-1 ring-[#E3EAF3]">simpliskool.com/admin</span>
        </div>
        <div className="grid grid-cols-[120px_1fr]">
          <div className="hidden flex-col gap-1.5 bg-brand-navy p-3 sm:flex">
            <Image src="/simpliskool-logo.png" alt="" width={90} height={20} className="mb-3 h-4 w-auto" />
            {["Dashboard", "Students", "Fees", "Results", "Staff"].map((x, i) => (
              <span key={x} className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold ${i === 0 ? "bg-white text-brand-navy" : "text-[#C9D6EA]"}`}>
                {x}
              </span>
            ))}
          </div>
          <div className="col-span-2 p-4 sm:col-span-1">
            <div className="text-[11px] font-semibold text-[#4A5A70]">Bright Stars College</div>
            <div className="font-heading text-base font-extrabold text-brand-navy">Good morning, Mrs Bello</div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-brand-cloud p-2.5">
                <div className="text-[10px] font-semibold text-[#4A5A70]">Students</div>
                <div className="font-heading text-xl font-extrabold text-brand-navy">642</div>
              </div>
              <div className="rounded-xl bg-[#E7F6F2] p-2.5">
                <div className="text-[10px] font-semibold text-[#0B6B5A]">Present</div>
                <div className="font-heading text-xl font-extrabold text-[#0B6B5A]">96%</div>
              </div>
              <div className="rounded-xl bg-[#FFF6E3] p-2.5">
                <div className="text-[10px] font-semibold text-[#7A5300]">Fees in</div>
                <div className="font-heading text-xl font-extrabold text-[#7A5300]">71%</div>
              </div>
            </div>
            <div className="mt-3 text-[11px] font-bold text-brand-navy">Fee collection this term</div>
            <div className="mt-1.5 flex h-[86px] items-end gap-2">
              {[35, 52, 46, 68, 80, 94].map((h, i) => (
                <div key={i} className="flex-1 rounded-t-md" style={{ height: `${h}%`, background: i === 5 ? "linear-gradient(#0F9D8A,#0B7D6E)" : "#D6E2F1" }} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Phone */}
      <div className="absolute -bottom-10 -right-1 w-[140px] rounded-[26px] border-[5px] border-[#0A1F3D] bg-white shadow-[0_30px_50px_-20px_rgba(15,42,82,0.6)] sm:-right-6 sm:w-[160px]">
        <div className="mx-auto mt-1.5 h-1.5 w-12 rounded-full bg-[#0A1F3D]" />
        <div className="p-2.5">
          <div className="rounded-xl bg-gradient-to-br from-brand-navy to-[#0B5E63] p-2.5 text-white">
            <div className="text-[9px] text-[#C9D6EA]">Parent · Mr Adebayo</div>
            <div className="text-[12px] font-extrabold">Tolu&apos;s results are ready</div>
          </div>
          {[
            ["Attendance", "98%"],
            ["Average", "76.4"],
            ["Fees", "Paid"],
          ].map(([a, b]) => (
            <div key={a} className="mt-1.5 flex justify-between rounded-lg bg-brand-cloud px-2 py-1.5 text-[10px]">
              <span className="text-[#4A5A70]">{a}</span>
              <span className="font-bold text-brand-navy">{b}</span>
            </div>
          ))}
          <div className="mt-2 flex justify-around border-t border-[#E3EAF3] pt-1.5">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={`h-1.5 w-5 rounded-full ${i === 0 ? "bg-brand-teal" : "bg-[#DCE5F0]"}`} />
            ))}
          </div>
        </div>
      </div>
      {cards}
    </div>
  );
}

/** Drawn stand-ins for the three partnership photos. */
function PartnerArt({ kind }: { kind: string }) {
  if (kind === "setup") {
    return (
      <div aria-hidden="true" className="relative flex w-full flex-col justify-center gap-3 overflow-hidden rounded-[28px] bg-gradient-to-br from-brand-navy to-[#0B5E63] p-5 sm:aspect-[7/5] sm:p-8">
        <div className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-lg">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#E7F6F2] text-brand-teal-dark">
            <Glyph d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5" />
          </span>
          <div className="flex-1">
            <div className="text-sm font-bold text-brand-navy">students-2026.xlsx</div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-brand-mist">
              <div className="h-full w-full rounded-full bg-brand-teal" />
            </div>
          </div>
          <span className="whitespace-nowrap text-sm font-extrabold text-brand-teal-dark">642 imported</span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            ["Classes", "18"],
            ["Subjects", "24"],
            ["Fee items", "9"],
          ].map(([a, b]) => (
            <div key={a} className="rounded-2xl bg-white/10 p-4 text-white ring-1 ring-white/20">
              <div className="font-heading text-3xl font-extrabold">{b}</div>
              <div className="text-sm text-[#C9D6EA]">{a} ready</div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 rounded-2xl bg-white/10 p-4 text-sm font-semibold text-white ring-1 ring-white/20">
          <Check color="#7FE0D2" /> brightstars.simpliskool.com is live
        </div>
      </div>
    );
  }
  if (kind === "training") {
    return (
      <div aria-hidden="true" className="relative flex w-full items-center justify-center overflow-hidden rounded-[28px] bg-gradient-to-br from-[#E8F0FB] to-[#F5F8FC] p-5 sm:aspect-[7/5] sm:p-8">
        <div className="grid w-full max-w-[420px] grid-cols-2 gap-3">
          {[
            ["Admins", "Fees, results, staff", "bg-brand-navy text-white"],
            ["Teachers", "Register and scores", "bg-white text-brand-navy"],
            ["Bursar", "Payments and receipts", "bg-white text-brand-navy"],
            ["Principal", "Approve notes, clock-in", "bg-brand-teal-dark text-white"],
          ].map(([a, b, c]) => (
            <div key={a} className={`rounded-2xl p-5 shadow-[0_16px_30px_-18px_rgba(15,42,82,0.5)] ${c}`}>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F4B740] text-[#0A1F3D]">
                <Check color="#0A1F3D" />
              </span>
              <div className="mt-3 font-heading text-lg font-extrabold">{a}</div>
              <div className="text-sm opacity-80">{b}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div aria-hidden="true" className="relative flex aspect-[7/5] w-full items-center justify-center overflow-hidden rounded-[28px] bg-gradient-to-br from-[#FFF6E3] to-[#F5F8FC] p-8">
      <div className="relative flex h-44 w-44 items-center justify-center rounded-full bg-white shadow-[0_30px_60px_-24px_rgba(15,42,82,0.45)]">
        <span className="text-brand-navy">
          <Glyph d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4" size={84} />
        </span>
      </div>
      {["Encrypted", "Backed up daily", "NDPA 2023", "Never sold"].map((t, i) => (
        <span key={t} className={`absolute rounded-full bg-white px-4 py-2 text-sm font-bold text-brand-navy shadow-md ${["left-6 top-8", "right-6 top-12", "bottom-10 left-10", "bottom-8 right-8"][i]}`}>
          {t}
        </span>
      ))}
    </div>
  );
}
