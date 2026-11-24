import Image from "next/image";
import Link from "next/link";
import {
  ENQUIRIES_EMAIL,
  PRICING_CHAT,
  WHATSAPP_DISPLAY,
  whatsapp,
} from "@/lib/contact";

const DEMO = `mailto:${ENQUIRIES_EMAIL}?subject=Simpliskool%20demo%20request`;

/** The marketing site footer: contact details and four link columns. */
export function SiteFooter() {
  return (
    <footer className="border-t border-[#ECEFF4] bg-[#FAFBFD]">
      <div className="mx-auto grid max-w-[1240px] gap-12 px-4 pb-10 pt-16 sm:px-6 lg:grid-cols-[1.2fr_2fr]">
        <div className="max-w-sm">
          <Image
            src="/simpliskool-logo-dark.png"
            alt="Simpliskool"
            width={157}
            height={35}
            className="h-9 w-auto"
          />
          <p className="mt-5 text-[15px] leading-relaxed text-[#4A5A70]">
            Simplifying school management for schools across Africa. A product
            of Dream Savvy Solutions, Lagos.
          </p>
          <ul className="mt-6 space-y-3 text-[15px]">
            <li>
              <span className="block text-[13px] font-bold uppercase tracking-[0.08em] text-[#4A5A70]">
                Email
              </span>
              <a
                href={`mailto:${ENQUIRIES_EMAIL}`}
                className="font-bold text-brand-navy underline-offset-2 hover:text-brand-teal-dark hover:underline"
              >
                {ENQUIRIES_EMAIL}
              </a>
            </li>
            <li>
              <span className="block text-[13px] font-bold uppercase tracking-[0.08em] text-[#4A5A70]">
                WhatsApp
              </span>
              <a
                href={whatsapp()}
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-brand-navy underline-offset-2 hover:text-brand-teal-dark hover:underline"
              >
                {WHATSAPP_DISPLAY}
              </a>
            </li>
          </ul>
        </div>
        <div className="grid grid-cols-2 gap-8 text-[15px] sm:grid-cols-4">
          <FooterCol
            title="Product"
            links={[
              ["Features", "/#features"],
              ["Portals", "/#portals"],
              ["Live demo", "/demo"],
              ["Pricing", PRICING_CHAT],
            ]}
          />
          <FooterCol
            title="Company"
            links={[
              ["About us", "/about"],
              ["Dream Savvy Solutions", "https://dreamsavvysolutions.com"],
              ["Join the pilot", "/#pilot"],
              ["Sign in", "/login"],
            ]}
          />
          <FooterCol
            title="Resources"
            links={[
              ["How it works", "/#how"],
              ["FAQ", "/#faq"],
              ["Book a demo", DEMO],
            ]}
          />
          <FooterCol
            title="Legal"
            links={[
              ["Privacy policy", "/privacy"],
              ["Terms of use", "/terms"],
              ["Data processing agreement", "/dpa"],
            ]}
          />
        </div>
      </div>
      <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-3 border-t border-[#ECEFF4] px-4 py-6 text-sm text-[#4A5A70] sm:px-6">
        <p>
          © {new Date().getFullYear()} Dream Savvy Solutions. All rights
          reserved.
        </p>
        <p>Made in Lagos for schools across Africa.</p>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: [string, string][];
}) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="!font-sans text-sm !font-extrabold uppercase tracking-[0.1em] !text-brand-navy">
        {title}
      </h2>
      <ul className="flex flex-col gap-2.5">
        {links.map(([t, h]) => (
          <li key={t}>
            {h.startsWith("/") ? (
              <Link
                href={h}
                className="text-[#4A5A70] hover:text-brand-teal-dark"
              >
                {t}
              </Link>
            ) : (
              <a
                href={h}
                className="text-[#4A5A70] hover:text-brand-teal-dark"
                {...(h.startsWith("http")
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
              >
                {t}
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
