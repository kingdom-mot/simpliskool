import Link from "next/link";
import { Flash } from "@/components/Flash";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Box, Scroll, SuperShell } from "@/components/super";
import { Pill } from "@/components/ui";
import { requirePlatform } from "@/lib/platform";
import { longDay, schoolRows } from "@/lib/platform-data";
import { getSettings, PLAN_LABEL } from "@/lib/platform-settings";
import { savePlans, setBillingTalk } from "../actions";

export const metadata = { title: "Plans and billing — Simpliskool back office" };

const TALK: Record<string, { l: string; k: "good" | "warn" | "bad" | "info" }> = {
  not_yet: { l: "Not yet", k: "warn" },
  happy: { l: "Yes · happy to pay", k: "good" },
  later: { l: "Yes · from a later date", k: "good" },
  unsure: { l: "Yes · not sure yet", k: "warn" },
  leaving: { l: "May leave", k: "bad" },
};

export default async function SuperBilling() {
  const ctx = await requirePlatform("billing");
  const [rows, settings, { data: accts }, { data: team }] = await Promise.all([
    schoolRows(ctx.admin),
    getSettings(),
    ctx.admin.from("school_accounts").select("school_id, billing_talk, account_manager").returns<{ school_id: string; billing_talk: string; account_manager: string | null }[]>(),
    ctx.admin.from("platform_team").select("user_id, profiles!platform_team_user_id_fkey(full_name)").returns<{ user_id: string; profiles: { full_name: string | null } | null }[]>(),
  ]);
  const acct = new Map((accts ?? []).map((a) => [a.school_id, a]));
  const who = new Map((team ?? []).map((t) => [t.user_id, t.profiles?.full_name ?? "Team member"]));
  const live = rows.filter((r) => r.status === "active");
  const count = (k: string) => live.filter((r) => r.plan === k).length;
  // A group is billed once for all its branches.
  const pilots = new Map<string, { name: string; students: number; ids: string[]; plan: string }>();
  for (const r of live.filter((x) => x.plan === "pilot")) {
    const k = r.group_id ?? r.id;
    const e = pilots.get(k) ?? { name: r.group_name ? `${r.group_name} (group)` : r.name, students: 0, ids: [], plan: r.group_id ? "group" : "single" };
    e.students += r.students;
    e.ids.push(r.id);
    pilots.set(k, e);
  }
  const list = [...pilots.values()].sort((a, b) => b.students - a.students);
  const priceNum = (p: string) => {
    const n = Number(p.replace(/[₦,\s]/g, "").replace(/per.*$/i, ""));
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const edit = ctx.can("billing");
  const talk = ctx.can("billing.talk");

  return (
    <SuperShell ctx={ctx} active="billing" title="Plans and billing" sub="What schools pay Dream Savvy for Simpliskool.">
      <Flash />
      <ActionForm action={savePlans} className="flex flex-col gap-4">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-3">
          {(["pilot", "single", "group"] as const).map((k) => (
            <section key={k} aria-labelledby={`pl-${k}`} className={`flex flex-col gap-2.5 rounded-[18px] bg-white p-[22px] ${k === "pilot" ? "border-2 border-[#0B7D6E]" : "border border-[#E3EAF3]"}`}>
              <div className="flex justify-between gap-2">
                <h2 id={`pl-${k}`} className="text-[19px] !text-c1">
                  {PLAN_LABEL[k]}
                </h2>
                <Pill kind="info">
                  {count(k)} school{count(k) === 1 ? "" : "s"}
                </Pill>
              </div>
              <fieldset disabled={!edit} className="flex flex-col gap-2.5">
                <div>
                  <label className="label" htmlFor={`price-${k}`}>
                    Price
                  </label>
                  <input id={`price-${k}`} name={`price_${k}`} className="sk-input" maxLength={60} defaultValue={settings.plans[k].price} placeholder="₦1,500 per student per term" />
                </div>
                <div>
                  <label className="label" htmlFor={`desc-${k}`}>
                    What it includes
                  </label>
                  <textarea id={`desc-${k}`} name={`desc_${k}`} rows={3} className="sk-input" maxLength={200} defaultValue={settings.plans[k].desc} />
                </div>
              </fieldset>
            </section>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label" htmlFor="pend">
              Pilot ends (for every pilot school, unless set on the school)
            </label>
            <input id="pend" name="pilot_ends" type="date" className="sk-input" defaultValue={settings.pilot_ends ?? ""} disabled={!edit} />
          </div>
          {edit && <SubmitButton>Save plans</SubmitButton>}
        </div>
      </ActionForm>

      <Box id="pe-h" title="Pilot schools coming off the free plan" actions={<Pill kind="warn">{settings.pilot_ends ? `Pilot ends ${longDay(settings.pilot_ends)}` : "Pilot end date not set"}</Pill>}>
        <Scroll label="Pilot schools">
          <table className="tbl min-w-[760px]">
            <caption className="sr-only">Pilot schools and how the talk about paying is going</caption>
            <thead>
              <tr>
                <th scope="col">School</th>
                <th scope="col" className="!text-right">
                  Students
                </th>
                <th scope="col">First bill (estimate)</th>
                <th scope="col">Talked to them?</th>
                <th scope="col">Looked after by</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => {
                const a = acct.get(p.ids[0]);
                const price = priceNum(settings.plans[p.plan as "single" | "group"].price);
                const t = TALK[a?.billing_talk ?? "not_yet"] ?? TALK.not_yet;
                return (
                  <tr key={p.ids[0]}>
                    <th scope="row" className="text-left font-bold">
                      <Link href={`/super/schools/${p.ids[0]}`} className="hover:underline">
                        {p.name}
                      </Link>
                    </th>
                    <td className="text-right">{p.students.toLocaleString("en-NG")}</td>
                    <td>{price ? `₦${(p.students * price).toLocaleString("en-NG")} a term` : `${p.students.toLocaleString("en-NG")} × price not set`}</td>
                    <td>
                      {talk ? (
                        <ActionForm action={setBillingTalk} className="flex items-center gap-2">
                          <input type="hidden" name="school_id" value={p.ids[0]} />
                          <label className="sr-only" htmlFor={`tk-${p.ids[0]}`}>
                            Talked to {p.name}?
                          </label>
                          <select id={`tk-${p.ids[0]}`} name="talk" className="sk-input !min-h-[40px] !w-auto" defaultValue={a?.billing_talk ?? "not_yet"}>
                            {Object.entries(TALK).map(([k, v]) => (
                              <option key={k} value={k}>
                                {v.l}
                              </option>
                            ))}
                          </select>
                          <SubmitButton className="s-btn2 !min-h-[40px] !px-3" pending="…">
                            Save<span className="sr-only"> for {p.name}</span>
                          </SubmitButton>
                        </ActionForm>
                      ) : (
                        <Pill kind={t.k}>{t.l}</Pill>
                      )}
                    </td>
                    <td className="text-[13px]">{a?.account_manager ? who.get(a.account_manager) : "No one yet"}</td>
                  </tr>
                );
              })}
              {!list.length && (
                <tr>
                  <td colSpan={5} className="text-[#4A5A70]">
                    No pilot schools.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Scroll>
      </Box>

      <Box id="how-h" title="How schools will be billed">
        <ul className="list-disc pl-5 text-sm leading-7">
          <li>One bill per term, counted on active students in week 3.</li>
          <li>Schools pay by card or transfer. We can also take it from their fee payouts if the owner agrees.</li>
          <li>A school group gets one bill for all its branches.</li>
          <li>If a bill is 30 days late, the school is reminded. We never block parents from paying fees.</li>
        </ul>
      </Box>
    </SuperShell>
  );
}
