import Image from "next/image";

/** Branded "not found" page. Light colours always, so it reads well even when the phone is in dark mode. */
export function NotFoundView({ title, body, homeUrl, homeLabel = "Go to Simpliskool" }: { title: string; body: React.ReactNode; homeUrl: string; homeLabel?: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-cloud px-4 py-16" style={{ colorScheme: "light" }}>
      <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-[#E3EAF3] bg-white text-center shadow-sm">
        <div className="h-2 bg-gradient-to-r from-brand-navy via-brand-teal-dark to-[#F2A93B]" aria-hidden="true" />
        <div className="flex flex-col items-center gap-5 px-6 py-10 sm:px-10">
          <Image src="/simpliskool-logo-dark.png" alt="Simpliskool" width={157} height={35} className="h-8 w-auto" />
          <p className="font-heading text-6xl font-extrabold text-brand-teal-dark" aria-hidden="true">
            404
          </p>
          <h1 className="text-2xl">{title}</h1>
          <div className="text-base leading-relaxed text-brand-slate">{body}</div>
          <a href={homeUrl} className="sk-btn">
            {homeLabel}
          </a>
        </div>
      </div>
    </main>
  );
}
