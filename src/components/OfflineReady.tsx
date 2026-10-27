"use client";

import { useEffect } from "react";

/**
 * Turns on the offline helper so teacher pages open without network, and asks it
 * to keep a copy of this page and the code it uses.
 */
export function OfflineReady() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let cancelled = false;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then(() => navigator.serviceWorker.ready)
      .then((reg) => {
        if (cancelled || !reg.active) return;
        const assets = performance
          .getEntriesByType("resource")
          .map((e) => e.name)
          .filter((u) => u.includes("/_next/static/"));
        reg.active.postMessage({ type: "keep", pages: [location.href], assets });
      })
      .catch(() => null);
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}
