import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;
const BUCKETS = ["school-site", "school-logos", "learning"] as const;

/** Every file under `prefix` in a storage bucket (folders are walked one level at a time). */
async function filesUnder(admin: Admin, bucket: string, prefix: string): Promise<string[]> {
  const out: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 1000, offset });
    if (error || !data?.length) break;
    for (const item of data) {
      const path = `${prefix}/${item.name}`;
      if (item.id === null) out.push(...(await filesUnder(admin, bucket, path)));
      else out.push(path);
    }
    if (data.length < 1000) break;
  }
  return out;
}

/**
 * Deletes a school completely: its files, every record (the database removes linked rows with
 * the school), and the sign-ins of people who belonged to no other school.
 * The audit log keeps one line saying it happened.
 */
export async function deleteSchoolCompletely(admin: Admin, schoolId: string, by: { id: string; name: string }) {
  const { data: school } = await admin.from("schools").select("id, name").eq("id", schoolId).maybeSingle<{ id: string; name: string }>();
  if (!school) return { error: "School not found." };

  // People linked to the school, so their sign-ins can be removed if they have nowhere else to go.
  const [{ data: m }, { data: g }, { data: s }] = await Promise.all([
    admin.from("memberships").select("user_id").eq("school_id", schoolId).returns<{ user_id: string }[]>(),
    admin.from("guardians").select("user_id").eq("school_id", schoolId).returns<{ user_id: string }[]>(),
    admin.from("students").select("user_id").eq("school_id", schoolId).not("user_id", "is", null).returns<{ user_id: string }[]>(),
  ]);
  const people = [...new Set([...(m ?? []), ...(g ?? []), ...(s ?? [])].map((r) => r.user_id))];

  let files = 0;
  for (const bucket of BUCKETS) {
    const paths = await filesUnder(admin, bucket, schoolId);
    for (let i = 0; i < paths.length; i += 100) {
      const { error } = await admin.storage.from(bucket).remove(paths.slice(i, i + 100));
      if (!error) files += Math.min(100, paths.length - i);
    }
  }

  const { error } = await admin.from("schools").delete().eq("id", schoolId);
  if (error) return { error: `The school couldn't be deleted: ${error.message}` };

  let accounts = 0;
  for (const uid of people) {
    const [a, b, c, d, e] = await Promise.all([
      admin.from("memberships").select("id", { count: "exact", head: true }).eq("user_id", uid),
      admin.from("guardians").select("id", { count: "exact", head: true }).eq("user_id", uid),
      admin.from("students").select("id", { count: "exact", head: true }).eq("user_id", uid),
      admin.from("platform_team").select("user_id", { count: "exact", head: true }).eq("user_id", uid),
      admin.from("group_members").select("user_id", { count: "exact", head: true }).eq("user_id", uid),
    ]);
    if (!a.count && !b.count && !c.count && !d.count && !e.count) {
      const { error: delErr } = await admin.auth.admin.deleteUser(uid);
      if (!delErr) accounts++;
    }
  }

  await admin.from("platform_audit").insert({ actor_id: by.id, actor_name: by.name, action: "Deleted a school and all its data", kind: "access", school_id: null, school_name: school.name, detail: `${files} files and ${accounts} sign-ins removed` });
  return { ok: true as const, name: school.name, files, accounts };
}
