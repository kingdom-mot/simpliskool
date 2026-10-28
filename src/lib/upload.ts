import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/** Works out the real image type from the file's first bytes (not its name). */
export function sniffImage(buf: Uint8Array): { type: string; ext: string } | null {
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return { type: "image/png", ext: "png" };
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { type: "image/jpeg", ext: "jpg" };
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return { type: "image/webp", ext: "webp" };
  return null;
}

/** Uploads a school photo (PNG, JPG or WebP up to maxBytes) and returns its public address. */
export async function uploadSchoolImage(file: unknown, schoolId: string, folder: string, maxBytes = 3 * 1024 * 1024): Promise<{ url: string } | { error: string }> {
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a photo first." };
  if (file.size > maxBytes) return { error: `That photo is bigger than ${Math.round(maxBytes / 1024 / 1024)} MB. Save a smaller version and try again.` };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniffImage(bytes);
  if (!kind) return { error: "Use a PNG, JPG or WebP photo." };
  const admin = createAdminClient();
  const path = `${schoolId}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${kind.ext}`;
  const { error } = await admin.storage.from("school-site").upload(path, bytes, { contentType: kind.type, cacheControl: "31536000", upsert: false });
  if (error) return { error: /bucket/i.test(error.message) ? "Photo storage isn't set up yet. Run 0013_school_admin.sql in Supabase." : "We couldn't upload the photo. Please try again." };
  return { url: admin.storage.from("school-site").getPublicUrl(path).data.publicUrl };
}

/** Deletes a photo we stored, if the address is one of ours for this school. */
export async function removeSchoolImage(url: string | null | undefined, schoolId: string) {
  const m = url?.match(new RegExp(`/storage/v1/object/public/school-site/(${schoolId}/[^?]+)`));
  if (m) await createAdminClient().storage.from("school-site").remove([m[1]]);
}
