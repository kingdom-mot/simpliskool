import Image from "next/image";
import { initials, schoolThemeStyle } from "@/lib/theme";
import { DEFAULT_HIGHLIGHTS, asWebsite, pageOn } from "@/lib/website";
import { ApplyForm } from "./ApplyForm";

export type School = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  about: string | null;
  motto?: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website?: unknown;
};

export type Post = { id: string; title: string; body: string | null; image_url: string | null; image_alt?: string | null; album?: string | null; published_at: string };

const NEWS_TINTS = ["#F3E9EA", "#E7EFE9", "#ECE8F3"];

export function SchoolSiteView({ school, news, gallery = [] }: { school: School; news: Post[]; gallery?: Post[] }) {
  const w = asWebsite(school.website);
  const show = { about: pageOn(w, "about"), admissions: pageOn(w, "admissions"), news: pageOn(w, "news") && news.length > 0, gallery: pageOn(w, "gallery") && gallery.length > 0, contact: pageOn(w, "contact") };
  const open = show.admissions && w.admissions_open !== false;
  const highlights = w.highlights?.length ? w.highlights : DEFAULT_HIGHLIGHTS;
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "simpliskool.com";
  const portal = `https://${rootDomain}/login?school=${school.slug}`;
  const year = new Date().getFullYear();

  return (
    <div style={schoolThemeStyle(school.primary_color, school.secondary_color)} className="min-h-screen bg-white">
      <a className="sk-skip" href="#main">
        Skip to main content
      </a>
      <header className="border-b border-[#ECE7E2] bg-white">
        <div className="mx-auto flex h-[76px] max-w-[1180px] items-center justify-between gap-4 px-6">
          <a href="#top" className="flex min-w-0 items-center gap-3">
            <Crest school={school} size={44} />
            <span className="min-w-0">
              <span className="block truncate text-[17px] font-extrabold text-brand-slate">{school.name}</span>
              {school.address && <span className="block truncate text-xs text-[#5B6470]">{school.address.split(",").slice(-2).join(",").trim()}</span>}
            </span>
          </a>
          <nav aria-label="School" className="hidden gap-6 md:flex">
            {[
              ...(show.about ? [["About", "#about"]] : []),
              ...(show.admissions ? [["Admissions", "#admissions"]] : []),
              ...(show.news ? [["News", "#news"]] : []),
              ...(show.gallery ? [["Gallery", "#gallery"]] : []),
              ...(show.contact ? [["Contact", "#contact"]] : []),
            ].map(([l, h]) => (
              <a key={h} href={h} className="text-[15px] font-semibold text-brand-slate hover:text-c1">
                {l}
              </a>
            ))}
          </nav>
          <div className="flex flex-none gap-2.5">
            <a href={portal} className="hidden min-h-[44px] items-center rounded-[10px] border border-[#D8D2CC] px-3.5 text-sm font-bold text-brand-slate sm:inline-flex">
              Portal login
            </a>
            {open && (
              <a href="#admissions" className="inline-flex min-h-[44px] items-center rounded-[10px] bg-c2 px-4 text-sm font-bold text-white hover:opacity-90">
                Apply now
              </a>
            )}
          </div>
        </div>
      </header>

      <main id="main">
        <section id="top" className="bg-[#FAF7F4] py-16">
          <div className="mx-auto grid max-w-[1180px] items-center gap-12 px-6 md:grid-cols-2">
            <div className="flex flex-col gap-5">
              <span className="text-[13px] font-extrabold tracking-[0.08em] text-c2">WELCOME TO</span>
              <h1 className="text-[40px] leading-[1.08] !text-brand-slate md:text-[56px]">{w.headline || school.name}</h1>
              {school.motto && <p className="font-heading text-xl font-bold italic text-c1">&ldquo;{school.motto}&rdquo;</p>}
              <p className="max-w-[520px] whitespace-pre-line text-lg leading-relaxed text-[#4A5560]">
                {w.intro || school.about || "A caring school community where every child is known, supported and encouraged to do their best."}
              </p>
              <div className="flex flex-wrap gap-3">
                {open && (
                  <a href="#admissions" className="inline-flex min-h-[52px] items-center rounded-xl bg-c2 px-6 text-base font-bold text-white hover:opacity-90">
                    Start an application
                  </a>
                )}
                {show.contact && (
                  <a href="#contact" className="inline-flex min-h-[52px] items-center rounded-xl border-[1.5px] border-brand-slate px-6 text-base font-bold text-brand-slate">
                    Visit the school
                  </a>
                )}
              </div>
            </div>
            {w.hero_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={w.hero_url} alt={w.hero_alt ?? ""} className="h-[320px] w-full rounded-[22px] object-cover md:h-[400px]" />
            ) : (
            <div className="grid grid-cols-2 gap-3.5" aria-hidden="true">
              <div className="row-span-2 flex min-h-[300px] flex-col justify-end gap-2 rounded-[22px] bg-c1 p-6 text-white">
                <Crest school={school} size={64} light />
                <span className="font-heading text-2xl font-extrabold leading-tight">{school.name}</span>
              </div>
              <div className="flex min-h-[143px] flex-col justify-end rounded-[22px] bg-[color-mix(in_srgb,var(--c2,#0B7D6E)_14%,white)] p-5">
                <span className="font-heading text-2xl font-black text-c2">{year}/{year + 1}</span>
                <span className="text-sm font-semibold text-brand-slate">{open ? "Admissions open" : "Our school year"}</span>
              </div>
              <div className="flex min-h-[143px] flex-col justify-end rounded-[22px] bg-c2 p-5 text-white">
                <span className="font-heading text-xl font-black">Online portal</span>
                <span className="text-sm">Results, fees and updates for parents</span>
              </div>
            </div>
            )}
          </div>
        </section>

        {show.about && (
        <section id="about" className="py-16">
          <div className="mx-auto flex max-w-[1180px] flex-col gap-8 px-6">
            <div className="max-w-[720px]">
              <span className="text-[13px] font-extrabold tracking-[0.08em] text-c2">ABOUT US</span>
              <h2 className="mt-2 text-[34px] leading-tight !text-brand-slate">Every child known, every parent informed</h2>
              {w.about_text && <p className="mt-3 whitespace-pre-line text-[17px] leading-relaxed text-[#4A5560]">{w.about_text}</p>}
            </div>
            <div className="grid gap-5 md:grid-cols-3">
              {highlights.map(({ title: t, text: b }, i) => (
                <div key={t} className="rounded-[20px] border border-[#ECE7E2] p-6" style={{ borderTop: `5px solid ${i === 1 ? "var(--c2,#0B7D6E)" : "var(--c1,#173B70)"}` }}>
                  <h3 className="text-xl !text-c1">{t}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-[#4A5560]">{b}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
        )}

        {show.admissions && (
        <section id="admissions" className="bg-[#FAF7F4] py-16">
          <div className="mx-auto grid max-w-[1180px] items-start gap-10 px-6 md:grid-cols-2">
            <div className="flex flex-col gap-5">
              <span className="text-[13px] font-extrabold tracking-[0.08em] text-c2">ADMISSIONS</span>
              <h2 className="text-[34px] leading-tight !text-brand-slate">Apply in three simple steps</h2>
              <ol className="flex flex-col gap-4">
                {[
                  ["Fill the online form", "It takes about five minutes."],
                  ["Hear from the school", "We'll call or email you about the next step."],
                  ["Offer and enrolment", "Accept your offer and get your parent portal login."],
                ].map(([t, b], i) => (
                  <li key={t} className="flex items-start gap-3.5">
                    <span aria-hidden="true" className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-c1 font-extrabold text-white">
                      {i + 1}
                    </span>
                    <div>
                      <div className="text-[17px] font-extrabold text-brand-slate">{t}</div>
                      <div className="text-[15px] text-[#4A5560]">{b}</div>
                    </div>
                  </li>
                ))}
              </ol>
              {w.admission_requirements && (
                <p className="rounded-xl bg-white p-4 text-[15px] text-[#4A5560]">
                  <strong className="text-brand-slate">What to bring:</strong> {w.admission_requirements}
                </p>
              )}
            </div>
            <div className="rounded-[22px] border border-[#ECE7E2] bg-white p-7">
              <h3 className="mb-5 text-[22px] !text-brand-slate">Application form</h3>
              {open ? (
                <ApplyForm schoolId={school.id} classes={w.admission_classes} />
              ) : (
                <p className="text-[15px] text-[#4A5560]">Admissions are closed at the moment. Please contact the school to ask about places.</p>
              )}
            </div>
          </div>
        </section>
        )}

        {show.news && (
          <section id="news" className="py-16">
            <div className="mx-auto flex max-w-[1180px] flex-col gap-6 px-6">
              <h2 className="text-[34px] !text-brand-slate">News and events</h2>
              <div className="grid gap-5 md:grid-cols-3">
                {news.map((n, i) => (
                  <article key={n.id} className="overflow-hidden rounded-[20px] border border-[#ECE7E2]">
                    {n.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={n.image_url} alt={n.image_alt ?? ""} className="h-44 w-full object-cover" />
                    ) : (
                      <div aria-hidden="true" className="h-44" style={{ background: NEWS_TINTS[i % 3] }} />
                    )}
                    <div className="flex flex-col gap-1.5 p-5">
                      <span className="text-[13px] font-bold text-c2">{new Date(n.published_at).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })}</span>
                      <h3 className="text-lg !text-brand-slate">{n.title}</h3>
                      {n.body && <p className="line-clamp-3 text-sm text-[#4A5560]">{n.body}</p>}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>
        )}

        {show.gallery && (
          <section id="gallery" className="bg-[#FAF7F4] py-16">
            <div className="mx-auto flex max-w-[1180px] flex-col gap-6 px-6">
              <h2 className="text-[34px] !text-brand-slate">Gallery</h2>
              <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {gallery.map((g) => (
                  <li key={g.id}>
                    <figure className="overflow-hidden rounded-[16px] bg-white">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={g.image_url ?? ""} alt={g.image_alt ?? ""} className="h-40 w-full object-cover" loading="lazy" />
                      {g.album && <figcaption className="px-3 py-2 text-xs font-semibold text-[#5B6470]">{g.album}</figcaption>}
                    </figure>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {show.contact && (
        <section id="contact" className="py-16">
          <div className="mx-auto max-w-[1180px] px-6">
            <div className="flex flex-wrap justify-between gap-8 rounded-[26px] bg-c1 p-10 text-white">
              <div>
                <h2 className="text-[34px] !text-white">Visit us</h2>
                <p className="mt-2 text-[17px] text-white">{school.address ?? "Contact the school for directions."}</p>
              </div>
              <div className="flex flex-col gap-1.5 text-[17px] font-semibold">
                {school.phone && (
                  <a href={`tel:${school.phone.replace(/\s/g, "")}`} className="text-white underline-offset-2 hover:underline">
                    {school.phone}
                  </a>
                )}
                {school.email && (
                  <a href={`mailto:${school.email}`} className="text-white underline-offset-2 hover:underline">
                    {school.email}
                  </a>
                )}
                <a href={portal} className="mt-2 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-white px-4 text-[15px] font-bold text-c1">
                  Parent and student login
                </a>
              </div>
            </div>
          </div>
        </section>
        )}
      </main>

      <footer className="border-t border-[#ECE7E2] py-6">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-3 px-6 text-sm text-[#5B6470]">
          <span>
            © {year} {school.name}
          </span>
          <span className="flex items-center gap-2">
            Powered by <Image src="/simpliskool-logo-dark.png" alt="Simpliskool" width={100} height={22} className="h-[18px] w-auto" />
          </span>
        </div>
      </footer>
    </div>
  );
}

function Crest({ school, size, light = false }: { school: Pick<School, "name" | "logo_url">; size: number; light?: boolean }) {
  if (school.logo_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={school.logo_url} alt={light ? "" : `${school.name} crest`} width={size} height={size} className="flex-none rounded-xl bg-white object-contain p-1" style={{ width: size, height: size }} />
    );
  }
  return (
    <span
      role={light ? undefined : "img"}
      aria-label={light ? undefined : `${school.name} crest`}
      className={`flex flex-none items-center justify-center rounded-xl font-extrabold ${light ? "bg-white/15 text-white" : "bg-c1 text-white"}`}
      style={{ width: size, height: size, fontSize: size * 0.34 }}
    >
      {initials(school.name)}
    </span>
  );
}
