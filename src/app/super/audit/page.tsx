import { Flash } from "@/components/Flash";
import { LinkTabs, Scroll, SuperShell } from "@/components/super";
import { Empty, Pill } from "@/components/ui";
import { lagosTime, requirePlatform } from "@/lib/platform";
import { auditRows, type AuditKind } from "@/lib/platform-audit";

export const metadata = { title: "Audit log — Simpliskool back office" };

const KIND: Record<AuditKind, { l: string; k: "warn" | "good" | "bad" | "info" }> = { view: { l: "Viewed", k: "warn" }, money: { l: "Money", k: "bad" }, access: { l: "Access", k: "good" }, other: { l: "Other", k: "info" } };

export default async function SuperAudit(props: { searchParams: Promise<{ tab?: string; q?: string }> }) {
  const sp = await props.searchParams;
  const ctx = await requirePlatform("audit");
  const all = ctx.can("audit.all");
  const tab = all ? (["view", "money", "access"].includes(sp.tab ?? "") ? (sp.tab as AuditKind) : "all") : "money";
  const q = (sp.q ?? "").slice(0, 80);
  const rows = await auditRows(ctx.admin, { kinds: tab === "all" ? null : [tab], q, limit: 300 });
  const href = (t: string) => `/super/audit?${new URLSearchParams({ ...(t !== "all" ? { tab: t } : {}), ...(q ? { q } : {}) })}`;

  return (
    <SuperShell
      ctx={ctx}
      active="audit"
      title="Audit log"
      sub={`Everything sensitive done by the Dream Savvy team, and payout account changes by schools. Entries can't be edited or deleted.${all ? "" : " Your role sees money entries."}`}
      actions={
        <a className="s-btn2" href={`/super/audit/export?${new URLSearchParams({ ...(tab !== "all" ? { tab } : {}), ...(q ? { q } : {}) })}`}>
          Export (CSV)
        </a>
      }
    >
      <Flash />
      <div className="flex flex-wrap items-end gap-3">
        <form className="flex min-w-[220px] flex-1 items-end gap-2" action="/super/audit">
          {tab !== "all" && <input type="hidden" name="tab" value={tab} />}
          <div className="flex-1">
            <label className="label" htmlFor="aq">
              Search
            </label>
            <input id="aq" name="q" type="search" className="sk-input" defaultValue={q} placeholder="Person, school or action" />
          </div>
          <button className="s-btn2">Search</button>
        </form>
        {all && (
          <LinkTabs
            label="Kind of action"
            current={tab}
            tabs={[
              ["all", "All", href("all")],
              ["view", "Viewed as a school", href("view")],
              ["money", "Money", href("money")],
              ["access", "Access", href("access")],
            ]}
          />
        )}
      </div>
      {rows.length ? (
        <Scroll label="Audit log entries">
          <table className="tbl min-w-[900px]">
            <caption className="sr-only">Audit log entries, newest first</caption>
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Who</th>
                <th scope="col">What they did</th>
                <th scope="col">School</th>
                <th scope="col">Reason or detail</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap text-[13px]">{lagosTime(r.at)}</td>
                  <td className="font-bold text-[#173B70]">{r.who}</td>
                  <td>
                    <span className="flex flex-wrap items-center gap-1.5">
                      <Pill kind={KIND[r.kind].k}>{KIND[r.kind].l}</Pill>
                      {r.action}
                    </span>
                  </td>
                  <td>{r.school}</td>
                  <td className="text-[13px]">{r.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Scroll>
      ) : (
        <Empty>Nothing matches.</Empty>
      )}
    </SuperShell>
  );
}
