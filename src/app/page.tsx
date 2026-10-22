import Image from "next/image";
import Link from "next/link";

const features = [
  { title: "Results and report cards", body: "CA and exam scores, automatic grading and positions, and report cards ready to print or share." },
  { title: "Fees and payments", body: "Parents pay online with Paystack. Receipts and debtor lists update instantly." },
  { title: "Attendance that works offline", body: "Teachers take the register on their phones, even when the network drops." },
  { title: "A portal for every parent", body: "Results, attendance, homework and fee balances in one place." },
  { title: "Lessons, homework and CBT", body: "Notes, assignments and computer-based tests, marked automatically." },
  { title: "Your own school website", body: "A ready-made site with an admissions form, news and gallery." },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <header className="bg-brand-navy">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Image src="/simpliskool-logo.png" alt="Simpliskool" width={170} height={38} priority />
          <Link href="/login" className="rounded-lg bg-brand-teal px-4 py-2 text-sm font-semibold text-white hover:bg-brand-teal-dark">
            Sign in
          </Link>
        </div>
        <div className="mx-auto max-w-6xl px-4 pb-20 pt-12 text-white">
          <p className="text-sm font-semibold uppercase tracking-widest text-brand-teal">Simplifying school management</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-tight md:text-5xl">
            Run your whole school from one simple app.
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-white/80">
            Admissions, attendance, results, fees, lessons and parent communication, built for schools in Nigeria and across Africa.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/login" className="btn-primary px-6 py-3 text-base">Start your school</Link>
            <a href="mailto:enquiries@simpliskool.com" className="inline-flex items-center rounded-lg border border-white/40 px-6 py-3 text-base font-semibold text-white hover:bg-white/10">
              Book a demo
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-6 md:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="card">
              <h2 className="font-semibold text-brand-navy">{f.title}</h2>
              <p className="mt-2 text-sm text-slate-600">{f.body}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t border-slate-200 py-8 text-center text-sm text-slate-500">
        Simpliskool is a product of Dream Savvy Solutions · enquiries@simpliskool.com
      </footer>
    </div>
  );
}
