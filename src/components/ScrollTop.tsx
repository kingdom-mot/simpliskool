"use client";

import { useEffect } from "react";

/**
 * Every page starts at the top: on a refresh the browser would otherwise jump back to where
 * the reader was, or to the last #section in the address. A link that deliberately points at a
 * section on another page (opened fresh, not refreshed) still goes to that section.
 */
export function ScrollTop() {
  useEffect(() => {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    const reload = nav?.type === "reload" || nav?.type === "back_forward";
    if (location.hash && !reload) return;
    if (location.hash) history.replaceState(history.state, "", location.pathname + location.search);
    window.scrollTo(0, 0);
  }, []);
  return null;
}
