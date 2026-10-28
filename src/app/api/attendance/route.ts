import { after, NextResponse } from "next/server";
import { notifyAbsences } from "@/lib/notify";
import { smsAbsences } from "@/lib/sms-notices";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

/**
 * Saves a class register. A plain URL (not a server action) so registers saved
 * offline can still upload after the app has been updated.
 */
const body = z.object({
  class_id: z.uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  marks: z
    .array(z.object({ student_id: z.uuid(), status: z.enum(["present", "absent", "late"]) }))
    .min(1)
    .max(300),
});

const MAX_DAYS_BACK = 14;

function lagosToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date());
}

export async function POST(request: Request) {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "The register couldn't be read." }, { status: 400 });
  const { class_id, date, marks } = parsed.data;

  const today = lagosToday();
  const oldest = new Date(`${today}T12:00:00Z`);
  oldest.setUTCDate(oldest.getUTCDate() - MAX_DAYS_BACK);
  if (date > today) return NextResponse.json({ error: "You can't take a register for a future date." }, { status: 400 });
  if (date < oldest.toISOString().slice(0, 10)) return NextResponse.json({ error: `Registers older than ${MAX_DAYS_BACK} days can only be changed by the school admin.` }, { status: 400 });

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Please sign in again, then your register will upload." }, { status: 401 });

  const { data: cls } = await supabase.from("classes").select("id, school_id").eq("id", class_id).maybeSingle<{ id: string; school_id: string }>();
  if (!cls) return NextResponse.json({ error: "Class not found." }, { status: 404 });

  // Only students who are really in this class.
  const { data: inClass } = await supabase.from("students").select("id").eq("class_id", class_id).eq("status", "active");
  const allowed = new Set((inClass ?? []).map((s) => s.id));
  const rows = marks
    .filter((m) => allowed.has(m.student_id))
    .map((m) => ({ school_id: cls.school_id, student_id: m.student_id, class_id, date, status: m.status, recorded_by: auth.user!.id, synced_at: new Date().toISOString() }));
  if (!rows.length) return NextResponse.json({ error: "None of these students are in this class any more." }, { status: 400 });

  const { error } = await supabase.from("attendance").upsert(rows, { onConflict: "student_id,date" });
  if (error) {
    const denied = error.code === "42501" || /row-level security/i.test(error.message);
    return NextResponse.json({ error: denied ? "Only this class's teachers can take its register." : "The register couldn't be saved. Please try again." }, { status: denied ? 403 : 500 });
  }

  const count = (s: string) => rows.filter((r) => r.status === s).length;

  // Email parents of absent children once the teacher has their answer. Only for today
  // or yesterday (a register saved offline overnight); older corrections don't email.
  const yesterday = new Date(`${today}T12:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  if (count("absent") && date >= yesterday.toISOString().slice(0, 10)) {
    after(async () => {
      try {
        await notifyAbsences(cls.school_id, date, class_id);
      } catch (e) {
        console.error("Absence emails failed", e);
      }
      try {
        await smsAbsences(cls.school_id, date, class_id);
      } catch (e) {
        console.error("Absence texts failed", e);
      }
    });
  }
  return NextResponse.json({ ok: true, saved: rows.length, present: count("present"), absent: count("absent"), late: count("late"), skipped: marks.length - rows.length });
}
