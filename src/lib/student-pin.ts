"use server";

import { createAdminClient, studentLoginEmail } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type PinResult =
  | { ok: true; pin: string; studentName: string; admissionNo: string }
  | { ok: false; error: string };

/**
 * Issues a new PIN for a student and makes sure they have a sign-in account.
 * Permission is checked in the database (school admins, principals, and teachers
 * of the student's class). The PIN is returned once and never stored in plain text.
 */
export async function resetStudentPin(studentId: string): Promise<PinResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("reset_student_pin", { p_student: studentId })
    .single<{ pin: string; student_id: string; school_id: string; user_id: string | null; admission_no: string; full_name: string }>();

  if (error || !data) {
    return { ok: false, error: error?.message.includes("permission") ? "You can't reset this student's PIN." : "We couldn't reset the PIN. Please try again." };
  }

  // PIN sign-in uses a private account per student. Create it if missing, or if the
  // student was using their own phone or email until now.
  const admin = createAdminClient();
  let needsAccount = !data.user_id;
  if (data.user_id) {
    const { data: u } = await admin.auth.admin.getUserById(data.user_id);
    needsAccount = u?.user?.email !== studentLoginEmail(data.student_id);
  }
  if (needsAccount) {
    let userId: string | undefined;
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: studentLoginEmail(data.student_id),
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    userId = created?.user?.id;
    if (!userId && createError) {
      const { data: existing } = await admin.from("profiles").select("id").eq("email", studentLoginEmail(data.student_id)).maybeSingle<{ id: string }>();
      userId = existing?.id;
    }
    if (!userId) return { ok: false, error: "The PIN was reset but the student's account couldn't be created. Please try again." };

    await admin.from("students").update({ user_id: userId }).eq("id", data.student_id);
    await admin.from("memberships").upsert(
      { school_id: data.school_id, user_id: userId, role: "student" },
      { onConflict: "school_id,user_id,role", ignoreDuplicates: true },
    );
  }

  return { ok: true, pin: data.pin, studentName: data.full_name, admissionNo: data.admission_no };
}
