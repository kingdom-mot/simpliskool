import "server-only";
import { cookies } from "next/headers";

/** One-off confirmation shown after a redirect (kept 20 seconds, never taken from the address bar). */
export async function setFlash(message: string) {
  (await cookies()).set("sk_flash", encodeURIComponent(message.slice(0, 300)), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 20 });
}

export async function readFlash(): Promise<string | null> {
  const v = (await cookies()).get("sk_flash")?.value;
  if (!v) return null;
  try {
    return decodeURIComponent(v);
  } catch {
    return null;
  }
}
