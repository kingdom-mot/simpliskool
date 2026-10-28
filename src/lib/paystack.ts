import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";

/**
 * Paystack (https://paystack.com/docs/api). Server only: needs PAYSTACK_SECRET_KEY.
 * Use the test key (sk_test_...) until the school is ready for real money.
 */
const BASE = () => process.env.PAYSTACK_API_URL ?? "https://api.paystack.co";

export function paystackReady() {
  return !!process.env.PAYSTACK_SECRET_KEY;
}

export function paystackTestMode() {
  return (process.env.PAYSTACK_SECRET_KEY ?? "").startsWith("sk_test_");
}

type PsResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function ps<T>(path: string, init?: { method?: string; body?: unknown; revalidate?: number }): Promise<PsResult<T>> {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) return { ok: false, error: "Online payments aren't set up yet." };
  try {
    const res = await fetch(`${BASE()}${path}`, {
      method: init?.method ?? "GET",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: init?.body ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(15000),
      ...(init?.revalidate ? { next: { revalidate: init.revalidate } } : { cache: "no-store" as const }),
    });
    const json = (await res.json().catch(() => ({}))) as { status?: boolean; message?: string; data?: T };
    if (!res.ok || !json.status) return { ok: false, error: json.message ?? `Paystack error ${res.status}` };
    return { ok: true, data: json.data as T };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Paystack can't be reached" };
  }
}

export type Bank = { name: string; code: string };

/** Nigerian banks and mobile money banks that can receive payouts (cached for a day). */
export async function listBanks(): Promise<Bank[]> {
  const r = await ps<{ name: string; code: string; active: boolean; is_deleted?: boolean }[]>("/bank?country=nigeria&perPage=300", { revalidate: 86400 });
  if (!r.ok) return [];
  const seen = new Set<string>();
  return r.data
    .filter((b) => b.active && !b.is_deleted && !seen.has(b.code) && seen.add(b.code))
    .map((b) => ({ name: b.name, code: b.code }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** The account holder's name, straight from the bank. */
export async function resolveAccount(accountNo: string, bankCode: string) {
  return ps<{ account_number: string; account_name: string }>(`/bank/resolve?account_number=${encodeURIComponent(accountNo)}&bank_code=${encodeURIComponent(bankCode)}`);
}

/**
 * Creates (or updates) the school's subaccount. The school bears Paystack's
 * charge ("subaccount" bearer) and Simpliskool takes nothing (0%).
 */
export async function upsertSubaccount(input: { existing: string | null; schoolName: string; bankCode: string; accountNo: string; email: string | null }) {
  const body = {
    business_name: input.schoolName.slice(0, 100),
    settlement_bank: input.bankCode,
    account_number: input.accountNo,
    percentage_charge: Number(process.env.PLATFORM_FEE_PERCENT ?? 0),
    ...(input.email ? { primary_contact_email: input.email } : {}),
  };
  if (input.existing) {
    const r = await ps<{ subaccount_code: string }>(`/subaccount/${encodeURIComponent(input.existing)}`, { method: "PUT", body });
    if (r.ok) return { ok: true as const, code: r.data.subaccount_code ?? input.existing };
  }
  const r = await ps<{ subaccount_code: string }>("/subaccount", { method: "POST", body });
  return r.ok ? { ok: true as const, code: r.data.subaccount_code } : { ok: false as const, error: r.error };
}

export function newReference() {
  return `SK-${Date.now().toString(36).toUpperCase()}-${randomBytes(5).toString("hex").toUpperCase()}`;
}

export async function initializePayment(input: { email: string; amountKobo: number; reference: string; subaccount: string; callbackUrl: string; metadata: Record<string, unknown> }) {
  return ps<{ authorization_url: string; access_code: string; reference: string }>("/transaction/initialize", {
    method: "POST",
    body: {
      email: input.email,
      amount: input.amountKobo,
      currency: "NGN",
      reference: input.reference,
      subaccount: input.subaccount,
      bearer: "subaccount",
      callback_url: input.callbackUrl,
      channels: ["card", "bank_transfer", "ussd", "bank"],
      metadata: input.metadata,
    },
  });
}

export type Verified = { status: string; reference: string; amount: number; paid_at: string | null; channel: string | null; fees: number | null; currency: string };

export async function verifyPayment(reference: string) {
  return ps<Verified>(`/transaction/verify/${encodeURIComponent(reference)}`);
}

/** Checks the x-paystack-signature header (HMAC SHA-512 of the raw body with the secret key). */
export function validSignature(rawBody: string, signature: string | null) {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key || !signature) return false;
  const good = Buffer.from(createHmac("sha512", key).update(rawBody).digest("hex"));
  const got = Buffer.from(signature);
  return good.length === got.length && timingSafeEqual(good, got);
}
