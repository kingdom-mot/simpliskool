"use client";

import { getQueue } from "@/lib/register-queue";

/**
 * Sign out, clearing this phone's saved copies of school pages so the next
 * person to use the phone can't see them. Warns if registers haven't uploaded.
 */
export function SignOutButton({ className }: { className: string }) {
  return (
    <form
      action="/auth/signout"
      method="post"
      onSubmit={async (e) => {
        const waiting = getQueue().length;
        if (waiting && !confirm(`${waiting} register${waiting === 1 ? " is" : "s are"} saved on this phone but not uploaded yet. If you sign out now, ${waiting === 1 ? "it" : "they"} will be lost. Sign out anyway?`)) {
          e.preventDefault();
          return;
        }
        e.preventDefault();
        const form = e.currentTarget;
        try {
          const keys = await caches.keys();
          await Promise.all(keys.filter((k) => k.startsWith("sk-pages")).map((k) => caches.delete(k)));
          Object.keys(localStorage)
            .filter((k) => k.startsWith("sk-register"))
            .forEach((k) => localStorage.removeItem(k));
        } catch {
          /* nothing saved, or storage blocked */
        }
        form.submit();
      }}
    >
      <button className={className}>Sign out</button>
    </form>
  );
}
