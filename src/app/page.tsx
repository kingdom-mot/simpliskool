import Image from "next/image";
import Link from "next/link";
import { PortalTabs } from "./PortalTabs";

const DEMO = "mailto:enquiries@simpliskool.com?subject=Simpliskool%20demo%20request";
const WHATSAPP = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;

const MODULES = ["Admissions", "Student records", "Attendance", "Results & report cards", "Fees & Paystack", "CBT exams", "Lesson notes", "Homework", "Timetables", "Staff clock-in", "Payroll", "School website", "AI assistant", "Multi-branch"];

const STEPS = [
  { t: "Book a demo", d: "We walk you through Simpliskool using your school's real setup." },
  { t: "We set you up", d: "Sessions, classes, subjects and fees configured, and your records imported." },
  { t: "Train your staff", d: "A short hands-on session for admins and teachers, in person or online." },
  { t: "Go live", d: "Parents and students get their logins, and you get support by WhatsApp and email." },
];

const PLANS = [
  { name: "Starter", for: "Small schools getting organised", items: ["Admin, teacher, parent and student portals", "Attendance, results and report cards", "Fees and Paystack payments", "School website"] },
  { name: "Standard", for: "Growing schools that want it all", popular: true, items: ["Everything in Starter", "CBT exams and lesson notes", "AI teaching assistant", "Staff clock-in, payroll and timetables"] },
  { name: "Group", for: "Proprietors with several branches", items: ["Everything in Standard", "Multi-branch dashboard", "Shared settings across branches", "Priority support"] },
];

const FAQS = [
  { q: "Do we need computers or special equipment?", a: "No. Simpliskool runs in the browser on any smartphone, tablet or laptop. Teachers can take attendance offline and it syncs later." },
  { q: "Can you move our existing student records in?", a: "Yes. Upload your student and parent lists from Excel, or send them to us and our team will import them during setup." },
  { q: "How do parents pay fees?", a: "Parents pay by card, bank transfer or USSD through Paystack. Each payment is matched to the right invoice, receipts are issued instantly, and the money is paid into the school's bank account." },
  { q: "How do young pupils sign in without a phone?", a: "Older students and parents sign in with a code sent to their phone or email. Younger pupils sign in with their admission number and a PIN printed on a login slip by the school." },
  { q: "Is our school data safe?", a: "Each school's data is kept separate and protected with role-based access, so teachers, parents and students only see what they should. Data is encrypted and backed up daily." },
  { q: "We have more than one campus. Does that work?", a: "Yes. The group dashboard lets proprietors see every branch together while each branch runs its own day-to-day." },
];

function Check({ className = "", color = "#0B7D6E" }: { className?: string; color?: string }) {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className={`flex-none ${className}`}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function Eyebrow({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return <p className={`text-sm font-extrabold uppercase tracking-[0.12em] ${light ? "text-[#7FE0D2]" : "text-brand-teal-dark"}`}>{children}</p>;
}

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <a href="#main" className="sk-skip">Skip to main content</a>

      <div className="bg-brand-navy px-4 py-2.5 text-center text-sm font-semibold text-white">
        Now onboarding pilot schools in Lagos and its environs.{" "}
        <a href="#pilot" className="font-bold text-[#7FE0D2] underline-offset-2 hover:underline">Join the pilot →</a>
      </div>

      <header className="sticky top-0 z-40 border-b border-[#E3EAF3] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-6 px-4 py-4 sm:px-6">
          <Link href="/" aria-label="Simpliskool home">
            <Image src="/simpliskool-logo-dark.png" alt="Simpliskool" width={157} height={35} priority className="h-8 w-auto sm:h-9" />
          </Link>
          <nav aria-label="Main" className="hidden items-center gap-7 text-[15px] font-semibold text-brand-slate lg:flex">
            <a href="#features" className="hover:text-brand-teal-dark">Features</a>
            <a href="#portals" className="hover:text-brand-teal-dark">Portals</a>
            <a href="#how" className="hover:text-brand-teal-dark">How it works</a>
            <a href="#pricing" className="hover:text-brand-teal-dark">Pricing</a>
            <a href="#faq" className="hover:text-brand-teal-dark">FAQ</a>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/login" className="inline-flex min-h-[44px] items-center rounded-full px-3 text-[15px] font-bold text-brand-navy hover:bg-brand-mist sm:px-4">Sign in</Link>
            <a href={DEMO} className="hidden min-h-[44px] items-center rounded-full bg-brand-teal-dark px-5 text-[15px] font-bold text-white hover:bg-[#096A5D] sm:inline-flex">Book a demo</a>
          </div>
        </div>
      </header>

      <main id="main">
        {/* Hero */}
        <section className="sk-dots bg-brand-cloud py-16 md:py-20">
          <div className="mx-auto grid max-w-[1200px] items-center gap-14 px-4 sm:px-6 lg:grid-cols-[1.05fr_1fr]">
            <div className="flex flex-col gap-6">
              <span className="inline-flex items-center gap-2 self-start rounded-full border border-[#DCE5F0] bg-white py-1.5 pl-1.5 pr-3.5 text-[13px] font-semibold text-brand-navy">
                <span className="rounded-full bg-[#F4B740] px-2.5 py-0.5 text-xs font-extrabold">NEW</span>
                Lesson notes approved by the principal, shared with the class
              </span>
              <h1 className="text-[40px] leading-[1.05] tracking-[-0.03em] md:text-[58px]">
                Run your whole school from <span className="text-brand-teal-dark">one simple place.</span>
              </h1>
              <p className="max-w-[540px] text-lg leading-relaxed text-[#4A5A70] md:text-[19px]">
                Admissions, attendance, results, fees, CBT exams and parent updates, connected in one platform. Built for schools in Africa.
              </p>
              <div className="flex flex-wrap gap-3">
                <a href={DEMO} className="inline-flex min-h-[52px] items-center rounded-full bg-brand-teal-dark px-7 text-base font-bold text-white hover:bg-[#096A5D]">Book a free demo</a>
                <a href="#portals" className="inline-flex min-h-[52px] items-center rounded-full border-[1.5px] border-brand-navy bg-white px-6 text-base font-bold text-brand-navy hover:bg-brand-mist">Explore the portals</a>
              </div>
              <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-[#4A5A70]">
                {["Works on any phone", "Fees paid online", "Keeps working offline"].map((t) => (
                  <li key={t} className="flex items-center gap-1.5"><Check />{t}</li>
                ))}
              </ul>
            </div>

            <div className="relative pb-20 pt-10" aria-hidden="true">
              <div className="overflow-hidden rounded-[22px] border border-[#E3EAF3] bg-white shadow-[0_30px_60px_-20px_rgba(15,42,82,0.28)]">
                <div className="flex items-center justify-between bg-brand-navy px-5 py-3.5">
                  <Image src="/simpliskool-logo.png" alt="" width={90} height={20} className="h-5 w-auto" />
                  <span className="text-xs font-semibold text-[#C9D6EA]">Bright Stars College · Admin</span>
                </div>
                <div className="grid grid-cols-3 gap-3 p-5">
                  <div className="rounded-2xl bg-brand-cloud p-3.5"><div className="text-[11px] font-semibold text-[#4A5A70]">Students</div><div className="font-heading text-2xl font-extrabold text-brand-navy">642</div></div>
                  <div className="rounded-2xl bg-[#E7F6F2] p-3.5"><div className="text-[11px] font-semibold text-[#0B6B5A]">Present today</div><div className="font-heading text-2xl font-extrabold text-[#0B6B5A]">96%</div></div>
                  <div className="rounded-2xl bg-[#FFF6E3] p-3.5"><div className="text-[11px] font-semibold text-[#7A5300]">Fees collected</div><div className="font-heading text-2xl font-extrabold text-[#7A5300]">71%</div></div>
                </div>
                <div className="px-5 pb-5">
                  <div className="mb-2.5 text-xs font-bold text-brand-navy">Fee collection this term</div>
                  <div className="flex h-[110px] items-end gap-2.5">
                    {[35, 52, 46, 68, 80, 94].map((h, i) => (
                      <div key={i} className="flex-1 rounded-t-lg" style={{ height: `${h}%`, background: i === 5 ? "#0F9D8A" : "#D6E2F1" }} />
                    ))}
                  </div>
                  <div className="mt-1.5 flex justify-between text-[11px] text-[#4A5A70]">{[1, 2, 3, 4, 5, 6].map((w) => <span key={w}>Wk {w}</span>)}</div>
                </div>
              </div>
              <div className="absolute bottom-0 left-0 flex items-center gap-3 rounded-2xl border border-[#E3EAF3] bg-white px-4 py-3.5 shadow-[0_18px_40px_-12px_rgba(15,42,82,0.3)] sm:-left-7">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E7F6F2]">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0B7D6E" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></svg>
                </div>
                <div><div className="text-[13px] font-bold text-brand-navy">₦85,000 fee received</div><div className="text-xs text-[#4A5A70]">Tolu A. · JSS 2</div></div>
              </div>
              <div className="absolute right-0 top-0 w-[210px] rounded-2xl bg-[#0F2A52] px-4 py-3.5 text-white shadow-[0_18px_40px_-12px_rgba(15,42,82,0.4)] sm:-right-4">
                <div className="text-[11px] font-bold tracking-[0.06em] text-[#F4B740]">RESULT RELEASED</div>
                <div className="mt-1 text-[13px] font-semibold">First Term report cards sent to 588 parents</div>
              </div>
            </div>
          </div>
        </section>

        {/* Modules strip */}
        <section aria-labelledby="modules-h" className="border-y border-[#E3EAF3] bg-white py-10">
          <div className="mx-auto max-w-[1200px] px-4 text-center sm:px-6">
            <h2 id="modules-h" className="!font-sans text-sm !font-extrabold uppercase tracking-[0.12em] !text-[#4A5A70]">Everything your school runs on</h2>
            <ul className="mt-5 flex flex-wrap justify-center gap-2.5">
              {MODULES.map((m) => (
                <li key={m} className="rounded-full border border-[#DCE5F0] bg-brand-cloud px-4 py-2 text-sm font-semibold text-brand-navy">{m}</li>
              ))}
            </ul>
          </div>
        </section>

        {/* Portals */}
        <section id="portals" aria-labelledby="portals-h" className="scroll-mt-20 bg-brand-navy py-20">
          <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
            <div className="mb-10 text-center">
              <Eyebrow light>One platform, a portal for everyone</Eyebrow>
              <h2 id="portals-h" className="mt-3 text-3xl !text-white md:text-[44px] md:leading-tight">Everyone in your school gets the view they need</h2>
            </div>
            <PortalTabs />
          </div>
        </section>

        {/* Features */}
        <section id="features" aria-labelledby="features-h" className="scroll-mt-20 bg-brand-cloud py-20">
          <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
            <div className="mb-10 max-w-2xl">
              <Eyebrow>Built for how schools really work</Eyebrow>
              <h2 id="features-h" className="mt-3 text-3xl md:text-[44px] md:leading-tight">Less paperwork. More teaching.</h2>
            </div>
            <div className="grid gap-5 md:grid-cols-3">
              <Feature wide dark title="Results and report cards in minutes" body="Teachers enter CA and exam scores; totals, grades, positions and class averages calculate themselves. The principal approves, then branded report cards go to every parent at once." />
              <Feature title="Fees on Paystack" body="Invoices, part payments, receipts and debtor lists, matched automatically and paid into your school's bank account." />
              <Feature title="CBT exams" body="Timed computer-based tests with question banks, shuffling and instant marking." />
              <Feature title="Works when the network doesn't" body="Take attendance and enter scores offline; they sync the moment you're back online." />
              <Feature title="Lesson notes and staff clock-in" body="Teachers submit notes for the principal to approve, and the principal clocks staff in and out each day." />
              <Feature wide title="Your own school website, included" body="A clean, mobile-ready site at yourschool.simpliskool.com, with news, gallery and online admission forms that land straight in your admin portal." />
              <Feature title="Multi-branch groups" body="Proprietors compare every branch's fees, attendance and results from one dashboard." />
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" aria-labelledby="how-h" className="scroll-mt-20 bg-white py-20">
          <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
            <div className="mb-10 text-center">
              <Eyebrow>How it works</Eyebrow>
              <h2 id="how-h" className="mt-3 text-3xl md:text-[44px] md:leading-tight">Live in one week, not one term</h2>
            </div>
            <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((s, i) => (
                <li key={s.t} className="rounded-3xl border border-[#E3EAF3] bg-brand-cloud p-6">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-navy font-heading text-lg font-extrabold text-white">{i + 1}</span>
                  <h3 className="mt-4 text-xl">{s.t}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-[#4A5A70]">{s.d}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" aria-labelledby="pricing-h" className="scroll-mt-20 bg-brand-cloud py-20">
          <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
            <div className="mb-10 text-center">
              <Eyebrow>Simple pricing</Eyebrow>
              <h2 id="pricing-h" className="mt-3 text-3xl md:text-[44px] md:leading-tight">Pay per student, per term</h2>
              <p className="mx-auto mt-4 max-w-xl text-lg text-[#4A5A70]">Pilot schools use Simpliskool free during the pilot. Prices for everyone else will be announced soon.</p>
            </div>
            <div className="grid gap-5 md:grid-cols-3">
              {PLANS.map((p) => (
                <div key={p.name} className={`flex flex-col rounded-3xl bg-white p-7 ${p.popular ? "border-2 border-brand-teal-dark shadow-[0_24px_48px_-24px_rgba(15,42,82,0.3)]" : "border border-[#E3EAF3]"}`}>
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-2xl">{p.name}</h3>
                    {p.popular && <span className="rounded-full bg-[#E7F6F2] px-3 py-1 text-xs font-extrabold text-[#0B6B5A]">Most popular</span>}
                  </div>
                  <p className="mt-1 text-[15px] text-[#4A5A70]">{p.for}</p>
                  <p className="mt-5 font-heading text-[28px] font-extrabold text-brand-navy">Free in the pilot</p>
                  <ul className="mt-5 flex-1 space-y-3">
                    {p.items.map((i) => (
                      <li key={i} className="flex items-start gap-2.5 text-[15px]"><Check className="mt-0.5" />{i}</li>
                    ))}
                  </ul>
                  <a href="#pilot" className={`mt-7 ${p.popular ? "sk-btn" : "sk-btn-outline min-h-[48px] text-base"}`}>Join the pilot</a>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" aria-labelledby="faq-h" className="scroll-mt-20 bg-white py-20">
          <div className="mx-auto max-w-[820px] px-4 sm:px-6">
            <h2 id="faq-h" className="text-center text-3xl md:text-[44px] md:leading-tight">Questions schools ask us</h2>
            <div className="mt-10 space-y-3">
              {FAQS.map((f, i) => (
                <details key={f.q} className="group rounded-2xl border border-[#E3EAF3] bg-brand-cloud" open={i === 0}>
                  <summary className="flex min-h-[60px] cursor-pointer list-none items-center justify-between gap-4 px-6 py-4 text-[17px] font-bold text-brand-navy [&::-webkit-details-marker]:hidden">
                    {f.q}
                    <span aria-hidden="true" className="text-2xl text-brand-teal-dark group-open:hidden">+</span>
                    <span aria-hidden="true" className="hidden text-2xl text-brand-teal-dark group-open:inline">−</span>
                  </summary>
                  <p className="px-6 pb-5 text-base leading-relaxed text-brand-slate">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Pilot CTA */}
        <section id="pilot" aria-labelledby="pilot-h" className="scroll-mt-20 bg-white pb-20">
          <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
            <div className="relative overflow-hidden rounded-[32px] bg-brand-navy px-7 py-12 md:px-14 md:py-16">
              <Image src="/simpliskool-icon.png" alt="" width={192} height={192} className="pointer-events-none absolute -bottom-10 -right-8 h-64 w-64 opacity-10" />
              <div className="relative grid items-center gap-8 lg:grid-cols-[1.4fr_1fr]">
                <div>
                  <Eyebrow light>Pilot programme · Lagos and its environs</Eyebrow>
                  <h2 id="pilot-h" className="mt-3 text-3xl !text-white md:text-[44px] md:leading-tight">Be one of our first pilot schools</h2>
                  <p className="mt-4 max-w-xl text-lg leading-relaxed text-[#DCE5F0]">Pilot schools get free setup, staff training and free use during the pilot. We&apos;ll move your existing records in for you.</p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                  <a href={DEMO} className="inline-flex min-h-[52px] items-center justify-center rounded-full bg-brand-teal px-7 text-base font-extrabold text-[#0A1F3D] hover:bg-[#3FD1B4]">Book a free demo</a>
                  {WHATSAPP && (
                    <a href={`https://wa.me/${WHATSAPP}`} className="inline-flex min-h-[52px] items-center justify-center rounded-full border-[1.5px] border-white/60 px-7 text-base font-bold text-white hover:bg-white/10">Chat on WhatsApp</a>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#E3EAF3] bg-brand-cloud">
        <div className="mx-auto flex max-w-[1200px] flex-wrap justify-between gap-10 px-4 py-12 sm:px-6">
          <div className="max-w-xs">
            <Image src="/simpliskool-logo-dark.png" alt="Simpliskool" width={143} height={32} className="h-8 w-auto" />
            <p className="mt-4 text-[15px] leading-relaxed text-[#4A5A70]">Simplifying school management. A product of Dream Savvy Solutions, Lagos.</p>
          </div>
          <div className="flex gap-16 text-[15px]">
            <div className="flex flex-col gap-2.5">
              <strong className="text-brand-navy">Product</strong>
              <a href="#features" className="text-brand-slate hover:text-brand-teal-dark">Features</a>
              <a href="#portals" className="text-brand-slate hover:text-brand-teal-dark">Portals</a>
              <a href="#pricing" className="text-brand-slate hover:text-brand-teal-dark">Pricing</a>
            </div>
            <div className="flex flex-col gap-2.5">
              <strong className="text-brand-navy">Company</strong>
              <a href="mailto:enquiries@simpliskool.com" className="text-brand-slate hover:text-brand-teal-dark">enquiries@simpliskool.com</a>
              <a href="#faq" className="text-brand-slate hover:text-brand-teal-dark">FAQ</a>
              <Link href="/login" className="text-brand-slate hover:text-brand-teal-dark">Sign in</Link>
            </div>
          </div>
        </div>
        <div className="mx-auto max-w-[1200px] border-t border-[#E3EAF3] px-4 py-6 text-sm text-[#4A5A70] sm:px-6">© {new Date().getFullYear()} Dream Savvy Solutions. All rights reserved.</div>
      </footer>
    </div>
  );
}

function Feature({ title, body, wide = false, dark = false }: { title: string; body: string; wide?: boolean; dark?: boolean }) {
  return (
    <div className={`rounded-3xl p-7 ${wide ? "md:col-span-2" : ""} ${dark ? "bg-brand-navy" : "border border-[#E3EAF3] bg-white"}`}>
      <span aria-hidden="true" className={`block h-3 w-3 rounded-full ${dark ? "bg-[#F4B740]" : "bg-brand-teal"}`} />
      <h3 className={`mt-5 text-2xl ${dark ? "!text-white" : ""}`}>{title}</h3>
      <p className={`mt-3 text-base leading-relaxed ${dark ? "text-[#DCE5F0]" : "text-[#4A5A70]"}`}>{body}</p>
    </div>
  );
}
