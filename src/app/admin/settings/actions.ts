"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSchool, type Role } from "@/lib/auth";
import type { ActionState } from "@/components/forms";
import { normalizeEmail, normalizePhone } from "@/lib/people";
import { createAdminClient } from "@/lib/supabase/admin";
import { SCHOOL_PALETTE } from "@/lib/theme";

/** Only the school owner changes settings (same rule as the design). */
const SETTINGS_ROLES: Role[] = ["owner"];
const BUCKET = "school-logos";
const MAX_LOGO = 1024 * 1024;

function refresh() {
  // Colours and logo show on every page of the school.
  revalidatePath("/", "layout");
}

const profileSchema = z.object({
  name: z.string().trim().min(3, "Enter the school's full name").max(120, "The name is too long"),
  motto: z.string().trim().max(120, "Keep the motto under 120 characters"),
  email: z.string().trim(),
  phone: z.string().trim(),
  address: z.string().trim().max(300, "The address is too long"),
  principal_name: z.string().trim().max(120, "The name is too long"),
  about: z.string().trim().max(2000, "Keep the introduction under 2,000 characters"),
});

export async function saveProfile(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, school } = await requireSchool(SETTINGS_ROLES);
  const parsed = profileSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const email = d.email ? normalizeEmail(d.email) : null;
  if (d.email && !email) return { error: "That email doesn't look right." };
  // Keep the phone as typed (schools like "0803 123 4567"), but check it's a real number.
  if (d.phone && !normalizePhone(d.phone)) return { error: "That phone number doesn't look right. Use 11 digits, like 08031234567." };

  const { error } = await supabase
    .from("schools")
    .update({ name: d.name, motto: d.motto || null, email, phone: d.phone || null, address: d.address || null, principal_name: d.principal_name || null, about: d.about || null })
    .eq("id", school.id);
  if (error) return { error: "We couldn't save the details. Please try again." };
  refresh();
  return { ok: true, message: "School details saved.", at: Date.now() };
}

const allowed = new Set<string>(SCHOOL_PALETTE.map((c) => c.hex));

export async function saveColours(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, school } = await requireSchool(SETTINGS_ROLES);
  const picked = fd
    .getAll("colour")
    .map((c) => String(c).toUpperCase())
    .filter(Boolean);
  if (picked.length > 2) return { error: "Choose at most 2 colours." };
  if (picked.some((c) => !allowed.has(c))) return { error: "Choose colours from the palette." };
  if (picked.length === 2 && picked[0] === picked[1]) return { error: "Choose two different colours." };
  const { error } = await supabase
    .from("schools")
    .update({ primary_color: picked[0] ?? null, secondary_color: picked[1] ?? null })
    .eq("id", school.id);
  if (error) return { error: "We couldn't save the colours. Please try again." };
  refresh();
  const names = picked.map((h) => SCHOOL_PALETTE.find((c) => c.hex === h)!.name);
  return { ok: true, message: names.length ? `Colours saved: ${names.join(" and ")}.` : "Saved. Your school uses the Simpliskool colours.", at: Date.now() };
}

/** Works out the real image type from the file's first bytes (not its name). */
function sniff(buf: Uint8Array): { type: string; ext: string } | null {
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return { type: "image/png", ext: "png" };
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { type: "image/jpeg", ext: "jpg" };
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return { type: "image/webp", ext: "webp" };
  return null;
}

function ourPath(url: string | null, schoolId: string) {
  if (!url) return null;
  const m = url.match(new RegExp(`/storage/v1/object/public/${BUCKET}/(${schoolId}/[^?]+)`));
  return m ? m[1] : null;
}

export async function uploadLogo(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, school } = await requireSchool(SETTINGS_ROLES);
  const file = fd.get("logo");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a logo file first." };
  if (file.size > MAX_LOGO) return { error: "That file is bigger than 1 MB. Save a smaller version and try again." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniff(bytes);
  if (!kind) return { error: "Use a PNG, JPG or WebP picture." };

  const admin = createAdminClient();
  const path = `${school.id}/logo-${Date.now()}.${kind.ext}`;
  const { error: upErr } = await admin.storage.from(BUCKET).upload(path, bytes, { contentType: kind.type, cacheControl: "31536000", upsert: false });
  if (upErr) return { error: /bucket/i.test(upErr.message) ? "Logo storage isn't set up yet. Run 0009_school_settings.sql in Supabase." : "We couldn't upload the logo. Please try again." };
  const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);

  const old = ourPath(school.logo_url, school.id);
  const { error } = await supabase.from("schools").update({ logo_url: pub.publicUrl }).eq("id", school.id);
  if (error) {
    await admin.storage.from(BUCKET).remove([path]);
    return { error: "We couldn't save the logo. Please try again." };
  }
  if (old) await admin.storage.from(BUCKET).remove([old]);
  refresh();
  return { ok: true, message: "Logo uploaded.", at: Date.now() };
}

export async function removeLogo(): Promise<ActionState> {
  const { supabase, school } = await requireSchool(SETTINGS_ROLES);
  const old = ourPath(school.logo_url, school.id);
  const { error } = await supabase.from("schools").update({ logo_url: null }).eq("id", school.id);
  if (error) return { error: "We couldn't remove the logo. Please try again." };
  if (old) await createAdminClient().storage.from(BUCKET).remove([old]);
  refresh();
  return { ok: true, message: "Logo removed. Your school's initials show instead.", at: Date.now() };
}
