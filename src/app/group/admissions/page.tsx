import { GroupShell } from "@/components/GroupShell";
import { Empty } from "@/components/ui";
import { requireGroup } from "@/lib/group";
import { openBranch } from "../actions";

export const metadata = { title: "Group admissions" };

const yearAgo = () => new Date(Date.now() - 365 * 86400000).toISOString();

const STAGES = [
  ["new", "Applied"],
  ["assessment", "Assessment booked"],
  ["offer", "Offered"],
  ["enrolled", "Enrolled"],
  ["declined", "Declined"],
] as const;

export default async function GroupAdmissions() {
  const ctx = await requireGroup("admissions");
  const since = yearAgo();
  const { data } = ctx.ids.length ? await ctx.admin.from("admission_applications").select("school_id, status").in("school_id", ctx.ids).gte("created_at", since).returns<{ school_id: string; status: string }[]>() : { data: [] as { school_id: string; status: string }[] };
  const { data: kids } = ctx.ids.length ? await ctx.admin.from("students").select("school_id").in("school_id", ctx.ids).eq("status", "active").returns<{ school_id: string }[]>() : { data: [] as { school_id: string }[] };
  const n = (school: string | null, st: string) => (data ?? []).filter((a) => (!school || a.school_id === school) && a.status === st).length;
  const enrolled = (school: string) => (kids ?? []).filter((k) => k.school_id === school).length;

  return (
    <GroupShell ctx={ctx} active="admissions" title="Admissions" sub="Applications over the last 12 months across all branches.">
      <section aria-labelledby="ad-h" className="flex flex-col gap-3 rounded-[18px] border border-t-[5px] border-[#E3EAF3] border-t-c2 bg-white p-[22px]">
        <h2 id="ad-h" className="text-lg !text-c1">
          Applications by branch and stage
        </h2>
        {(data ?? []).length || ctx.branches.length ? (
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Applications: scroll sideways to see more">
            <table className="tbl min-w-[760px]">
              <caption className="sr-only">Applications by branch and stage</caption>
              <thead>
                <tr>
                  <th scope="col">Branch</th>
                  {STAGES.map(([, l]) => (
                    <th key={l} scope="col">
                      {l}
                    </th>
                  ))}
                  <th scope="col">Places left</th>
                  {ctx.role === "proprietor" && (
                    <th scope="col">
                      <span className="sr-only">Open</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {ctx.branches.map((b) => (
                  <tr key={b.id}>
                    <th scope="row">{b.name}</th>
                    {STAGES.map(([k]) => (
                      <td key={k}>{n(b.id, k)}</td>
                    ))}
                    <td>{b.capacity ? (b.capacity - enrolled(b.id) > 0 ? `${b.capacity - enrolled(b.id)} left` : "Full") : "—"}</td>
                    {ctx.role === "proprietor" && (
                      <td>
                        <form action={openBranch}>
                          <input type="hidden" name="school_id" value={b.id} />
                          <button className="s-btn2">
                            Open<span className="sr-only"> {b.name} admissions</span>
                          </button>
                        </form>
                      </td>
                    )}
                  </tr>
                ))}
                <tr>
                  <th scope="row">All branches</th>
                  {STAGES.map(([k]) => (
                    <td key={k} className="font-bold">
                      {n(null, k)}
                    </td>
                  ))}
                  <td />
                  {ctx.role === "proprietor" && <td />}
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>No applications yet.</Empty>
        )}
        <p className="text-[13px] text-[#4A5A70]">Each branch reviews its own applications. When a branch is full, ask a family to apply to another branch from its website.</p>
      </section>
    </GroupShell>
  );
}
