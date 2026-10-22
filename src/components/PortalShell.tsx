import Image from "next/image";
import Link from "next/link";

export function PortalShell({
  schoolName,
  roleLabel,
  children,
}: {
  schoolName: string;
  roleLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-brand-mist">
      <header className="bg-brand-navy text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/dashboard" className="flex items-center gap-3">
            <Image src="/simpliskool-logo.png" alt="Simpliskool" width={143} height={32} className="h-8 w-auto" />
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <span className="hidden text-right sm:block">
              <span className="block font-semibold">{schoolName}</span>
              <span className="block text-xs text-white/70">{roleLabel}</span>
            </span>
            <form action="/auth/signout" method="post">
              <button className="rounded-md border border-white/30 px-3 py-1.5 text-xs font-semibold hover:bg-white/10">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
