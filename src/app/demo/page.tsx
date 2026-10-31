import Image from "next/image";
import Link from "next/link";
import { PERSONAS } from "@/lib/demo";
import { enterDemo } from "./actions";

export const metadata = {
  title: "Try the Simpliskool demo",
  description: "Explore Simpliskool as a school owner, proprietor, principal, bursar, teacher, parent or student, with a demo school full of made-up data.",
};

const ICON: Record<string, string> = {
  owner: "M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6",
  group: "M2 21h20M4 21V10l4-3 4 3v11M12 21V7l4-3 4 3v14",
  principal: "M12 3 2 8l10 5 10-5-10-5zM6 10v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5",
  bursar: "M2 6h20v12H2zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6",
  teacher: "M4 19.5V5a2 2 0 0 1 2-2h14v16H6.5A2.5 2.5 0 0 0 4 21.5M8 7h8M8 11h6",
  parent: "M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM11 18h2",
  student: "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
};
const TONE = ["#1D4ED8", "#0B7D6E", "#6D28D9", "#B45309", "#BE185D", "#15803D", "#0369A1"];

export default async function DemoPage(props: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await props.searchParams;
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "simpliskool.com";
  return (
    <main id="main" className="min-h-screen bg-brand-mist">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 md:py-12">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/" aria-label="Simpliskool home">
            <Image src="/simpliskool-logo-dark.png" alt="Simpliskool" width={180} height={40} priority />
          </Link>
          <Link href="/login" className="rounded-xl border-[1.5px] border-[#173B70] px-4 py-2.5 text-sm font-bold text-[#173B70] hover:bg-white">
            Sign in to your school
          </Link>
        </header>

        <section className="flex flex-col gap-3">
          <p className="text-sm font-extrabold uppercase tracking-[0.08em] text-[#0B6B5A]">Live demo</p>
          <h1 className="max-w-3xl text-[34px] font-black leading-tight text-[#173B70] md:text-[44px]">See Simpliskool through the eyes of everyone in a school</h1>
          <p className="max-w-3xl text-lg text-slate-700">
            Bright Future Academy is a made-up school in Lekki, Lagos, with a second branch in Ajah: 170 students, 14 teachers, fees, results, lesson notes and more. Pick a role and click around. Nothing is real and everything resets every night.
          </p>
        </section>

        {error && (
          <p role="alert" className="rounded-xl bg-[#FEF3F2] px-4 py-3 text-sm font-semibold text-[#912018]">
            {error === "setup" ? "The demo isn't set up yet. Please try again in a minute." : "We couldn't open the demo just now. Please try again."}
          </p>
        )}

        <ul className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PERSONAS.map((p, i) => (
            <li key={p.key}>
              <form action={enterDemo} className="h-full">
                <input type="hidden" name="persona" value={p.key} />
                <button className="group flex h-full w-full flex-col gap-3 rounded-[20px] border border-[#E3EAF3] bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#0B7D6E] hover:shadow-md">
                  <span className="flex items-center gap-3">
                    <span aria-hidden="true" className="flex h-11 w-11 flex-none items-center justify-center rounded-xl text-white" style={{ background: TONE[i % TONE.length] }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                        <path d={ICON[p.key]} />
                      </svg>
                    </span>
                    <span>
                      <span className="block text-lg font-extrabold text-[#173B70]">{p.role}</span>
                      <span className="block text-sm text-slate-600">{p.who}</span>
                    </span>
                  </span>
                  <span className="flex-1 text-[15px] leading-relaxed text-slate-700">{p.desc}</span>
                  <span className="text-sm font-extrabold text-[#0B6B5A] group-hover:underline">
                    Open as {p.role.split(" (")[0].toLowerCase()} →
                  </span>
                </button>
              </form>
            </li>
          ))}
          <li>
            <a href={`https://demo.${root}`} className="flex h-full flex-col gap-3 rounded-[20px] border border-dashed border-[#9FB3CC] bg-white/60 p-5 hover:border-[#0B7D6E]">
              <span className="text-lg font-extrabold text-[#173B70]">The school&apos;s own website</span>
              <span className="flex-1 text-[15px] leading-relaxed text-slate-700">Every school gets a website at its own address, with news and an online admissions form that goes straight into Simpliskool.</span>
              <span className="text-sm font-extrabold text-[#0B6B5A]">Visit demo.{root} →</span>
            </a>
          </li>
        </ul>

        <section aria-labelledby="note-h" className="rounded-[20px] bg-white p-5 text-sm text-slate-700">
          <h2 id="note-h" className="mb-1 text-base font-extrabold text-[#173B70]">About the demo</h2>
          <p>All names, numbers and records are made up. Emails, text messages and real payments are switched off, so feel free to mark registers, record payments or send announcements. Other visitors may be using the same demo at the same time, and it&apos;s reset to fresh data every night.</p>
          <p className="mt-2">
            Want Simpliskool for your school? <a className="font-bold text-[#0B6B5A] underline" href="mailto:hello@simpliskool.com?subject=Simpliskool%20for%20our%20school">Talk to us</a>.
          </p>
        </section>
      </div>
    </main>
  );
}
