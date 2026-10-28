import { GroupShell } from "@/components/GroupShell";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Pill } from "@/components/ui";
import { requireGroup } from "@/lib/group";
import { asParts } from "@/lib/results";
import { shareSettings } from "../actions";

export const metadata = { title: "Shared settings" };

type S = { id: string; assessment: unknown; primary_color: string; secondary_color: string; logo_url: string | null; staff_late_after: string };
type G = { school_id: string; grade: string; min_score: number };

export default async function GroupSettings() {
  const ctx = await requireGroup("settings");
  const [{ data: schools }, { data: grades }, { data: payouts }] = await Promise.all([
    ctx.ids.length ? ctx.admin.from("schools").select("id, assessment, primary_color, secondary_color, logo_url, staff_late_after").in("id", ctx.ids).returns<S[]>() : Promise.resolve({ data: [] as S[] }),
    ctx.ids.length ? ctx.admin.from("grading_scales").select("school_id, grade, min_score").in("school_id", ctx.ids).order("min_score", { ascending: false }).returns<G[]>() : Promise.resolve({ data: [] as G[] }),
    ctx.ids.length ? ctx.admin.from("school_payouts").select("school_id, bank_name, account_no, account_name, verified_at").in("school_id", ctx.ids).returns<{ school_id: string; bank_name: string; account_no: string; account_name: string; verified_at: string | null }[]>() : Promise.resolve({ data: [] as { school_id: string; bank_name: string; account_no: string; account_name: string; verified_at: string | null }[] }),
  ]);
  const by = new Map((schools ?? []).map((s) => [s.id, s]));
  const scale = (id: string) => (grades ?? []).filter((g) => g.school_id === id).map((g) => `${g.grade} ${g.min_score}`).join(", ");
  const split = (id: string) => asParts(by.get(id)?.assessment).map((p) => `${p.label} ${p.max}`).join(" + ");
  const same = (f: (id: string) => string) => new Set(ctx.ids.map(f)).size <= 1;
  const rows = [
    { k: "grading", t: "Grading scale", d: "The same score bands everywhere, so results compare fairly.", same: same(scale), show: scale },
    { k: "split", t: "Mark split", d: "How CA and exam marks add up to 100.", same: same(split), show: split },
    { k: "brand", t: "Logo and colours", d: "Used on every branch website, receipt and report card.", same: same((id) => `${by.get(id)?.primary_color}${by.get(id)?.secondary_color}${by.get(id)?.logo_url}`), show: (id: string) => `${by.get(id)?.primary_color} / ${by.get(id)?.secondary_color}${by.get(id)?.logo_url ? " · logo" : ""}` },
    { k: "late", t: "Staff resumption time", d: "Staff who clock in after this are marked late.", same: same((id) => by.get(id)?.staff_late_after ?? ""), show: (id: string) => by.get(id)?.staff_late_after?.slice(0, 5) ?? "" },
  ].filter((r) => r.k !== "brand" || ctx.role === "proprietor");
  const name = new Map(ctx.branches.map((b) => [b.id, b.name]));

  return (
    <GroupShell ctx={ctx} active="settings" title="Shared settings" sub="Make every branch use the same settings, copied from the branch you choose.">
      <section aria-labelledby="ss-h" className="flex flex-col gap-3 rounded-[18px] border border-t-[5px] border-[#E3EAF3] border-t-c2 bg-white p-[22px]">
        <h2 id="ss-h" className="text-lg !text-c1">
          Settings across branches
        </h2>
        <ul className="flex flex-col gap-2">
          {rows.map((r) => (
            <li key={r.k} className="flex flex-col gap-1 rounded-xl border border-[#E3EAF3] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-brand-slate">{r.t}</span>
                <Pill kind={r.same ? "good" : "warn"}>{r.same ? "Same for all branches" : "Different between branches"}</Pill>
              </div>
              <span className="text-xs text-[#4A5A70]">{r.d}</span>
              {!r.same && (
                <ul className="text-xs text-brand-slate">
                  {ctx.ids.map((id) => (
                    <li key={id}>
                      {name.get(id)}: {r.show(id) || "not set"}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
        {ctx.branches.length > 1 && (
          <ActionForm action={shareSettings} className="flex flex-col gap-3 rounded-xl bg-brand-cloud p-4">
            <div className="max-w-sm">
              <label className="label" htmlFor="ss-from">
                Copy from
              </label>
              <select id="ss-from" name="from" className="sk-input sk-select">
                {ctx.branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <fieldset className="flex flex-wrap gap-2">
              <legend className="label">What to copy to the other branches</legend>
              {rows.map((r) => (
                <label key={r.k} className="flex min-h-[44px] items-center gap-2 rounded-xl border-[1.5px] border-[#DCE5F0] bg-white px-3 text-sm font-bold has-[:checked]:border-c2 has-[:checked]:bg-[#F3FBF9]">
                  <input type="checkbox" name="what" value={r.k} defaultChecked={!r.same} className="h-4 w-4" /> {r.t}
                </label>
              ))}
            </fieldset>
            <p className="text-[13px] text-[#4A5A70]">Each branch can still change its own settings afterwards. A mark split can&apos;t be changed at a branch that already has scores that wouldn&apos;t fit.</p>
            <div>
              <SubmitButton pending="Copying…">Copy to the other branches</SubmitButton>
            </div>
          </ActionForm>
        )}
      </section>
      {ctx.role === "proprietor" && (
        <section aria-labelledby="po-h" className="flex flex-col gap-3 rounded-[18px] border border-[#E3EAF3] bg-white p-[22px]">
          <h2 id="po-h" className="text-lg !text-c1">
            Where each branch&apos;s fees are paid out
          </h2>
          <ul className="flex flex-col">
            {ctx.branches.map((b) => {
              const p = (payouts ?? []).find((x) => x.school_id === b.id);
              return (
                <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EEF3F9] py-2 text-sm last:border-0">
                  <span className="font-bold text-brand-slate">{b.name}</span>
                  <span>{p ? `${p.bank_name} ••${p.account_no.slice(-4)} · ${p.verified_at ? "✓ " : ""}${p.account_name}` : "Not set yet"}</span>
                </li>
              );
            })}
          </ul>
          <p className="text-[13px] text-[#4A5A70]">To change one, open the branch and go to Settings → Online fee payments. The name is checked with the bank first.</p>
        </section>
      )}
    </GroupShell>
  );
}
