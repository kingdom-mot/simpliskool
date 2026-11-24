import Image from "next/image";
import Link from "next/link";
import { PortalTabs } from "./PortalTabs";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";
import { WhatsAppFloat } from "@/components/WhatsAppFloat";
import { ENQUIRIES_EMAIL, whatsapp } from "@/lib/contact";

const DEMO = `mailto:${ENQUIRIES_EMAIL}?subject=Simpliskool%20demo%20request`;
const CHAT = whatsapp("Hello Simpliskool, I'd like to join the pilot.");

const MODULES = [
  "Admissions",
  "Student records",
  "Attendance",
  "Results & report cards",
  "Fee payments",
  "CBT exams",
  "Lesson notes",
  "Homework",
  "Timetables",
  "Staff clock-in",
  "Payroll",
  "School website",
  "AI assistant",
  "Multi-branch",
];

const HERO_POINTS = [
  {
    t: "Works on any phone",
    icon: "M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM11 18h2",
    tint: "bg-[#E8F0FB] text-brand-navy",
  },
  {
    t: "Fees paid online",
    icon: "M2 5h20v14H2zM2 10h20M6 15h4",
    tint: "bg-[#E2F5F1] text-[#07665A]",
  },
  {
    t: "Keeps working offline",
    icon: "M5 12.6a10.9 10.9 0 0 1 14 0M8.5 16.1a5 5 0 0 1 7 0M12 20h.01M1.4 9a16 16 0 0 1 21.2 0",
    tint: "bg-[#FFF1D6] text-[#8A5A00]",
  },
  {
    t: "Data protected",
    icon: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4",
    tint: "bg-[#FDE9E4] text-[#A2391F]",
  },
];

const PEOPLE = [
  {
    img: "/landing/principal.jpg",
    label: "Admin & proprietor",
    chip: "bg-[#E8F0FB] text-brand-navy",
    t: "See the whole school at a glance",
    d: "Set up sessions, classes and staff once. Then watch fees, attendance and results update in real time.",
    pts: [
      "Admissions and student records",
      "Fees, payments and defaulter lists",
      "Approve and release results",
    ],
  },
  {
    img: "/landing/teacher.jpg",
    label: "Teachers",
    chip: "bg-[#E2F5F1] text-[#07665A]",
    t: "Classroom overview",
    d: "Mark attendance in seconds, enter scores once, and the AI assistant helps with notes and comments.",
    pts: [
      "Attendance that works offline",
      "Score entry with automatic grading",
      "Lesson notes, homework and CBT",
    ],
  },
  {
    img: "/landing/parent.jpg",
    label: "Parents",
    chip: "bg-[#FDE9E4] text-[#A2391F]",
    t: "Parents stay in the loop",
    d: "One login for all their children. Results, fees, attendance and school news, right on their phone.",
    pts: [
      "Pay fees online, download receipts",
      "View and download report cards",
      "Attendance and homework updates",
    ],
  },
  {
    img: "/landing/teacher-students.jpg",
    label: "Students",
    chip: "bg-[#FFF1D6] text-[#8A5A00]",
    t: "Everything a student needs",
    d: "Timetable, homework, lesson notes and CBT practice in one simple space. Younger pupils sign in with a PIN.",
    pts: ["Today's timetable", "Homework and tests", "Results when released"],
  },
];

const MORE = [
  {
    t: "CBT exams",
    d: "Timed computer-based tests with question banks, shuffling and instant marking.",
    icon: "M3 4h18v12H3zM8 20h8M12 16v4",
    tint: "bg-[#E8F0FB] text-brand-navy",
  },
  {
    t: "Works when network is unavailable",
    d: "Take attendance and enter scores offline; they sync the moment you're back online.",
    icon: "M5 12.6a10.9 10.9 0 0 1 14 0M8.5 16.1a5 5 0 0 1 7 0M12 20h.01M1.4 9a16 16 0 0 1 21.2 0",
    tint: "bg-[#E2F5F1] text-[#07665A]",
  },
  {
    t: "Lesson notes and staff clock-in",
    d: "Teachers submit notes for the principal to approve, and the principal clocks staff in and out each day.",
    icon: "M12 6v6l4 2M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z",
    tint: "bg-[#FFF1D6] text-[#8A5A00]",
  },
  {
    t: "Your own school website, included",
    d: "A clean, mobile-ready site at yourschool.simpliskool.com, with news, gallery and online admission forms that land straight in your admin portal.",
    icon: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20",
    tint: "bg-[#FDE9E4] text-[#A2391F]",
  },
  {
    t: "Multi-branch groups",
    d: "Proprietors monitor every branch's fees, attendance and results from one dashboard.",
    icon: "M6 3v12M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 9a9 9 0 0 1-9 9",
    tint: "bg-[#E8F0FB] text-brand-navy",
  },
  {
    t: "AI teaching assistant",
    d: "Helps teachers draft lesson notes and report card comments, ready for them to check and edit.",
    icon: "M12 3l1.9 5.8H20l-4.9 3.6 1.9 5.8L12 14.6l-5 3.6 1.9-5.8L4 8.8h6.1z",
    tint: "bg-[#E2F5F1] text-[#07665A]",
  },
];

const PARTNER = [
  {
    t: "We set you up",
    d: "Sessions, classes, subjects and fees configured, and your records imported. Send us your Excel lists and our team moves them in.",
    pts: [
      "Student and parent lists imported",
      "Classes, subjects and fees ready",
      "Your school website set up",
    ],
    icon: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5",
    bg: "bg-[#E2F5F1]",
    ic: "bg-brand-teal-dark",
  },
  {
    t: "We train your staff",
    d: "A short hands-on session for admins and teachers, in person or online, on the phones and laptops they already use.",
    pts: [
      "In person or online",
      "Any smartphone, tablet or laptop",
      "Help guides for every role",
    ],
    icon: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8",
    bg: "bg-[#E8F0FB]",
    ic: "bg-brand-navy",
  },
  {
    t: "Your data stays yours",
    d: "Each school's data is kept separate, encrypted and backed up daily, in line with the Nigeria Data Protection Act 2023.",
    pts: [
      "Role-based access for every user",
      "We never sell your data",
      "Export or delete it any time",
    ],
    icon: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4",
    bg: "bg-[#FFF1D6]",
    ic: "bg-[#8A5A00]",
  },
];

const STEPS = [
  {
    t: "Book a demo",
    d: "We walk you through Simpliskool using your school's real setup.",
  },
  {
    t: "We set you up",
    d: "Sessions, classes, subjects and fees configured, and your records imported.",
  },
  {
    t: "Train your staff",
    d: "A short hands-on session for admins and teachers, in person or online.",
  },
  { t: "Go live", d: "Website is officially launched and ready to use." },
];

const FAQS = [
  {
    q: "Do we need computers or special equipment?",
    a: "No. Simpliskool runs in the browser on any smartphone, tablet or laptop. Teachers can take attendance offline and it syncs later.",
  },
  {
    q: "Can you move our existing student records in?",
    a: "Yes. Upload your student and parent lists from Excel, or send them to us and our team will import them during setup.",
  },
  {
    q: "How do parents pay fees?",
    a: "Parents pay by card, bank transfer or USSD. Each payment is matched to the right invoice, receipts are issued instantly, and the money is paid into the school's bank account.",
  },
  {
    q: "How do young pupils sign in without a phone?",
    a: "Older students and parents sign in with a code sent to their phone or email. Younger pupils sign in with their admission number and a PIN printed on a login slip by the school.",
  },
  {
    q: "Is our school data safe?",
    a: "Each school's data is kept separate and protected with role-based access, so teachers, parents and students only see what they should. Data is encrypted and backed up daily. We handle personal data in line with the Nigeria Data Protection Act 2023: your school owns its data, we only use it to run Simpliskool, we never sell it, and you can export or delete it at any time.",
  },
  {
    q: "We have more than one campus. Does that work?",
    a: "Yes. The group dashboard lets proprietors see every branch together while each branch runs its own day-to-day.",
  },
];

const ARROW = "M5 12h14M13 6l6 6-6 6";

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

function Tick() {
  return (
    <span className="mt-0.5 flex-none text-[#07665A]">
      <Glyph d="M20 6 9 17l-5-5" size={18} />
    </span>
  );
}

function Head({
  id,
  kicker,
  title,
  intro,
  center = true,
}: {
  id: string;
  kicker: string;
  title: React.ReactNode;
  intro?: string;
  center?: boolean;
}) {
  return (
    <div
      className={`mb-12 flex flex-col gap-3 ${center ? "items-center text-center" : ""}`}
    >
      <p className="text-[14px] font-bold uppercase tracking-[0.1em] text-brand-teal-dark">
        {kicker}
      </p>
      <h2
        id={id}
        className="max-w-3xl text-[30px] font-extrabold leading-[1.12] tracking-[-0.02em] md:text-[40px]"
      >
        {title}
      </h2>
      {intro && (
        <p className="max-w-2xl text-lg leading-relaxed text-[#4A5A70]">
          {intro}
        </p>
      )}
    </div>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <a href="#main" className="sk-skip">
        Skip to main content
      </a>

      <aside
        aria-label="Announcement"
        className="bg-[#FFD979] px-4 py-2.5 text-center text-sm font-semibold text-[#3A2A00]"
      >
        Now onboarding pilot schools in Lagos and its environs.{" "}
        <a
          href="#pilot"
          className="font-extrabold underline underline-offset-2"
        >
          Join the pilot →
        </a>
      </aside>

      <SiteHeader />

      <main id="main">
        {/* Hero: the school photo fills the background, washed light behind the words. */}
        <section className="relative isolate overflow-hidden bg-[#FFFCF6]">
          <Image
            src="/landing/hero.jpg"
            alt=""
            fill
            priority
            sizes="100vw"
            className="-z-20 hidden object-cover object-[center_68%] md:block"
          />
          {/* Phones: the whole scene along the bottom, fading up into the words. */}
          <Image
            src="/landing/hero.jpg"
            alt=""
            width={1672}
            height={941}
            priority
            sizes="100vw"
            className="absolute bottom-0 left-0 -z-20 h-auto w-full md:hidden"
          />
          <div
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 -z-10 aspect-[1672/941] bg-gradient-to-b from-[#FFFCF6] via-[#FFFCF6]/10 to-transparent md:hidden"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 hidden md:block bg-[linear-gradient(180deg,rgba(255,252,246,0.97)_0%,rgba(255,252,246,0.93)_38%,rgba(255,252,246,0.72)_62%,rgba(255,252,246,0.15)_88%,rgba(255,252,246,0)_100%)]"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 hidden md:block bg-[radial-gradient(ellipse_60%_55%_at_50%_38%,rgba(255,252,246,0.85),transparent_70%)]"
          />
          <div className="mx-auto flex max-w-[1240px] flex-col items-center px-4 pb-[62vw] pt-12 text-center sm:px-6 md:min-h-[820px] md:pb-72 md:pt-24">
            <div className="flex max-w-[900px] flex-col items-center gap-6">
              <span className="inline-flex items-center gap-2 rounded-full border border-[#F1E3C8] bg-white py-1.5 pl-1.5 pr-4 text-[13px] font-semibold text-brand-navy shadow-sm">
                <span className="rounded-full bg-brand-teal-dark px-2.5 py-0.5 text-xs font-extrabold text-white">
                  NEW
                </span>
                Lesson notes approved by the principal, shared with the class
              </span>
              <h1 className="text-[44px] font-extrabold leading-[1.02] tracking-[-0.035em] md:text-[64px]">
                Run your whole school from{" "}
                <span className="text-[#07665A]">one simple place.</span>
              </h1>
              <p className="max-w-[660px] text-lg font-medium leading-relaxed text-brand-slate md:text-[20px]">
                Admissions, attendance, results, fees, computer-based exams and
                parent updates, connected in one platform. Built for schools in
                Africa.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <a
                  href={DEMO}
                  className="inline-flex min-h-[56px] items-center gap-2 rounded-full bg-brand-teal-dark px-8 text-base font-bold text-white shadow-[0_14px_30px_-12px_rgba(11,125,110,0.8)] hover:bg-[#096A5D]"
                >
                  Book a free demo <Glyph d={ARROW} size={18} />
                </a>
                <Link
                  href="/demo"
                  className="inline-flex min-h-[56px] items-center gap-2.5 rounded-full border border-[#DCE5F0] bg-white px-7 text-base font-bold text-brand-navy shadow-sm hover:border-brand-navy"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-navy text-white">
                    <svg
                      aria-hidden="true"
                      width="11"
                      height="11"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M6 4l14 8-14 8z" />
                    </svg>
                  </span>
                  Try the live demo
                </Link>
              </div>
              <ul className="mt-1 grid grid-cols-2 gap-x-6 gap-y-3 text-left sm:flex sm:flex-wrap sm:justify-center">
                {HERO_POINTS.map((p) => (
                  <li
                    key={p.t}
                    className="flex items-center gap-2.5 rounded-full bg-white/85 py-1 pl-1 pr-3.5 text-[14px] font-bold text-brand-slate shadow-sm backdrop-blur"
                  >
                    <span
                      className={`flex h-8 w-8 flex-none items-center justify-center rounded-full ${p.tint}`}
                    >
                      <Glyph d={p.icon} size={16} />
                    </span>
                    {p.t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Modules */}
        <section aria-labelledby="modules-h" className="bg-white py-14">
          <div className="mx-auto max-w-[1240px] px-4 text-center sm:px-6">
            <h2
              id="modules-h"
              className="!font-sans text-[14px] !font-bold uppercase tracking-[0.1em] !text-[#4A5A70]"
            >
              Everything your school runs on
            </h2>
            <ul className="mx-auto mt-6 flex max-w-[1000px] flex-wrap justify-center gap-2.5">
              {MODULES.map((m) => (
                <li
                  key={m}
                  className="rounded-full border border-[#E3EAF3] bg-white px-4 py-2 text-[15px] font-semibold text-brand-navy"
                >
                  {m}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* People */}
        <section
          id="people"
          aria-labelledby="people-h"
          className="scroll-mt-20 bg-white pb-24 pt-6"
        >
          <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
            <Head
              id="people-h"
              kicker="One platform, a portal for everyone"
              title="Built for every person in your school"
              intro="Each person signs in to their own simple view, on the phone or laptop they already have."
            />
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {PEOPLE.map((p) => (
                <li
                  key={p.label}
                  className="flex flex-col overflow-hidden rounded-[24px] border border-[#ECEFF4] bg-white"
                >
                  <Image
                    src={p.img}
                    alt=""
                    width={500}
                    height={500}
                    sizes="(max-width: 640px) 100vw, 300px"
                    className="aspect-[5/4] w-full object-cover"
                  />
                  <div className="flex flex-1 flex-col p-6">
                    <span
                      className={`self-start rounded-full px-3 py-1 text-[13px] font-bold ${p.chip}`}
                    >
                      {p.label}
                    </span>
                    <h3 className="mt-4 text-[21px] leading-snug">{p.t}</h3>
                    <p className="mt-2 text-[15px] leading-relaxed text-[#4A5A70]">
                      {p.d}
                    </p>
                    <ul className="mt-4 flex-1 space-y-2">
                      {p.pts.map((x) => (
                        <li
                          key={x}
                          className="flex items-start gap-2 text-[14px] font-semibold text-brand-slate"
                        >
                          <Tick />
                          {x}
                        </li>
                      ))}
                    </ul>
                    <Link
                      href="/demo"
                      className="mt-5 inline-flex min-h-[44px] items-center gap-1.5 self-start text-[15px] font-bold text-brand-teal-dark hover:gap-2.5"
                    >
                      Try it in the demo{" "}
                      <span className="sr-only">
                        as {p.label.toLowerCase()}
                      </span>
                      <Glyph d={ARROW} size={16} />
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Portals */}
        <section
          id="portals"
          aria-labelledby="portals-h"
          className="scroll-mt-20 bg-[#F1F8F6] py-24"
        >
          <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
            <Head
              id="portals-h"
              kicker="See it for yourself"
              title="Everyone in your school gets the view they need"
            />
            <PortalTabs />
          </div>
        </section>

        {/* Features */}
        <section
          id="features"
          aria-labelledby="features-h"
          className="scroll-mt-20 bg-white py-24"
        >
          <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
            <Head
              id="features-h"
              kicker="Built for how schools really work"
              title="Less paperwork. More teaching."
            />
            <div className="flex flex-col gap-8">
              <Split
                img="/landing/admin.jpg"
                alt="A school administrator smiling as she works on a laptop in the school office"
                tint="bg-[#E8F0FB]"
                kicker="Results"
                title="Results and report cards in minutes"
                body="Teachers enter CA and exam scores; totals, grades, positions and class averages calculate themselves. Upon approval, branded report cards are released to parents at once."
                pts={[
                  "Automatic totals, grades and positions",
                  "Principal approves before release",
                  "Parents view and download on their phone",
                ]}
              />
              <Split
                flip
                img="/landing/bursar.jpg"
                alt="A school bursar checking payment records at her desk with a calculator"
                tint="bg-[#FFF1D6]"
                kicker="Fees"
                title="Online fee payments"
                body="Invoices, part payments, receipts and defaulter lists, matched automatically and paid into your school's bank account. Parents pay by card, bank transfer or USSD."
                pts={[
                  "Each payment matched to the right invoice",
                  "Receipts issued instantly",
                  "Defaulter lists that update themselves",
                ]}
              />
            </div>
            <ul className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {MORE.map((m) => (
                <li
                  key={m.t}
                  className="rounded-[22px] border border-[#ECEFF4] bg-white p-7"
                >
                  <span
                    className={`flex h-12 w-12 items-center justify-center rounded-2xl ${m.tint}`}
                  >
                    <Glyph d={m.icon} />
                  </span>
                  <h3 className="mt-5 text-[20px] leading-snug">{m.t}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-[#4A5A70]">
                    {m.d}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Partnership */}
        <section aria-labelledby="partner-h" className="bg-[#FAFBFD] py-24">
          <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
            <Head
              id="partner-h"
              kicker="More than software"
              title="We set you up, train your team and stay with you."
              intro="Pilot schools get free setup, staff training and free use during the pilot. We'll move your existing records in for you."
            />
            <ul className="grid gap-5 lg:grid-cols-3">
              {PARTNER.map((p) => (
                <li
                  key={p.t}
                  className={`flex flex-col rounded-[26px] p-8 ${p.bg}`}
                >
                  <span
                    className={`flex h-14 w-14 items-center justify-center rounded-2xl text-white ${p.ic}`}
                  >
                    <Glyph d={p.icon} size={26} />
                  </span>
                  <h3 className="mt-6 text-[24px]">{p.t}</h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-brand-slate">
                    {p.d}
                  </p>
                  <ul className="mt-5 space-y-2.5 border-t border-black/10 pt-5">
                    {p.pts.map((x) => (
                      <li
                        key={x}
                        className="flex items-start gap-2 text-[15px] font-semibold text-brand-slate"
                      >
                        <Tick />
                        {x}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Live demo */}
        <section
          id="demo"
          aria-labelledby="demo-h"
          className="scroll-mt-20 bg-white py-24"
        >
          <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
            <div className="grid overflow-hidden rounded-[32px] bg-[#FFD979] lg:grid-cols-2">
              <div className="p-8 md:p-12">
                <p className="text-[14px] font-bold uppercase tracking-[0.1em] text-[#5C4300]">
                  Live demo
                </p>
                <h2
                  id="demo-h"
                  className="mt-3 text-[30px] font-extrabold leading-[1.12] tracking-[-0.02em] md:text-[40px]"
                >
                  Try it now. No sign-up.
                </h2>
                <p className="mt-4 text-lg leading-relaxed text-[#3A2A00]">
                  Bright Future Academy is a made-up school in Lekki, Lagos.
                  Pick a role and click around. Nothing is real and everything
                  resets every night.
                </p>
                <ul className="mt-6 flex flex-wrap gap-2">
                  {["Admin & proprietor", "Teacher", "Parent", "Student"].map(
                    (r) => (
                      <li
                        key={r}
                        className="rounded-full bg-white/70 px-3.5 py-1.5 text-[14px] font-bold text-brand-navy"
                      >
                        {r}
                      </li>
                    ),
                  )}
                </ul>
                <Link
                  href="/demo"
                  className="mt-8 inline-flex min-h-[54px] items-center gap-2 rounded-full bg-brand-navy px-7 text-base font-bold text-white hover:bg-brand-navy-dark"
                >
                  Open the live demo <Glyph d={ARROW} size={18} />
                </Link>
              </div>
              <div className="relative min-h-[300px]">
                <Image
                  src="/landing/teacher-students.jpg"
                  alt="A teacher leaning in to help smiling students working on a tablet in class"
                  fill
                  sizes="(max-width: 1024px) 100vw, 600px"
                  className="object-cover"
                />
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section
          id="how"
          aria-labelledby="how-h"
          className="scroll-mt-20 bg-white pb-24"
        >
          <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
            <Head
              id="how-h"
              kicker="How it works"
              title="Live in one week, not one term"
            />
            <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((s, i) => (
                <li
                  key={s.t}
                  className="rounded-[22px] border border-[#ECEFF4] bg-white p-7"
                >
                  <span
                    aria-hidden="true"
                    className="font-heading text-[44px] font-extrabold leading-none text-brand-teal"
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-4 text-[20px]">{s.t}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-[#4A5A70]">
                    {s.d}
                  </p>
                </li>
              ))}
            </ol>
            <div className="mt-10 flex justify-center">
              <a
                href={DEMO}
                className="inline-flex min-h-[52px] items-center gap-2 rounded-full bg-brand-teal-dark px-7 text-base font-bold text-white hover:bg-[#096A5D]"
              >
                Talk to our team <Glyph d={ARROW} size={18} />
              </a>
            </div>
          </div>
        </section>

        {/* Pilot */}
        <section
          id="pilot"
          aria-labelledby="pilot-h"
          className="scroll-mt-20 bg-white py-24"
        >
          <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
            <div className="grid overflow-hidden rounded-[28px] bg-[#07665A] lg:grid-cols-[1.75fr_1fr]">
              <div className="p-7 md:p-10">
                <p className="text-[13px] font-bold uppercase tracking-[0.1em] text-white">
                  Pilot program · Lagos and its environs
                </p>
                <h2
                  id="pilot-h"
                  className="mt-3 text-[26px] font-extrabold leading-[1.15] !text-white md:text-[34px]"
                >
                  Be one of our first pilot schools
                </h2>
                <p className="mt-3 max-w-xl text-[16px] leading-relaxed text-[#E2F5F1]">
                  Pilot schools get free setup, staff training and free use
                  during the pilot. We&apos;ll move your existing records in for
                  you.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <a
                    href={DEMO}
                    className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-[#FFD979] px-6 text-[15px] font-extrabold text-[#3A2A00] hover:bg-[#FFCE57]"
                  >
                    Book a free demo
                  </a>
                  <a
                    href={CHAT}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[48px] items-center justify-center rounded-full border-[1.5px] border-white/70 px-6 text-[15px] font-bold text-white hover:bg-white/10"
                  >
                    Chat on WhatsApp
                  </a>
                </div>
                <dl className="mt-8 grid grid-cols-2 gap-5 border-t border-white/20 pt-6 sm:grid-cols-4">
                  {[
                    [String(MODULES.length), "modules"],
                    ["4", "portals"],
                    ["1 week", "to go live"],
                    ["Offline", "registers and scores"],
                  ].map(([n, l]) => (
                    <div key={l}>
                      <dt className="sr-only">{l}</dt>
                      <dd>
                        <span className="block font-heading text-[22px] font-extrabold leading-none text-white">
                          {n}
                        </span>
                        <span className="mt-1.5 block text-sm text-[#E2F5F1]">
                          {l}
                        </span>
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div className="relative min-h-[220px] lg:min-h-0">
                <Image
                  src="/landing/parent.jpg"
                  alt="A father and his son smiling at a phone together"
                  fill
                  sizes="(max-width: 1024px) 100vw, 520px"
                  className="object-cover"
                />
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section
          id="faq"
          aria-labelledby="faq-h"
          className="scroll-mt-20 bg-white pb-24"
        >
          <div className="mx-auto grid max-w-[1240px] gap-10 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
            <div className="lg:sticky lg:top-28 lg:self-start">
              <Head
                id="faq-h"
                center={false}
                kicker="FAQ"
                title="Questions schools ask us"
              />
              <p className="-mt-6 text-lg leading-relaxed text-[#4A5A70]">
                Something else on your mind?{" "}
                <a
                  href={`mailto:${ENQUIRIES_EMAIL}`}
                  className="font-bold text-brand-teal-dark underline underline-offset-2"
                >
                  Email our team
                </a>
                .
              </p>
            </div>
            <div className="space-y-3">
              {FAQS.map((f, i) => (
                <details
                  key={f.q}
                  className="group rounded-2xl border border-[#E3EAF3] bg-white open:bg-[#F1F8F6]"
                  open={i === 0}
                >
                  <summary className="flex min-h-[64px] cursor-pointer list-none items-center justify-between gap-4 px-6 py-4 text-[17px] font-bold text-brand-navy [&::-webkit-details-marker]:hidden">
                    {f.q}
                    <span
                      aria-hidden="true"
                      className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-white text-xl text-brand-teal-dark ring-1 ring-[#E3EAF3] transition-transform group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <p className="px-6 pb-5 text-base leading-relaxed text-brand-slate">
                    {f.a}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />

      <WhatsAppFloat />
    </div>
  );
}

function Split({
  img,
  alt,
  tint,
  kicker,
  title,
  body,
  pts,
  flip = false,
}: {
  img: string;
  alt: string;
  tint: string;
  kicker: string;
  title: string;
  body: string;
  pts: string[];
  flip?: boolean;
}) {
  return (
    <div
      className={`grid overflow-hidden rounded-[30px] ${tint} lg:grid-cols-2`}
    >
      <div
        className={`relative min-h-[300px] lg:min-h-[440px] ${flip ? "lg:order-2" : ""}`}
      >
        <Image
          src={img}
          alt={alt}
          fill
          sizes="(max-width: 1024px) 100vw, 600px"
          className="object-cover"
        />
      </div>
      <div className="flex flex-col justify-center p-8 md:p-12">
        <p className="text-[14px] font-bold uppercase tracking-[0.1em] text-[#07665A]">
          {kicker}
        </p>
        <h3 className="mt-3 text-[26px] leading-tight md:text-[32px]">
          {title}
        </h3>
        <p className="mt-4 text-[17px] leading-relaxed text-brand-slate">{body}</p>
        <ul className="mt-6 space-y-3">
          {pts.map((x) => (
            <li
              key={x}
              className="flex items-start gap-2.5 text-base font-semibold text-brand-slate"
            >
              <Tick />
              {x}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
