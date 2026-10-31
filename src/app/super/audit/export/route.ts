import { requirePlatform } from "@/lib/platform";
import { auditRows, type AuditKind } from "@/lib/platform-audit";
import { csvCell } from "@/lib/platform-data";

/** The audit log (as filtered on the page), for Excel. */
export async function GET(req: Request) {
  const ctx = await requirePlatform("audit");
  const sp = new URL(req.url).searchParams;
  const t = sp.get("tab");
  const tab: AuditKind | null = ctx.can("audit.all") ? (t === "view" || t === "money" || t === "access" ? t : null) : "money";
  const rows = await auditRows(ctx.admin, { kinds: tab ? [tab] : null, q: (sp.get("q") ?? "").slice(0, 80), limit: 5000 });
  const lines = [["When", "Who", "What they did", "Kind", "School", "Reason or detail"], ...rows.map((r) => [r.at, r.who, r.action, r.kind, r.school, r.detail])];
  await ctx.admin.from("platform_audit").insert({ actor_id: ctx.user.id, actor_name: ctx.fullName, action: "Exported the audit log", kind: "other", detail: `${rows.length} entries` });
  return new Response("﻿" + lines.map((l) => l.map(csvCell).join(",")).join("\r\n"), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="simpliskool-audit-log.csv"' } });
}
