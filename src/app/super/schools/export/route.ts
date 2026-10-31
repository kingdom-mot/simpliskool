import { requirePlatform } from "@/lib/platform";
import { csvCell, health, parentsPct, payoutState, schoolRows } from "@/lib/platform-data";

/** Every school, for Excel. */
export async function GET(req: Request) {
  const ctx = await requirePlatform("schools");
  const q = (new URL(req.url).searchParams.get("q") ?? "").toLowerCase();
  const now = Date.now();
  const rows = (await schoolRows(ctx.admin)).filter((r) => !q || [r.name, r.address, r.owner_name, r.group_name].some((v) => v?.toLowerCase().includes(q)));
  const lines = [
    ["School", "Group", "Town", "Web address", "Owner", "Owner email", "Owner phone", "Plan", "Students", "Parents joined %", "Staff", "Payout account", "Status", "Signed up", "Last active"],
    ...rows.map((r) => [r.name, r.group_name, r.address, `${r.slug}.simpliskool.com`, r.owner_name, r.owner_email, r.owner_phone, r.plan, r.students, parentsPct(r), r.staff, payoutState(r).label, health(r, now).label, r.created_at.slice(0, 10), r.last_active?.slice(0, 10) ?? ""]),
  ];
  const body = lines.map((l) => l.map(csvCell).join(",")).join("\r\n");
  return new Response("﻿" + body, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="simpliskool-schools.csv"' } });
}
