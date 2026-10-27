"use client";

/**
 * Registers saved on this phone while offline, waiting to upload.
 * Kept in localStorage so they survive closing the browser.
 */
export type Mark = { student_id: string; status: "present" | "absent" | "late" };
export type QueuedRegister = { class_id: string; class_name: string; date: string; marks: Mark[]; queued_at: string };

const QUEUE = "sk-register-queue";
const DRAFT = (classId: string, date: string) => `sk-register-draft:${classId}:${date}`;

function read<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked: nothing we can do */
  }
}

export function getQueue(): QueuedRegister[] {
  return read<QueuedRegister[]>(QUEUE, []);
}

/** Adds or replaces the register for this class and date. */
export function enqueue(r: QueuedRegister) {
  const q = getQueue().filter((x) => !(x.class_id === r.class_id && x.date === r.date));
  q.push(r);
  write(QUEUE, q);
}

export function isQueued(classId: string, date: string) {
  return getQueue().some((x) => x.class_id === classId && x.date === date);
}

export function getDraft(classId: string, date: string): Record<string, Mark["status"]> | null {
  return read<Record<string, Mark["status"]> | null>(DRAFT(classId, date), null);
}
export function saveDraft(classId: string, date: string, marks: Record<string, Mark["status"]> | null) {
  write(DRAFT(classId, date), marks);
}

export type UploadResult = { ok: true; present: number; absent: number; late: number } | { ok: false; offline: boolean; error: string };

export async function upload(r: { class_id: string; date: string; marks: Mark[] }): Promise<UploadResult> {
  try {
    const res = await fetch("/api/attendance", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(r) });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, present: data.present, absent: data.absent, late: data.late };
    // 5xx and sign-in problems are worth retrying later; other errors are not.
    const retry = res.status >= 500 || res.status === 401;
    return { ok: false, offline: retry, error: data.error ?? "The register couldn't be saved." };
  } catch {
    return { ok: false, offline: true, error: "No connection." };
  }
}

let flushing = false;
/** Uploads everything waiting. Returns how many uploaded and what failed for good. */
export async function flushQueue(): Promise<{ uploaded: QueuedRegister[]; failed: { r: QueuedRegister; error: string }[] }> {
  const uploaded: QueuedRegister[] = [];
  const failed: { r: QueuedRegister; error: string }[] = [];
  if (flushing || typeof navigator === "undefined" || !navigator.onLine) return { uploaded, failed };
  flushing = true;
  try {
    for (const r of getQueue()) {
      const res = await upload(r);
      if (res.ok) {
        uploaded.push(r);
        write(QUEUE, getQueue().filter((x) => !(x.class_id === r.class_id && x.date === r.date)));
        saveDraft(r.class_id, r.date, null);
      } else if (!res.offline) {
        failed.push({ r, error: res.error });
        write(QUEUE, getQueue().filter((x) => !(x.class_id === r.class_id && x.date === r.date)));
      } else break; // still offline or the server is busy: try again later
    }
  } finally {
    flushing = false;
  }
  return { uploaded, failed };
}
