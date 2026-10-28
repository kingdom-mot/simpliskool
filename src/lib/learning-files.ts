import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { HwFile } from "@/lib/teaching";

/**
 * Homework files (worksheets and students' work) live in the private "learning"
 * bucket and are only served through /api/learning-file after an access check.
 * One request carries at most 4 MB (the hosting limit), so photos are shrunk in
 * the browser before upload.
 */
export const BUCKET = "learning";
export const MAX_REQUEST = 4 * 1024 * 1024;

const KINDS: { type: string; ext: string; test: (b: Uint8Array) => boolean; photo: boolean }[] = [
  { type: "image/jpeg", ext: "jpg", photo: true, test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { type: "image/png", ext: "png", photo: true, test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { type: "image/webp", ext: "webp", photo: true, test: (b) => b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50 },
  { type: "application/pdf", ext: "pdf", photo: false, test: (b) => b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 },
  // Word, Excel and PowerPoint files are zip files ("PK").
  { type: "application/zip", ext: "zip", photo: false, test: (b) => b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04 },
];
const OFFICE: Record<string, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

function safeName(name: string) {
  const n = name.normalize("NFKD").replace(/[^\w.\- ]+/g, "").replace(/\s+/g, " ").trim().slice(-80);
  return n || "file";
}

/** Uploads the files in a form field to `${prefix}/...`. Returns the stored files or an error. */
export async function uploadLearningFiles(files: unknown[], prefix: string, maxFiles = 5): Promise<{ files: HwFile[] } | { error: string }> {
  const list = files.filter((f): f is File => f instanceof File && f.size > 0);
  if (!list.length) return { files: [] };
  if (list.length > maxFiles) return { error: `Add at most ${maxFiles} files.` };
  if (list.reduce((a, f) => a + f.size, 0) > MAX_REQUEST) return { error: "These files are bigger than 4 MB in all. Use smaller files, or fewer at a time." };
  const admin = createAdminClient();
  const out: HwFile[] = [];
  for (const f of list) {
    const bytes = new Uint8Array(await f.arrayBuffer());
    const kind = KINDS.find((k) => k.test(bytes));
    if (!kind) return { error: `${f.name}: use a photo (JPG, PNG), PDF, or Word, Excel or PowerPoint file.` };
    let type = kind.type;
    let ext = kind.ext;
    if (kind.type === "application/zip") {
      const e = f.name.split(".").pop()?.toLowerCase() ?? "";
      if (!OFFICE[e]) return { error: `${f.name}: use a photo (JPG, PNG), PDF, or Word, Excel or PowerPoint file.` };
      type = OFFICE[e];
      ext = e;
    }
    const base = safeName(f.name).replace(/\.[^.]+$/, "");
    const path = `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await admin.storage.from(BUCKET).upload(path, bytes, { contentType: type, upsert: false });
    if (error) {
      if (out.length) await admin.storage.from(BUCKET).remove(out.map((o) => o.path));
      return { error: /bucket/i.test(error.message) ? "File storage isn't set up yet. Run 0015_teaching.sql in Supabase." : "We couldn't upload the file. Please try again." };
    }
    out.push({ path, name: `${base}.${ext}`, type, size: f.size });
  }
  return { files: out };
}

export async function removeLearningFiles(paths: string[]) {
  if (paths.length) await createAdminClient().storage.from(BUCKET).remove(paths);
}

export function isPhoto(type: string) {
  return type.startsWith("image/");
}
