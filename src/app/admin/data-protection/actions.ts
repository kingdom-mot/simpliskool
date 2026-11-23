"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/components/forms";
import { requireSchool } from "@/lib/auth";
import { isDemoRequest } from "@/lib/demo";
import { setFlash } from "@/lib/flash";
import { LEGAL_VERSION } from "@/lib/legal";
import { teamEmail } from "@/lib/platform-mail";
import { emailFromSchool } from "@/lib/school-email";
import { createAdminClient } from "@/lib/supabase/admin";

const PATH = "/admin/data-protection";
const fail = (e: { code?: string; message: string }, fallback: string): ActionState => ({ error: e.code === "P0001" ? e.message : fallback });

/** The owner accepts the current terms and data processing agreement for the school. */
export async function acceptAgreements(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, school } = await requireSchool(["owner"]);
  if (fd.get("terms") !== "1" || fd.get("dpa") !== "1") return { error: "Tick both boxes to accept." };
  const { error } = await supabase.rpc("accept_legal", { p_school: school.id, p_documents: ["terms", "dpa"], p_version: LEGAL_VERSION });
  if (error) return fail(error, "We couldn't save that. Try again.");
  await setFlash("Thank you. The terms and data processing agreement are accepted for the school.", PATH);
  redirect(PATH);
}

/** The owner or an admin answers a privacy request; the person who asked gets the answer by email. */
export async function answerRequest(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, school } = await requireSchool(["owner", "admin"]);
  const id = Number(fd.get("id"));
  const status = String(fd.get("status") ?? "");
  const response = String(fd.get("response") ?? "").trim().slice(0, 2000);
  if (!Number.isInteger(id) || !["open", "done", "declined"].includes(status)) return { error: "Choose a request." };
  if (status !== "open" && response.length < 3) return { error: "Write a short reply so the person knows what happened." };
  const { error } = await supabase.rpc("answer_privacy_request", { p_id: id, p_status: status, p_response: response });
  if (error) return fail(error, "We couldn't save the reply. Try again.");
  if (status !== "open") {
    const { data: r } = await supabase.from("privacy_requests").select("requested_by").eq("id", id).maybeSingle<{ requested_by: string | null }>();
    if (r?.requested_by) {
      const { data: p } = await createAdminClient().from("profiles").select("email").eq("id", r.requested_by).maybeSingle<{ email: string | null }>();
      if (p?.email)
        await emailFromSchool(school.id, {
          to: p.email,
          heading: status === "done" ? "Your privacy request is done" : "About your privacy request",
          paragraphs: [`${school.name} has replied to your privacy request:`, response],
        });
    }
  }
  revalidatePath(PATH);
  return { ok: true, message: status === "open" ? "Request reopened." : "Reply saved and sent.", at: Date.now() };
}

/** The owner asks for the whole school to be deleted in 30 days. */
export async function requestDeletion(_prev: ActionState, fd: FormData): Promise<ActionState> {
  if (await isDemoRequest()) return { error: "The demo school can't be deleted. In your own school, this deletes everything after 30 days." };
  const { supabase, school, fullName } = await requireSchool(["owner"]);
  const typed = String(fd.get("confirm") ?? "").trim().toLowerCase();
  if (typed !== school.name.trim().toLowerCase()) return { error: `Type the school's name exactly ("${school.name}") to confirm.` };
  const reason = String(fd.get("reason") ?? "").trim().slice(0, 1000);
  const { data, error } = await supabase.rpc("request_school_deletion", { p_school: school.id, p_reason: reason });
  if (error) return fail(error, "We couldn't send the request. Try again.");
  const when = new Date(`${data}T12:00:00+01:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const inbox = process.env.SUPPORT_EMAIL;
  if (inbox) await teamEmail(inbox, `${school.name} asked to be deleted`, `${school.name} asked for its account to be deleted`, [`Asked by ${fullName}. Delete on or after ${when}.`, reason ? `Reason: ${reason}` : "No reason given."], { label: "Open data protection", path: "/super/privacy" });
  await setFlash(`Deletion is booked for ${when}. Download your data before then. You can cancel any time until that day.`, PATH, "warn");
  redirect(PATH);
}

export async function cancelDeletion(): Promise<ActionState> {
  const { supabase, school, fullName } = await requireSchool(["owner"]);
  const { error } = await supabase.rpc("cancel_school_deletion", { p_school: school.id });
  if (error) return fail(error, "We couldn't cancel. Try again, or contact support.");
  const inbox = process.env.SUPPORT_EMAIL;
  if (inbox) await teamEmail(inbox, `${school.name} cancelled its deletion`, `${school.name} is staying`, [`${fullName} cancelled the deletion request.`]);
  await setFlash("Deletion cancelled. Nothing will be deleted.", PATH);
  redirect(PATH);
}
