"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/components/forms";
import { requireSchool } from "@/lib/auth";

const STAFF = ["teacher", "principal", "admin", "bursar"] as const;

const ampm = (iso: string) =>
  new Date(iso)
    .toLocaleTimeString("en-GB", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "Africa/Lagos",
    })
    .replace(" ", "")
    .toLowerCase();
const hm = (h: string) => {
  const [H, M] = h.split(":").map(Number);
  return `${H % 12 || 12}:${String(M).padStart(2, "0")}${H >= 12 ? "pm" : "am"}`;
};
const far = (m: number) =>
  m >= 1000 ? `${(m / 1000).toFixed(m >= 10000 ? 0 : 1)} km` : `${m} m`;

function refresh() {
  for (const p of ["/teacher", "/admin", "/admin/staff-attendance"])
    revalidatePath(p);
}

/** A staff member clocks themselves in or out. The phone's location is checked on the server. */
export async function selfClock(
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const { supabase, school, viewing } = await requireSchool([...STAFF]);
  if (viewing)
    return {
      error:
        "You're viewing this school as Dream Savvy. Staff clock in on their own phones.",
    };
  const parsed = z
    .object({
      kind: z.enum(["in", "out"]),
      lat: z.coerce.number().min(-90).max(90),
      lng: z.coerce.number().min(-180).max(180),
      accuracy: z.coerce.number().min(0).max(1_000_000),
    })
    .safeParse({
      kind: fd.get("kind"),
      lat: fd.get("lat"),
      lng: fd.get("lng"),
      accuracy: fd.get("accuracy"),
    });
  if (!parsed.success)
    return {
      error:
        "We couldn't read your location. Turn on Location on your phone and try again.",
    };
  const { kind, lat, lng, accuracy } = parsed.data;
  const { data, error } = await supabase.rpc("self_clock", {
    p_school: school.id,
    p_kind: kind,
    p_lat: lat,
    p_lng: lng,
    p_accuracy: accuracy,
  });
  if (error)
    return {
      error: /Too many/.test(error.message)
        ? "Too many tries today. Ask the principal for help."
        : /function/i.test(error.message)
          ? "Clocking in isn't switched on yet."
          : "We couldn't save. Please try again.",
    };
  const r = data as {
    ok: boolean;
    reason?: string;
    distance?: number;
    radius?: number;
    accuracy?: number;
    at?: string;
    late?: boolean;
    early?: boolean;
  };
  const word = kind === "in" ? "in" : "out";
  if (!r.ok) {
    const why: Record<string, string> = {
      too_far: `You're ${far(r.distance ?? 0)} from school. You can only clock ${word} at school${r.radius ? ` (within ${r.radius} m)` : ""}. The principal can see this try.`,
      too_vague:
        "Your phone couldn't find your location accurately enough. Turn on Location (GPS), move near a window or outside, wait a moment and try again.",
      not_set:
        "Your school hasn't set its location yet, so clocking in isn't open. Ask the school owner to set it on the Staff attendance page.",
      already_in: `You already clocked in${r.at ? ` at ${ampm(r.at)}` : ""}.`,
      already_out: `You already clocked out${r.at ? ` at ${ampm(r.at)}` : ""}.`,
      not_in: "Clock in first.",
      on_leave:
        "You're marked on leave today, so you can't clock in. Speak to the principal if that's wrong.",
    };
    refresh();
    return {
      error: why[r.reason ?? ""] ?? "We couldn't save. Please try again.",
    };
  }
  refresh();
  const { data: s } = await supabase
    .from("schools")
    .select("staff_late_after, staff_close_at")
    .eq("id", school.id)
    .maybeSingle<{ staff_late_after: string; staff_close_at: string | null }>();
  const at = r.at ? ampm(r.at) : "";
  if (kind === "in")
    return {
      ok: true,
      message: `Clocked in at ${at}.${r.late && s ? ` You're late: the late time is ${hm(s.staff_late_after)}.` : ""}`,
      at: Date.now(),
    };
  return {
    ok: true,
    message: `Clocked out at ${at}.${r.early && s?.staff_close_at ? ` That's before closing time (${hm(s.staff_close_at)}), so it shows as leaving early.` : ""}`,
    at: Date.now(),
  };
}

/** "I'm on official duty": the principal approves or declines. */
export async function requestDuty(
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const { supabase, school, viewing } = await requireSchool([...STAFF]);
  if (viewing) return { error: "Read only." };
  const note = String(fd.get("note") ?? "").trim();
  if (note.length < 3)
    return {
      error:
        "Say where you are and why, for example “At the exam board in Ikeja”.",
    };
  const { error } = await supabase.rpc("request_duty", {
    p_school: school.id,
    p_note: note.slice(0, 200),
  });
  if (error)
    return { error: "We couldn't send your request. Please try again." };
  refresh();
  return { ok: true, message: "Sent to the principal.", at: Date.now() };
}

export async function decideDuty(
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const { supabase, school } = await requireSchool(["owner", "principal"]);
  const user = z.string().uuid().safeParse(fd.get("user"));
  const date = String(fd.get("date") ?? "");
  const approve = fd.get("decision") === "approve";
  if (!user.success || !/^\d{4}-\d{2}-\d{2}$/.test(date))
    return { error: "Choose a request." };
  const { error } = await supabase.rpc("decide_duty", {
    p_school: school.id,
    p_user: user.data,
    p_date: date,
    p_approve: approve,
  });
  if (error)
    return {
      error: /No request/.test(error.message)
        ? "That request was already decided."
        : "We couldn't save. Please try again.",
    };
  refresh();
  return {
    ok: true,
    message: approve ? "Official duty approved." : "Request declined.",
    at: Date.now(),
  };
}

/** Owner only: the school's location, allowed distance, late time and closing time. */
export async function saveClockSettings(
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const { supabase, school } = await requireSchool(["owner"]);
  const time = /^([01]\d|2[0-3]):[0-5]\d$/;
  const late = String(fd.get("late_after") ?? "");
  const close = String(fd.get("close_at") ?? "");
  const latRaw = String(fd.get("lat") ?? "").trim();
  const lngRaw = String(fd.get("lng") ?? "").trim();
  const radius = Number(fd.get("radius"));
  if (!time.test(late)) return { error: "Enter the late time, like 07:45." };
  if (close && !time.test(close))
    return { error: "Enter the closing time, like 15:00." };
  if (close && close <= late)
    return { error: "Closing time must be after the late time." };
  if (!Number.isInteger(radius) || radius < 30 || radius > 1000)
    return { error: "Allowed distance must be between 30 and 1000 metres." };
  let lat: number | null = null;
  let lng: number | null = null;
  if (latRaw || lngRaw) {
    lat = Number(latRaw);
    lng = Number(lngRaw);
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      Math.abs(lat) > 90 ||
      Math.abs(lng) > 180
    )
      return {
        error:
          "That location doesn't look right. Use “Use my current location” while standing at school.",
      };
  }
  const { error } = await supabase.rpc("set_staff_clock_settings", {
    p_school: school.id,
    p_lat: lat,
    p_lng: lng,
    p_radius: radius,
    p_late: late,
    p_close: close || null,
  });
  if (error)
    return {
      error: /function/i.test(error.message)
        ? "Run database update 0023 first."
        : "We couldn't save. Please try again.",
    };
  refresh();
  return {
    ok: true,
    message:
      lat === null
        ? "Saved. Staff can't clock in until you set the school's location."
        : "Saved. Staff can now clock in and out at school.",
    at: Date.now(),
  };
}
