import { PortalShell } from "@/components/PortalShell";
import { PageHero } from "@/components/admin";
import { GROUP_ROLE_LABEL, type GroupCtx } from "@/lib/group";

/** Side menu and coloured header for the group pages. */
export function GroupShell({ ctx, active, title, sub, actions, children }: { ctx: GroupCtx; active: string; title: string; sub?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <PortalShell school={ctx.shell} roleLabel={`${GROUP_ROLE_LABEL[ctx.role]} · ${ctx.branches.length} branch${ctx.branches.length === 1 ? "" : "es"}`} fullName={ctx.fullName} groups={ctx.nav} active={active}>
      <div className="flex flex-col gap-5">
        <PageHero title={title} sub={sub} actions={actions} />
        {children}
      </div>
    </PortalShell>
  );
}
