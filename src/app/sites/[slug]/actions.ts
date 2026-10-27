"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  school_id: z.string().uuid(),
  child_name: z.string().trim().min(2, "Enter the child's name"),
  date_of_birth: z.string().optional(),
  class_applied: z.string().trim().optional(),
  parent_name: z.string().trim().min(2, "Enter your name"),
  parent_phone: z.string().trim().min(7, "Enter a phone number"),
  parent_email: z.string().trim().email("Enter a valid email").optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional(),
});

export type ApplyState = { ok?: boolean; error?: string };

export async function applyForAdmission(_prev: ApplyState, formData: FormData): Promise<ApplyState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const d = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("admission_applications").insert({
    school_id: d.school_id,
    child_name: d.child_name,
    date_of_birth: d.date_of_birth || null,
    class_applied: d.class_applied || null,
    parent_name: d.parent_name,
    parent_phone: d.parent_phone,
    parent_email: d.parent_email || null,
    notes: d.notes || null,
  });
  if (error) return { error: "We couldn't send your application. Please try again." };
  return { ok: true };
}
