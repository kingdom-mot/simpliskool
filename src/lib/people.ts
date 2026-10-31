import "server-only";
import { isDemoRequest } from "@/lib/demo";
import { createAdminClient } from "@/lib/supabase/admin";

/** Nigerian phone numbers to international form: 0803 123 4567 -> +2348031234567. */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let p = String(raw).replace(/[^\d+]/g, "");
  if (!p) return null;
  if (p.startsWith("00")) p = `+${p.slice(2)}`;
  if (p.startsWith("+")) return /^\+\d{8,15}$/.test(p) ? p : null;
  if (p.startsWith("0") && p.length === 11) return `+234${p.slice(1)}`;
  if (p.length === 10 && /^[789]/.test(p)) return `+234${p}`; // Excel dropped the leading 0
  if (p.startsWith("234") && p.length === 13) return `+${p}`;
  return null;
}

export function normalizeEmail(raw: string | null | undefined): string | null {
  const e = String(raw ?? "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
}

/**
 * Finds the person with this email or phone, or creates a sign-in account for them.
 * Nothing is emailed or texted here; they sign in later with a one-time code.
 * Only call this after checking the caller is allowed to add people to the school.
 */
export async function findOrCreateUser(input: { email?: string | null; phone?: string | null; fullName?: string | null }): Promise<string | null> {
  // The demo never creates real sign-ins (it's wiped every night and anyone can use it).
  if (await isDemoRequest()) return null;
  const email = normalizeEmail(input.email);
  const phone = normalizePhone(input.phone);
  if (!email && !phone) return null;
  const admin = createAdminClient();

  const lookup = async () => {
    if (email) {
      const { data } = await admin.from("profiles").select("id").ilike("email", email).limit(1).maybeSingle<{ id: string }>();
      if (data) return data.id;
    }
    if (phone) {
      // Supabase stores phones without the "+".
      const { data } = await admin.from("profiles").select("id").in("phone", [phone, phone.slice(1)]).limit(1).maybeSingle<{ id: string }>();
      if (data) return data.id;
    }
    return null;
  };

  let id = await lookup();
  if (!id) {
    const { data, error } = await admin.auth.admin.createUser({
      email: email ?? undefined,
      phone: phone ?? undefined,
      email_confirm: !!email,
      phone_confirm: !!phone,
      user_metadata: { full_name: input.fullName?.trim() || "" },
    });
    id = data?.user?.id ?? null;
    if (error && !id) id = await lookup(); // created by someone else a moment ago
  }
  if (!id) return null;

  // Fill in missing details without overwriting what the person set themselves.
  const { data: prof } = await admin.from("profiles").select("full_name, email, phone").eq("id", id).maybeSingle<{ full_name: string | null; email: string | null; phone: string | null }>();
  const patch: Record<string, string> = {};
  if (!prof?.full_name?.trim() && input.fullName?.trim()) patch.full_name = input.fullName.trim();
  if (!prof?.email && email) patch.email = email;
  if (!prof?.phone && phone) patch.phone = phone;
  if (Object.keys(patch).length) await admin.from("profiles").update(patch).eq("id", id);
  return id;
}
