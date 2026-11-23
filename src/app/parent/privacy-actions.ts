"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/components/forms";
import { requireSchool } from "@/lib/auth";
import { LEGAL_VERSION } from "@/lib/legal";
import { schoolEmails } from "@/lib/platform-mail";
import { emailFromSchool } from "@/lib/school-email";
import { createAdminClient } from "@/lib/supabase/admin";

const KINDS = ["access", "correct", "delete", "object", "other"] as const;

/** A parent confirms they've seen the privacy notice (kept as a record for the school). */
export async function acknowledgeNotice(): Promise<ActionState> {
  const { supabase, school } = await requireSchool(["parent"]);
  const { error } = await supabase.rpc("accept_legal", { p_school: school.id, p_documents: ["parent_notice"], p_version: LEGAL_VERSION });
  if (error) return { error: "We couldn't save that. Try again." };
  revalidatePath("/parent");
  return { ok: true, message: "Thank you.", at: Date.now() };
}

/** A parent asks the school to show, correct or delete data; the owner and admins are told by email. */
export async function sendPrivacyRequest(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, school, fullName } = await requireSchool(["parent"]);
  const kind = KINDS.find((k) => k === fd.get("kind"));
  const student = String(fd.get("student") ?? "") || null;
  const details = String(fd.get("details") ?? "").trim();
  if (!kind) return { error: "Choose what you'd like the school to do." };
  if (details.length < 3) return { error: "Tell the school a little more about your request." };
  if (details.length > 2000) return { error: "Please keep it under 2,000 characters." };
  const { error } = await supabase.rpc("make_privacy_request", { p_school: school.id, p_kind: kind, p_student: student, p_details: details });
  if (error) return { error: error.code === "P0001" ? error.message : "We couldn't send your request. Try again." };
  const admins = await schoolEmails(createAdminClient(), school.id, ["owner", "admin"]);
  for (const to of admins)
    await emailFromSchool(school.id, {
      to,
      heading: "New privacy request from a parent",
      paragraphs: [`${fullName} sent a privacy request. Please reply from Data protection in the admin portal.`, details],
      button: { label: "Open data protection", href: "/admin/data-protection" },
    });
  revalidatePath("/parent/contact");
  return { ok: true, message: "Request sent. The school will reply here and by email.", at: Date.now() };
}
