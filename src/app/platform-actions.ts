"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { VIEW_COOKIE } from "@/lib/viewing";

/** Hides a Dream Savvy notice for this person. */
export async function dismissNotice(fd: FormData) {
  const { supabase, user } = await requireUser();
  const id = String(fd.get("notice_id") ?? "");
  const school = String(fd.get("school_id") ?? "");
  const back = String(fd.get("back") ?? "/admin");
  if (/^[0-9a-f-]{36}$/.test(id)) {
    await supabase.from("notice_reads").upsert({ notice_id: id, user_id: user.id, school_id: /^[0-9a-f-]{36}$/.test(school) ? school : null }, { onConflict: "notice_id,user_id", ignoreDuplicates: true });
  }
  redirect(back.startsWith("/") && !back.startsWith("//") ? back : "/admin");
}

/** Ends "view as this school" and goes back to the school's page in the back office. */
export async function stopViewing() {
  const { user, fullName } = await requireUser();
  const jar = await cookies();
  const id = jar.get(VIEW_COOKIE)?.value;
  jar.delete(VIEW_COOKIE);
  let school: string | null = null;
  if (id && /^[0-9a-f-]{36}$/.test(id)) {
    const admin = createAdminClient();
    const { data } = await admin.from("platform_views").update({ ended_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id).is("ended_at", null).select("school_id, started_at").maybeSingle<{ school_id: string; started_at: string }>();
    if (data) {
      school = data.school_id;
      const mins = Math.max(1, Math.round((Date.now() - Date.parse(data.started_at)) / 60_000));
      await admin.from("platform_audit").insert({ actor_id: user.id, actor_name: fullName, action: "Stopped viewing", kind: "view", school_id: data.school_id, school_name: (await admin.from("schools").select("name").eq("id", data.school_id).maybeSingle<{ name: string }>()).data?.name ?? null, detail: `${mins} minute${mins === 1 ? "" : "s"} · read only` });
    }
  }
  redirect(school ? `/super/schools/${school}?tab=acc` : "/super/schools");
}
