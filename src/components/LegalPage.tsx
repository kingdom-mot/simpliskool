import { WhatsAppFloat } from "@/components/WhatsAppFloat";
import Image from "next/image";
import Link from "next/link";
import { COMPANY, DOCS, LEGAL_UPDATED } from "@/lib/legal";

export type LegalSection = { id: string; title: string; body: React.ReactNode };

/** Layout for the privacy policy, terms and data processing agreement: plain, printable, readable on a phone. */
export function LegalPage({ path, title, intro, sections }: { path: string; title: string; intro: React.ReactNode; sections: LegalSection[] }) {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-[#E3EAF3] bg-white print:hidden">
        <div className="mx-auto flex max-w-[920px] flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link href="/" aria-label="Simpliskool home">
            <Image src="/simpliskool-logo-dark.png" alt="Simpliskool" width={143} height={32} className="h-8 w-auto" />
          </Link>
          <nav aria-label="Legal documents" className="flex flex-wrap gap-x-5 gap-y-1 text-sm font-bold">
            {DOCS.map((d) => (
              <Link key={d.href} href={d.href} aria-current={d.href === path ? "page" : undefined} className={d.href === path ? "text-brand-navy underline underline-offset-4" : "text-brand-teal-dark hover:underline"}>
                {d.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-[920px] px-4 pb-16 pt-8 sm:px-6">
        <h1 className="text-[32px] leading-tight !text-brand-navy sm:text-[40px]">{title}</h1>
        <p className="mt-2 text-sm text-[#4A5A70]">
          Last updated {LEGAL_UPDATED} · {COMPANY}
        </p>
        <div className="legal mt-6 text-[16px] leading-relaxed text-[#263449]">{intro}</div>
        <nav aria-label="On this page" className="mt-8 rounded-2xl bg-brand-cloud p-5 print:hidden">
          <h2 className="text-base !text-brand-navy">On this page</h2>
          <ol className="mt-2 grid list-decimal gap-x-8 gap-y-1 pl-5 text-[15px] sm:grid-cols-2">
            {sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-brand-teal-dark hover:underline">
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        {sections.map((s, i) => (
          <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className="mt-10 scroll-mt-6">
            <h2 id={`${s.id}-h`} className="text-[22px] !text-brand-navy">
              {i + 1}. {s.title}
            </h2>
            <div className="legal mt-3 text-[16px] leading-relaxed text-[#263449]">{s.body}</div>
          </section>
        ))}
      </main>
      <footer className="border-t border-[#E3EAF3] bg-brand-cloud print:hidden">
        <div className="mx-auto flex max-w-[920px] flex-wrap justify-between gap-3 px-4 py-6 text-sm text-[#4A5A70] sm:px-6">
          <span>© {new Date().getFullYear()} {COMPANY}</span>
          <Link href="/login" className="font-bold text-brand-teal-dark hover:underline">
            Sign in
          </Link>
        </div>
      </footer>
      <WhatsAppFloat />
    </div>
  );
}
