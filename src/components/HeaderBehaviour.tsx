"use client";

import { useEffect } from "react";

/**
 * Marketing header: choosing an item in a mega menu (or the phone menu) closes the menu at once,
 * and links to a section of this page glide there without adding #section to the address, so a
 * refresh starts at the top.
 */
export function HeaderBehaviour({ headerId }: { headerId: string }) {
  useEffect(() => {
    const header = document.getElementById(headerId);
    if (!header) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest("a");
      if (!a) return;
      if (header.contains(a)) {
        header.classList.add("sk-hush");
        header.querySelectorAll("details[open]").forEach((d) => d.removeAttribute("open"));
        (document.activeElement as HTMLElement | null)?.blur();
      }
      const href = a.getAttribute("href") ?? "";
      if (href.startsWith("#") && href.length > 1) {
        const target = document.getElementById(href.slice(1));
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
        // Move keyboard focus to the section, so Tab carries on from there.
        if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
        target.focus({ preventScroll: true });
      }
    };
    // The menu can open again once the pointer leaves it or moves to a menu button.
    const wake = (e: Event) => {
      if (e.type === "mouseleave" || (e.target as HTMLElement).closest(".sk-menu > button")) header.classList.remove("sk-hush");
    };
    document.addEventListener("click", onClick);
    header.addEventListener("mouseleave", wake);
    header.addEventListener("pointerover", wake);
    header.addEventListener("focusin", wake);
    return () => {
      document.removeEventListener("click", onClick);
      header.removeEventListener("mouseleave", wake);
      header.removeEventListener("pointerover", wake);
      header.removeEventListener("focusin", wake);
    };
  }, [headerId]);
  return null;
}
