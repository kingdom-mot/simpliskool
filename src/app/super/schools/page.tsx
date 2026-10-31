import Link from "next/link";
import { Flash } from "@/components/Flash";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Box, LinkTabs, Scroll, SuperShell } from "@/components/super";
import { Pill } from "@/components/ui";
import { requirePlatform } from "@/lib/platform";
import { health, nowMs, payoutState, schoolRows, shortDay, type SchoolRow } from "@/lib/platform-data";
import { PLAN_LABEL, type PlanKey } from "@/lib/platform-settings";
import { addSchool } from "../actions";

export const metadata = { title: "Schools and groups — Simpliskool back office" };

export default async function SuperSchools(props: { searchParams: Promise<{ tab?: string; q?: string; add?: string }> }) {
  const sp = await props.searchParams;
  const ctx = await requirePlatform("schools");
  const now = nowMs();
  const rows = await schoolRows(ctx.admin);
  const { data: groups } = await ctx.admin.from("school_groups").select("id, name").order("name").returns<{ id: string; name: string }[]>();
  const kind = (r: SchoolRow) => {
    if (r.status === "suspended") return "off";
    const h = health(r, now).label;
    if (h === "To check" || (!r.payments_approved_at && r.check_status !== "approved" && r.payout_account)) return "check";
    if (h === "At risk" || h === "Low use") return "risk";
    return "live";
  };
  const count = (k: string) => rows.filter((r) => (k === "pilot" ? r.plan === "pilot" && r.status === "active" : kind(r) === k)).length;
  const tab = ["pilot", "check", "risk", "off"].includes(sp.tab ?? "") ? sp.tab! : "all";
  const q = (sp.q ?? "").trim().toLowerCase();
  const digits = q.replace(/\D/g, "");
  const list = rows
    .filter((r) => tab === "all" || (tab === "pilot" ? r.plan === "pilot" && r.status === "active" : kind(r) === tab))
    .filter((r) => !q || [r.name, r.address, r.slug, r.owner_name, r.owner_email, r.group_name].some((v) => v?.toLowerCase().includes(q)) || (digits.length >= 4 && (r.owner_phone ?? "").includes(digits)))
    .sort((a, b) => (a.group_name ?? a.name).localeCompare(b.group_name ?? b.name) || a.name.localeCompare(b.name));
  const href = (t: string) => `/super/schools?${new URLSearchParams({ ...(t !== "all" ? { tab: t } : {}), ...(q ? { q } : {}) })}`;
  const PILL = { good: "good", warn: "warn", bad: "bad", info: "info" } as const;

  return (
    <SuperShell
      ctx={ctx}
      active="schools"
      title="Schools and groups"
      sub={`${rows.length} school${rows.length === 1 ? "" : "s"} · ${count("check")} waiting for checks`}
      actions={
        <>
          <a className="s-btn2" href={`/super/schools/export${q ? `?q=${encodeURIComponent(q)}` : ""}`}>
            Export (CSV)
          </a>
          {ctx.can("school.add") && (
            <Link className="s-btn" href="/super/schools?add=1#add-h">
              + Add a school
            </Link>
          )}
        </>
      }
    >
      <Flash />
      <div className="flex flex-wrap items-end gap-3">
        <form className="flex min-w-[240px] flex-1 items-end gap-2" action="/super/schools">
          {tab !== "all" && <input type="hidden" name="tab" value={tab} />}
          <div className="flex-1">
            <label className="label" htmlFor="sq">
              Search
            </label>
            <input id="sq" name="q" type="search" className="sk-input" defaultValue={sp.q ?? ""} placeholder="School name, town, owner or owner's phone" />
          </div>
          <button className="s-btn2">Search</button>
        </form>
        <LinkTabs
          label="Status"
          current={tab}
          tabs={[
            ["all", `All (${rows.length})`, href("all")],
            ["pilot", `Pilot (${count("pilot")})`, href("pilot")],
            ["check", `To check (${count("check")})`, href("check")],
            ["risk", `At risk (${count("risk")})`, href("risk")],
            ["off", `Suspended (${count("off")})`, href("off")],
          ]}
        />
      </div>

      <Scroll label="Schools">
        <table className="tbl min-w-[980px]">
          <caption className="sr-only">Schools</caption>
          <thead>
            <tr>
              <th scope="col">School</th>
              <th scope="col">Owner</th>
              <th scope="col">Plan</th>
              <th scope="col" className="!text-right">
                Students
              </th>
              <th scope="col">Payout account</th>
              <th scope="col">Signed up</th>
              <th scope="col">Status</th>
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => {
              const h = health(r, now);
              const p = payoutState(r);
              return (
                <tr key={r.id}>
                  <td>
                    <Link href={`/super/schools/${r.id}`} className="block font-extrabold text-c1 hover:underline">
                      {r.name}
                    </Link>
                    <span className="block text-[13px] text-[#4A5A70]">{[r.group_name, r.address, `${r.slug}.simpliskool.com`].filter(Boolean).join(" · ")}</span>
                  </td>
                  <td className="text-[13px]">
                    {r.owner_name ?? "—"}
                    <span className="block text-[#4A5A70]">{r.owner_phone ?? r.owner_email}</span>
                  </td>
                  <td>
                    {PLAN_LABEL[r.plan as PlanKey] ?? r.plan}
                    {r.group_id ? " · group" : ""}
                  </td>
                  <td className="text-right">{r.students.toLocaleString("en-NG")}</td>
                  <td>
                    <Pill kind={PILL[p.kind]}>{p.label}</Pill>
                  </td>
                  <td className="text-[13px]">{shortDay(r.created_at)}</td>
                  <td>
                    <Pill kind={PILL[h.kind]}>{r.status === "active" && h.label === "Healthy" ? "Live" : h.label}</Pill>
                  </td>
                  <td>
                    <Link href={`/super/schools/${r.id}`} className="s-link text-sm">
                      Open<span className="sr-only"> {r.name}</span>
                    </Link>
                  </td>
                </tr>
              );
            })}
            {!list.length && (
              <tr>
                <td colSpan={8} className="text-[#4A5A70]">
                  No schools match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Scroll>

      {sp.add && ctx.can("school.add") && (
        <Box id="add-h" title="Add a school for someone" className="max-w-[860px] border-t-[5px] !border-t-c2">
          <p className="text-sm text-[#4A5A70]">Use this when the team signs a school up in person. The owner gets an email invite (or signs in with their phone) and finishes setting up.</p>
          <ActionForm action={addSchool} className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="as-name">
                  School name
                </label>
                <input id="as-name" name="name" className="sk-input" required minLength={3} maxLength={120} />
              </div>
              <div>
                <label className="label" htmlFor="as-town">
                  Town and state
                </label>
                <input id="as-town" name="town" className="sk-input" maxLength={120} placeholder="Gwarinpa, Abuja" />
              </div>
              <div>
                <label className="label" htmlFor="as-owner">
                  Owner&apos;s name
                </label>
                <input id="as-owner" name="owner_name" className="sk-input" required minLength={3} maxLength={120} />
              </div>
              <div>
                <label className="label" htmlFor="as-contact">
                  Owner&apos;s email or phone
                </label>
                <input id="as-contact" name="owner_contact" className="sk-input" required maxLength={120} />
              </div>
              <div>
                <label className="label" htmlFor="as-plan">
                  Plan
                </label>
                <select id="as-plan" name="plan" className="sk-input">
                  <option value="pilot">Pilot (free)</option>
                  <option value="single">Single school</option>
                  <option value="group">School group</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="as-group">
                  Part of a group?
                </label>
                <select id="as-group" name="group" className="sk-input">
                  <option value="">No</option>
                  {(groups ?? []).map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                  <option value="new">New group…</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="as-gname">
                  New group name (if new)
                </label>
                <input id="as-gname" name="group_name" className="sk-input" maxLength={120} />
              </div>
              <div>
                <label className="label" htmlFor="as-slug">
                  Web address (optional)
                </label>
                <input id="as-slug" name="slug" className="sk-input" maxLength={40} aria-describedby="as-slug-h" />
                <p id="as-slug-h" className="mt-1 text-xs text-[#4A5A70]">
                  Made from the name if left empty, e.g. littleangels.simpliskool.com
                </p>
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2.5">
              <Link href="/super/schools" className="s-btn2">
                Cancel
              </Link>
              <SubmitButton pending="Creating…">Create and send invite</SubmitButton>
            </div>
          </ActionForm>
        </Box>
      )}
    </SuperShell>
  );
}
