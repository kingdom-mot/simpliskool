"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/components/forms";
import { setFlash } from "@/lib/flash";
import { logPlatform, requirePlatform } from "@/lib/platform";
import { schoolEmails, teamEmail } from "@/lib/platform-mail";
import { deleteSchoolCompletely } from "@/lib/school-delete";

const PATH = "/super/privacy";
const lagosToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date());

/** Deletes a school whose owner asked for it, once the 30 days have passed. */
export async function deleteSchoolNow(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requirePlatform("privacy");
  if (!ctx.can("platform")) return { error: "Only a super admin can delete a school." };
  const id = String(fd.get("school_id") ?? "");
  const { data: req } = await ctx.admin.from("school_deletion_requests").select("delete_after, cancelled_at, schools(name, is_demo)").eq("school_id", id).maybeSingle<{ delete_after: string; cancelled_at: string | null; schools: { name: string; is_demo: boolean } | null }>();
  if (!req || req.cancelled_at || !req.schools) return { error: "There's no deletion request for this school." };
  if (req.schools.is_demo) return { error: "The demo schools can't be deleted here." };
  if (req.delete_after > lagosToday()) return { error: `Not yet: the owner can cancel until ${req.delete_after}.` };
  if (String(fd.get("confirm") ?? "").trim().toLowerCase() !== req.schools.name.trim().toLowerCase()) return { error: `Type the school's name exactly ("${req.schools.name}") to confirm.` };
  const owners = await schoolEmails(ctx.admin, id, ["owner"]);
  const done = await deleteSchoolCompletely(ctx.admin, id, { id: ctx.user.id, name: ctx.fullName });
  if ("error" in done) return { error: done.error };
  if (owners.length) await teamEmail(owners, `${done.name} has been deleted from Simpliskool`, `${done.name} has been deleted`, ["As you asked, every record your school had in Simpliskool has now been deleted: students, parents, staff, results, fees and files.", "Backup copies are removed as the backups expire, normally within 30 days. Thank you for using Simpliskool."]);
  await setFlash(`${done.name} was deleted: all records, ${done.files} files and ${done.accounts} sign-ins nobody else uses.`, PATH);
  redirect(PATH);
}

/** Records a personal data breach in the register. */
export async function logIncident(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requirePlatform("privacy");
  const title = String(fd.get("title") ?? "").trim();
  const detected = String(fd.get("detected_at") ?? "");
  const people = String(fd.get("people_affected") ?? "").trim();
  if (title.length < 3) return { error: "Give the incident a short title." };
  const at = Date.parse(`${detected}:00+01:00`);
  if (!Number.isFinite(at) || at > Date.now() + 60_000) return { error: "Enter when it was found (not in the future)." };
  const { data, error } = await ctx.admin
    .from("data_incidents")
    .insert({
      title: title.slice(0, 200),
      detected_at: new Date(at).toISOString(),
      description: String(fd.get("description") ?? "").trim().slice(0, 5000) || null,
      schools_affected: String(fd.get("schools_affected") ?? "").trim().slice(0, 2000) || null,
      people_affected: people ? Math.max(0, Math.floor(Number(people)) || 0) : null,
      high_risk: fd.get("high_risk") === "1",
      logged_by: ctx.user.id,
    })
    .select("id")
    .single<{ id: number }>();
  if (error) return { error: "We couldn't save the incident." };
  await logPlatform(ctx, `Logged data incident #${data.id}`, "access", null, title);
  const inbox = process.env.SUPPORT_EMAIL;
  if (inbox) await teamEmail(inbox, `DATA INCIDENT #${data.id}: ${title}`, "A data incident was logged", [`Logged by ${ctx.fullName}. The 72-hour deadline to tell the NDPC runs from when it was found.`, "Tell affected schools within 24 hours, as our data processing agreement promises."], { label: "Open the breach register", path: PATH });
  await setFlash(`Incident #${data.id} logged. Tell affected schools within 24 hours.`, PATH, "warn");
  redirect(PATH);
}

const STEPS = { contained: "contained_at", ndpc: "ndpc_notified_at", schools: "schools_notified_at", closed: "closed_at" } as const;
const STEP_LABEL = { contained: "Marked contained", ndpc: "Recorded NDPC notified", schools: "Recorded schools notified", closed: "Closed" } as const;

/** Ticks off a step on an incident (contained, NDPC told, schools told, closed) and saves notes. */
export async function updateIncident(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requirePlatform("privacy");
  const id = Number(fd.get("id"));
  const step = String(fd.get("step") ?? "") as keyof typeof STEPS | "notes";
  if (!Number.isInteger(id)) return { error: "Choose an incident." };
  const patch: Record<string, string | null> = {};
  if (step === "notes") patch.notes = String(fd.get("notes") ?? "").trim().slice(0, 5000) || null;
  else if (step in STEPS) patch[STEPS[step]] = new Date().toISOString();
  else return { error: "Unknown step." };
  const { error } = await ctx.admin.from("data_incidents").update(patch).eq("id", id);
  if (error) return { error: "We couldn't save that." };
  await logPlatform(ctx, step === "notes" ? `Updated notes on data incident #${id}` : `${STEP_LABEL[step]} (data incident #${id})`, "access", null);
  revalidatePath(PATH);
  return { ok: true, message: "Saved.", at: Date.now() };
}
