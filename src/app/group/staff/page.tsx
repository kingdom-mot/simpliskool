import { GroupShell } from "@/components/GroupShell";
import { Empty, Pill } from "@/components/ui";
import { ROLE_LABEL, type Role } from "@/lib/auth";
import { lagosToday, requireGroup } from "@/lib/group";
import { branchStats } from "@/lib/group-stats";
import { classLabel } from "@/lib/teaching";

export const metadata = { title: "Staff across branches" };

const STAFF = ["owner", "admin", "principal", "bursar", "teacher"];
type M = { school_id: string; user_id: string; role: Role; profiles: { full_name: string | null } | null };
type CS = { school_id: string; teacher_id: string; classes: { name: string; arm: string } | null; subjects: { name: string } | null };
type SA = { school_id: string; user_id: string; clock_in: string | null; date: string };

export default async function GroupStaff(props: { searchParams: Promise<{ branch?: string; q?: string }> }) {
  const sp = await props.searchParams;
  const ctx = await requireGroup("staff");
  const branch = ctx.ids.includes(sp.branch ?? "") ? sp.branch! : null;
  const ids = branch ? [branch] : ctx.ids;
  const month = `${lagosToday().slice(0, 7)}-01`;
  const [stats, { data: mem }, { data: cs }, { data: sa }, { data: lateRows }] = await Promise.all([
    branchStats(ctx),
    ids.length ? ctx.admin.from("memberships").select("school_id, user_id, role, profiles(full_name)").in("school_id", ids).in("role", STAFF).returns<M[]>() : Promise.resolve({ data: [] as M[] }),
    ids.length ? ctx.admin.from("class_subjects").select("school_id, teacher_id, classes(name, arm), subjects(name)").in("school_id", ids).not("teacher_id", "is", null).returns<CS[]>() : Promise.resolve({ data: [] as CS[] }),
    ids.length ? ctx.admin.from("staff_attendance").select("school_id, user_id, clock_in, date").in("school_id", ids).gte("date", month).not("clock_in", "is", null).returns<SA[]>() : Promise.resolve({ data: [] as SA[] }),
    ids.length ? ctx.admin.from("schools").select("id, staff_late_after").in("id", ids).returns<{ id: string; staff_late_after: string }[]>() : Promise.resolve({ data: [] as { id: string; staff_late_after: string }[] }),
  ]);
  const lateAfter = new Map((lateRows ?? []).map((r) => [r.id, r.staff_late_after.slice(0, 5)]));
  const name = new Map(ctx.branches.map((b) => [b.id, b.name]));
  const hm = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
  // One row per person per branch.
  const people = new Map<string, { school: string; user: string; name: string; roles: Role[] }>();
  for (const m of mem ?? []) {
    const k = `${m.school_id}:${m.user_id}`;
    const p = people.get(k) ?? { school: m.school_id, user: m.user_id, name: m.profiles?.full_name?.trim() || "No name yet", roles: [] };
    p.roles.push(m.role);
    people.set(k, p);
  }
  const q = (sp.q ?? "").trim().toLowerCase();
  const rows = [...people.values()]
    .filter((p) => !q || p.name.toLowerCase().includes(q))
    .sort((a, b) => (name.get(a.school) ?? "").localeCompare(name.get(b.school) ?? "") || a.name.localeCompare(b.name))
    .map((p) => {
      const teaches = (cs ?? []).filter((c) => c.school_id === p.school && c.teacher_id === p.user);
      const subj = [...new Set(teaches.map((t) => t.subjects?.name ?? ""))].filter(Boolean);
      const days = (sa ?? []).filter((s) => s.school_id === p.school && s.user_id === p.user);
      const onTime = days.filter((d) => hm(d.clock_in!) <= (lateAfter.get(p.school) ?? "07:45")).length;
      return { ...p, teaches: subj.length ? `${subj.join(", ")} · ${teaches.map((t) => (t.classes ? classLabel(t.classes.name, t.classes.arm) : "")).filter((v, i, a) => v && a.indexOf(v) === i).slice(0, 4).join(", ")}` : "—", days: days.length, onTime };
    });

  return (
    <GroupShell ctx={ctx} active="staff" title="Staff across branches" sub={`${rows.length} staff · attendance is marked by each branch; you see it here, read only.`}>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {stats
          .filter((s) => !branch || s.id === branch)
          .map((s) => (
            <div key={s.id} className="flex flex-col gap-1 rounded-[18px] border border-[#E3EAF3] bg-white p-4">
              <span className="text-sm font-bold text-brand-slate">{s.name} · today</span>
              <span className="font-heading text-2xl font-black text-c1">
                {s.clockedIn} / {s.staff}
              </span>
              <span className="text-xs text-[#4A5A70]">{s.lateStaff} late</span>
            </div>
          ))}
      </div>
      <form method="get" className="flex flex-wrap items-end gap-3 rounded-[18px] border border-[#E3EAF3] bg-white p-4">
        <div className="min-w-[200px]">
          <label className="label" htmlFor="gs-branch">
            Branch
          </label>
          <select id="gs-branch" name="branch" defaultValue={branch ?? ""} className="sk-input sk-select">
            <option value="">All branches</option>
            {ctx.branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[200px] flex-1">
          <label className="label" htmlFor="gs-q">
            Search
          </label>
          <input id="gs-q" name="q" defaultValue={sp.q ?? ""} className="sk-input" placeholder="Name" />
        </div>
        <button className="s-btn2">Show</button>
      </form>
      <section aria-labelledby="sl-h" className="flex flex-col gap-3 rounded-[18px] border border-t-[5px] border-[#E3EAF3] border-t-c2 bg-white p-[22px]">
        <h2 id="sl-h" className="text-lg !text-c1">
          Staff list
        </h2>
        {rows.length ? (
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Staff list: scroll sideways to see more">
            <table className="tbl min-w-[760px]">
              <caption className="sr-only">Staff across branches</caption>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Branch</th>
                  <th scope="col">Role</th>
                  <th scope="col">Teaches</th>
                  <th scope="col">On time this month</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const p = r.days ? Math.round((r.onTime / r.days) * 100) : null;
                  return (
                    <tr key={`${r.school}:${r.user}`}>
                      <th scope="row">{r.name}</th>
                      <td>{name.get(r.school)}</td>
                      <td>{r.roles.map((x) => ROLE_LABEL[x]).join(", ")}</td>
                      <td>{r.teaches}</td>
                      <td>{p === null ? "No clock-ins" : <Pill kind={p >= 90 ? "good" : p >= 75 ? "warn" : "bad"}>{`${p}% of ${r.days} days`}</Pill>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>No staff found.</Empty>
        )}
        <p className="text-[13px] text-[#4A5A70]">To add, remove or move staff, open the branch and use its Staff page.</p>
      </section>
    </GroupShell>
  );
}
