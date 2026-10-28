import "server-only";
import { cookies } from "next/headers";

/**
 * One-off message shown after a redirect (kept 20 seconds, never taken from the address bar).
 * `path` is the page it's for (e.g. "/admin/attendance"): the browser only sends it there,
 * so it can't pop up on another page opened straight afterwards.
 */
export async function setFlash(message: string, path: string, kind: "ok" | "warn" = "ok") {
  (await cookies()).set("sk_flash", encodeURIComponent(`${kind === "warn" ? "!" : ""}${message.slice(0, 300)}`), { httpOnly: true, sameSite: "lax", path, maxAge: 20 });
}

export async function readFlash(): Promise<{ message: string; warn: boolean } | null> {
  const v = (await cookies()).get("sk_flash")?.value;
  if (!v) return null;
  try {
    const m = decodeURIComponent(v);
    return m.startsWith("!") ? { message: m.slice(1), warn: true } : { message: m, warn: false };
  } catch {
    return null;
  }
}
