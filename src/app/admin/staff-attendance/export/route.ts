import { requireSchool } from "@/lib/auth";

type Month = { name: string; present: number; late: number; absent: number; leave: number; duty: number; avg_in: string | null };

export async function GET(req: Request) {
  const url = new URL(req.url);
  const { supabase, school } = await requireSchool(["owner", "admin", "principal"]);
  const month = url.searchParams.get("month") ?? "";
  if (!/^\d{4}-\d{2}$/.test(month)) return new Response("Choose a month", { status: 400 });
  const { data } = await supabase.rpc("staff_attendance_month", { p_school: school.id, p_month: `${month}-01` });
  const rows = (data as Month[] | null) ?? [];
  const cell = (v: string | number | null) => {
    let s = v === null ? "" : String(v);
    if (/^[=+\-@]/.test(s)) s = `'${s}`;
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [["Staff", "Days present", "Late", "Absent", "Leave", "Official duty", "Average clock in"], ...rows.map((r) => [r.name, r.present, r.late, r.absent, r.leave, r.duty, r.avg_in ?? ""])];
  const csv = "﻿" + lines.map((l) => l.map(cell).join(",")).join("\r\n");
  return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${school.slug}-staff-attendance-${month}.csv"`, "cache-control": "no-store" } });
}
