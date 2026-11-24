"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

const HIDE_KEY = "sk_install_hidden";

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** Where we are: on the server, already installed, an iPhone, another phone, or a computer. */
function where(): string {
  try {
    if (localStorage.getItem(HIDE_KEY)) return "hidden";
  } catch {
    /* storage blocked: still show the hint */
  }
  const nav = navigator as Navigator & { standalone?: boolean };
  if (window.matchMedia("(display-mode: standalone)").matches || nav.standalone) return "installed";
  if (!window.matchMedia("(max-width: 767px)").matches) return "computer";
  if (/iphone|ipad|ipod/i.test(navigator.userAgent)) return "ios";
  return "phone";
}
const noop = () => () => {};

/**
 * Turns on the offline helper (which also lets phones install the app), and on a phone that
 * hasn't installed Simpliskool yet, offers to put it on the home screen. Android shows an
 * Install button; iPhone shows the two taps it takes in Safari. Hidden for good once dismissed.
 */
export function InstallApp({ className = "mb-4" }: { className?: string }) {
  const place = useSyncExternalStore(noop, where, () => "server");
  const [evt, setEvt] = useState<PromptEvent | null>(null);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => null);
    const keep = (e: Event) => {
      e.preventDefault();
      setEvt(e as PromptEvent);
    };
    const done = () => setGone(true);
    window.addEventListener("beforeinstallprompt", keep);
    window.addEventListener("appinstalled", done);
    return () => {
      window.removeEventListener("beforeinstallprompt", keep);
      window.removeEventListener("appinstalled", done);
    };
  }, []);

  const hide = () => {
    try {
      localStorage.setItem(HIDE_KEY, "1");
    } catch {
      /* fine: hidden for this visit */
    }
    setGone(true);
  };

  if (gone || !["ios", "phone"].includes(place)) return null;
  if (place === "phone" && !evt) return null;

  return (
    <aside aria-labelledby="install-h" className={`${className} flex items-start gap-3 rounded-2xl border border-[#DCE5F0] bg-white p-3.5 print:hidden`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/app-icon-192.png" alt="" width={40} height={40} className="h-10 w-10 flex-none rounded-xl" />
      <div className="min-w-0 flex-1">
        <h2 id="install-h" className="text-[15px] font-extrabold !text-brand-navy">
          Add Simpliskool to your home screen
        </h2>
        {place === "ios" ? (
          <p className="mt-0.5 text-[13px] text-[#4A5A70]">
            In Safari, tap the Share button
            <svg aria-hidden="true" className="mx-1 inline -translate-y-px" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v13M7 8l5-5 5 5M5 12v8h14v-8" />
            </svg>
            then <strong>Add to Home Screen</strong>. It opens like an app.
          </p>
        ) : (
          <>
            <p className="mt-0.5 text-[13px] text-[#4A5A70]">It opens like an app, straight to your page.</p>
            <button
              type="button"
              className="s-btn mt-2 !min-h-[40px] !px-3.5"
              onClick={async () => {
                if (!evt) return;
                await evt.prompt();
                const { outcome } = await evt.userChoice;
                if (outcome === "accepted") setGone(true);
                setEvt(null);
              }}
            >
              Install app
            </button>
          </>
        )}
      </div>
      <button type="button" onClick={hide} aria-label="Hide this" className="-m-1 flex h-9 w-9 flex-none items-center justify-center rounded-lg text-[#4A5A70] hover:bg-brand-cloud">
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
    </aside>
  );
}
