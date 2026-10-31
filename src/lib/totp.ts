import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";

/**
 * Two-step sign-in for the Dream Savvy team: 6-digit codes from an authenticator
 * app (RFC 6238, the same as Google Authenticator, Microsoft Authenticator, 1Password).
 */
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function toBase32(buf: Buffer) {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

function fromBase32(s: string) {
  const clean = s.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    value = (value << 5) | B32.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function newTotpSecret() {
  return toBase32(randomBytes(20));
}

export function totpCode(secret: string, step: number) {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(step));
  const h = createHmac("sha1", fromBase32(secret)).update(msg).digest();
  const o = h[h.length - 1] & 15;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

function same(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Accepts the current code and the ones either side of it (clocks drift). */
export function checkTotp(secret: string, code: string, now = Date.now()) {
  const c = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(c)) return false;
  const step = Math.floor(now / 30_000);
  return [-1, 0, 1].some((d) => same(totpCode(secret, step + d), c));
}

export function otpauthUri(secret: string, account: string) {
  return `otpauth://totp/${encodeURIComponent(`Simpliskool:${account}`)}?secret=${secret}&issuer=Simpliskool&algorithm=SHA1&digits=6&period=30`;
}

/** "ABCD EFGH ..." so the secret can be typed in by hand. */
export function spaced(secret: string) {
  return secret.replace(/(.{4})/g, "$1 ").trim();
}

function key() {
  const k = process.env.PLATFORM_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!k) throw new Error("PLATFORM_SECRET or SUPABASE_SERVICE_ROLE_KEY must be set");
  return createHash("sha256").update(`simpliskool-platform:${k}`).digest();
}

/** Secrets are stored encrypted, so a database copy alone can't produce codes. */
export function seal(text: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([c.update(text, "utf8"), c.final()]);
  return `v1.${iv.toString("base64url")}.${c.getAuthTag().toString("base64url")}.${body.toString("base64url")}`;
}

export function unseal(sealed: string | null | undefined) {
  if (!sealed) return null;
  const [v, iv, tag, body] = sealed.split(".");
  if (v !== "v1" || !iv || !tag || !body) return null;
  try {
    const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
    d.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([d.update(Buffer.from(body, "base64url")), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/** Cookie value proving this person entered a code: user.expiry.signature */
export function signPass(userId: string, expiresAt: number) {
  const p = `${userId}.${expiresAt}`;
  return `${p}.${createHmac("sha256", key()).update(p).digest("base64url")}`;
}

export function readPass(value: string | undefined, userId: string, now = Date.now()) {
  if (!value) return false;
  const i = value.lastIndexOf(".");
  if (i < 0) return false;
  const p = value.slice(0, i);
  const [uid, exp] = p.split(".");
  if (uid !== userId || !(Number(exp) > now)) return false;
  return same(value.slice(i + 1), createHmac("sha256", key()).update(p).digest("base64url"));
}
