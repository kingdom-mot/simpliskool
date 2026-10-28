import { Flash } from "@/components/Flash";
import { GroupShell } from "@/components/GroupShell";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Bar, Pill } from "@/components/ui";
import { pct } from "@/lib/format";
import { requireGroup } from "@/lib/group";
import { branchStats } from "@/lib/group-stats";
import { addBranch, openBranch, setCapacity } from "../actions";

export const metadata = { title: "Branches" };

export default async function GroupBranches() {
  const ctx = await requireGroup("branches");
  const [s, { data: payouts }] = await Promise.all([
    branchStats(ctx),
    ctx.ids.length ? ctx.admin.from("school_payouts").select("school_id, bank_name, account_no, paystack_subaccount").in("school_id", ctx.ids).returns<{ school_id: string; bank_name: string; account_no: string; paystack_subaccount: string | null }[]>() : Promise.resolve({ data: [] as { school_id: string; bank_name: string; account_no: string; paystack_subaccount: string | null }[] }),
  ]);
  const pay = new Map((payouts ?? []).map((p) => [p.school_id, p]));
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "simpliskool.com";
  const owner = ctx.role === "proprietor";

  return (
    <GroupShell ctx={ctx} active="branches" title="Branches" sub="Each branch runs day to day on its own. You see all of them here." actions={owner ? <a className="s-btn" href="#add-h">+ Add a branch</a> : undefined}>
      <Flash />
      <section aria-labelledby="list-h" className="flex flex-col gap-3 rounded-[18px] border border-t-[5px] border-[#E3EAF3] border-t-c2 bg-white p-[22px]">
        <h2 id="list-h" className="text-lg !text-c1">
          Branches in {ctx.group.name}
        </h2>
        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Branches: scroll sideways to see more">
          <table className="tbl min-w-[900px]">
            <caption className="sr-only">Branches</caption>
            <thead>
              <tr>
                <th scope="col">Branch</th>
                <th scope="col">Principal</th>
                <th scope="col">Students</th>
                <th scope="col">Places filled</th>
                <th scope="col">Staff</th>
                <th scope="col">Fees paid out to</th>
                <th scope="col">Status</th>
                {owner && (
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {s.map((b) => {
                const br = ctx.branches.find((x) => x.id === b.id)!;
                const p = pay.get(b.id);
                const setting = !b.principal && b.students === 0;
                return (
                  <tr key={b.id}>
                    <th scope="row">
                      {b.name}
                      <span className="block text-xs font-normal text-[#4A5A70]">{br.address ?? `${br.slug}.${root}`}</span>
                    </th>
                    <td>{b.principal ?? "Not added yet"}</td>
                    <td>{b.students}</td>
                    <td className="min-w-[180px]">
                      {b.capacity ? (
                        <>
                          <span className="text-sm">
                            {pct(b.students, b.capacity)}% of {b.capacity}
                          </span>
                          <Bar value={pct(b.students, b.capacity)} fill="var(--c2,#0B7D6E)" label={`${b.name}: ${pct(b.students, b.capacity)}% of places filled`} height={6} />
                        </>
                      ) : (
                        "—"
                      )}
                      {owner && (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-xs font-bold text-c1 underline">Set places<span className="sr-only"> for {b.name}</span></summary>
                          <ActionForm action={setCapacity} className="mt-1 flex items-end gap-2">
                            <input type="hidden" name="school_id" value={b.id} />
                            <label className="sr-only" htmlFor={`cap-${b.id}`}>
                              Places at {b.name}
                            </label>
                            <input id={`cap-${b.id}`} name="capacity" type="number" min={1} max={20000} defaultValue={b.capacity ?? ""} className="sk-input w-24 py-1" />
                            <SubmitButton className="s-btn2">Save</SubmitButton>
                          </ActionForm>
                        </details>
                      )}
                    </td>
                    <td>{b.staff}</td>
                    <td>{p ? `${p.bank_name} ••${p.account_no.slice(-4)}${p.paystack_subaccount ? "" : " (online payment off)"}` : "Not set yet"}</td>
                    <td>
                      <Pill kind={setting ? "warn" : "good"}>{setting ? "Setting up" : "Active"}</Pill>
                    </td>
                    {owner && (
                      <td>
                        <form action={openBranch}>
                          <input type="hidden" name="school_id" value={b.id} />
                          <button className="s-btn2">
                            Open<span className="sr-only"> {b.name}</span>
                          </button>
                        </form>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 xl:grid-cols-[1.2fr_1fr]">
        {owner && (
          <section aria-labelledby="add-h" className="flex flex-col gap-3 rounded-[18px] border border-t-[5px] border-[#E3EAF3] border-t-c1 bg-white p-[22px]">
            <h2 id="add-h" className="text-lg !text-c1">
              Add a branch
            </h2>
            <ActionForm action={addBranch} resetOnSuccess className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="nb-name">
                  Branch name
                </label>
                <input id="nb-name" name="name" required minLength={3} maxLength={120} placeholder="e.g. Lekki campus" className="sk-input" />
              </div>
              <div>
                <label className="label" htmlFor="nb-slug">
                  Web address
                </label>
                <input id="nb-slug" name="slug" required pattern="[a-z0-9][a-z0-9-]{1,38}[a-z0-9]" placeholder="brightstars-lekki" className="sk-input" aria-describedby="nb-slug-h" />
                <span id="nb-slug-h" className="mt-1 block text-[13px] text-[#4A5A70]">
                  Becomes the branch&apos;s code and website: code.{root}
                </span>
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="nb-addr">
                  Address
                </label>
                <input id="nb-addr" name="address" maxLength={300} className="sk-input" />
              </div>
              <div>
                <label className="label" htmlFor="nb-cap">
                  Number of places <span className="font-normal text-[#4A5A70]">(optional)</span>
                </label>
                <input id="nb-cap" name="capacity" type="number" min={1} max={20000} className="sk-input" />
              </div>
              <div>
                <label className="label" htmlFor="nb-copy">
                  Start with the setup of
                </label>
                <select id="nb-copy" name="copy_from" className="sk-input sk-select" defaultValue={ctx.branches[0]?.id ?? ""}>
                  <option value="">Nothing (start empty)</option>
                  {ctx.branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="nb-pname">
                  Principal&apos;s name
                </label>
                <input id="nb-pname" name="principal_name" maxLength={120} className="sk-input" />
              </div>
              <div>
                <label className="label" htmlFor="nb-pc">
                  Principal&apos;s phone or email
                </label>
                <input id="nb-pc" name="principal" maxLength={120} className="sk-input" />
              </div>
              <p className="text-[13px] text-[#4A5A70] sm:col-span-2">Copies classes, subjects, bell times, grading, mark split, logo and colours. Students, staff and fees are never copied; each branch sets its own fee amounts.</p>
              <div className="sm:col-span-2">
                <SubmitButton pending="Adding…">Add branch</SubmitButton>
              </div>
            </ActionForm>
          </section>
        )}
        <section aria-labelledby="how-h" className="flex flex-col gap-2 rounded-[18px] border border-[#E3EAF3] bg-white p-[22px] text-sm text-brand-slate">
          <h2 id="how-h" className="text-lg !text-c1">
            How branches work
          </h2>
          <p>Each branch has its own principal, staff, classes, timetable and fee amounts, and its own web address. Things you copy under Shared settings make branches match.</p>
          <p>
            <strong>Who can see what.</strong> Branch staff only see their own branch. Your group team sees the branches you choose, read only, unless you give them more.
          </p>
          <p>
            <strong>Money.</strong> Each branch&apos;s fees go to the payout account set in that branch&apos;s Settings. Only the owner can change it.
          </p>
        </section>
      </div>
    </GroupShell>
  );
}
