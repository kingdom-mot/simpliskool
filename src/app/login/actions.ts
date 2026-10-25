"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { SCHOOL_COOKIE } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type PinState = { error: string | null };

const PinForm = z.object({
  school: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{3,40}$/),
  admission: z.string().trim().min(1).max(40),
  pin: z.string().regex(/^\d{4,6}$/),
});

const NO_MATCH = "Those details don't match. Check your school code, admission number and PIN, then try again.";

/** Student sign-in with school code + admission number + PIN. */
export async function signInWithPin(_prev: PinState, formData: FormData): Promise<PinState> {
  const parsed = PinForm.safeParse({
    school: formData.get("school"),
    admission: formData.get("admission"),
    pin: formData.get("pin"),
  });
  if (!parsed.success) return { error: NO_MATCH };
  const { school, admission, pin } = parsed.data;

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: "Student sign-in isn't set up yet. Please tell your school office." };
  }

  const { data, error } = await admin
    .rpc("verify_student_pin", { p_school_slug: school, p_admission_no: admission, p_pin: pin })
    .single<{ status: string; student_id: string | null; school_id: string | null; user_id: string | null; locked_until: string | null }>();

  if (error || !data) return { error: "We couldn't sign you in just now. Please try again in a minute." };
  if (data.status === "locked") {
    return { error: "Too many wrong PINs. For your safety, please wait 15 minutes, or ask your class teacher to reset your PIN." };
  }
  if (data.status !== "ok" || !data.user_id || !data.school_id) return { error: NO_MATCH };

  // Turn the verified PIN into a normal Supabase session without sending any email.
  const { data: userRes } = await admin.auth.admin.getUserById(data.user_id);
  const email = userRes?.user?.email;
  if (!email) return { error: "Your account isn't ready yet. Please ask your school office to reset your PIN." };

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const tokenHash = link?.properties?.hashed_token;
  if (linkError || !tokenHash) return { error: "We couldn't sign you in just now. Please try again in a minute." };

  const supabase = createClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash: tokenHash });
  if (verifyError) return { error: "We couldn't sign you in just now. Please try again in a minute." };

  cookies().set(SCHOOL_COOKIE, data.school_id, { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 60 * 60 * 24 * 180 });
  redirect("/student");
}
