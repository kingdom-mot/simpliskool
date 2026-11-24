import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Pager, SearchBar } from "@/components/ListTools";
import { Box, LinkTabs, Stat, SuperShell } from "@/components/super";
import { Empty, Pill } from "@/components/ui";
import { linkTo, matches, pageNum, paginate, searchText } from "@/lib/paging";
import { requirePlatform } from "@/lib/platform";
import { demoSchoolIds } from "@/lib/platform-data";
import { markFeedback } from "./actions";

export const metadata = { title: "Feedback — Simpliskool back office" };

type Row = { id: number; school_id: string | null; role: string | null; page: string | null; kind: string; rating: number | null; message: string; status: string; team_note: string | null; created_at: string; schools: { name: string } | null; profiles: { full_name: string | null } | null };
const KIND: Record<string, [string, "bad" | "warn" | "info" | "good"]> = { problem: ["Not working", "bad"], hard: ["Hard to use", "warn"], idea: ["Idea", "info"], like: ["Likes", "good"] };
const ROLE: Record<string, string> = { owner: "Owner", admin: "Admin", principal: "Principal", bursar: "Bursar", teacher: "Teacher", parent: "Parent", student: "Student" };
const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Africa/Lagos" });
const nowMs = () => Date.now();

export default async function SuperFeedback(props: { searchParams: Promise<{ show?: string; kind?: string; q?: string; page?: string; id?: string }> }) {
  const sp = await props.searchParams;
  const ctx = await requirePlatform("feedback");
  const show = sp.show === "seen" || sp.show === "done" || sp.show === "all" ? sp.show : "new";
  const kind = sp.kind && KIND[sp.kind] ? sp.kind : "";
  const q = searchText(sp.q);
  const demo = new Set(await demoSchoolIds(ctx.admin));
  const { data } = await ctx.admin.from("feedback").select("id, school_id, role, page, kind, rating, message, status, team_note, created_at, schools(name), profiles(full_name)").order("created_at", { ascending: false }).limit(2000).returns<Row[]>();
  const all = (data ?? []).filter((r) => !r.school_id || !demo.has(r.school_id));
  const since = nowMs() - 30 * 864e5;
  const recent = all.filter((r) => Date.parse(r.created_at) >= since);
  const rated = recent.filter((r) => r.rating);
  const avg = rated.length ? rated.reduce((a, r) => a + (r.rating ?? 0), 0) / rated.length : null;
  const list = all.filter((r) => (show === "all" || r.status === show || (sp.id && String(r.id) === sp.id)) && (!kind || r.kind === kind) && matches(q, r.message, r.schools?.name, r.profiles?.full_name, r.page, ROLE[r.role ?? ""]));
  const pg = paginate(list, pageNum(sp.page), 20);
  const count = (s: string) => all.filter((r) => r.status === s).length;
  const href = (o: Record<string, string>) => linkTo("/super/feedback", { show: show === "new" ? "" : show, kind, q, ...o });

  return (
    <SuperShell ctx={ctx} active="feedback" title="Feedback" sub="What schools, teachers, parents and students send with the Feedback button. Problems are also emailed to the team.">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="New" value={String(count("new"))} sub="waiting to be read" tone={count("new") ? "bad" : "plain"} />
        <Stat label="Last 30 days" value={String(recent.length)} sub={`${recent.filter((r) => r.kind === "problem").length} problems · ${recent.filter((r) => r.kind === "idea").length} ideas`} />
        <Stat label="Ease of use" value={avg ? `${avg.toFixed(1)} / 5` : "—"} sub={rated.length ? `from ${rated.length} rating${rated.length === 1 ? "" : "s"} in 30 days` : "no ratings yet"} tone={avg && avg >= 4 ? "good" : "plain"} />
        <Stat label="Schools sending feedback" value={String(new Set(recent.map((r) => r.school_id)).size)} sub="in the last 30 days" />
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <LinkTabs
          label="Show"
          current={show}
          tabs={[
            ["new", `New (${count("new")})`, href({ show: "" })],
            ["seen", `Seen (${count("seen")})`, href({ show: "seen" })],
            ["done", `Done (${count("done")})`, href({ show: "done" })],
            ["all", "All", href({ show: "all" })],
          ]}
        />
        <SearchBar id="fb-q" label="Search feedback" placeholder="Words, school, person or page" q={q} keep={{ show: show === "new" ? "" : show, kind }} clearHref={linkTo("/super/feedback", { show: show === "new" ? "" : show, kind })} compact className="min-w-[280px] max-w-[520px] flex-1" />
      </div>
      <nav aria-label="Kind of feedback" className="flex flex-wrap gap-2 text-sm">
        {[["", "Every kind"], ...Object.entries(KIND).map(([k, [l]]) => [k, l])].map(([k, l]) => (
          <Link key={k || "all"} href={href({ kind: k })} aria-current={kind === k ? "page" : undefined} className={`flex min-h-[40px] items-center rounded-full border-[1.5px] px-3 font-bold ${kind === k ? "border-[#0B7D6E] bg-[#0B7D6E] text-white" : "border-[#DCE5F0] bg-white text-[#263449]"}`}>
            {l}
          </Link>
        ))}
      </nav>
      <Box id="fb-list-h" title="Messages">
        {pg.rows.length ? (
          <ul className="flex flex-col gap-3">
            {pg.rows.map((r) => (
              <li key={r.id} id={`fb-${r.id}`} className={`flex flex-col gap-2 rounded-xl border p-4 ${String(r.id) === sp.id ? "border-2 border-[#0B7D6E]" : "border-[#E3EAF3]"}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex flex-wrap items-center gap-2">
                    <Pill kind={KIND[r.kind]?.[1] ?? "info"}>{KIND[r.kind]?.[0] ?? r.kind}</Pill>
                    {r.rating && <span className="text-xs font-bold text-[#263449]">Ease {r.rating}/5</span>}
                  </span>
                  <span className="text-xs text-[#4A5A70]">{when(r.created_at)}</span>
                </div>
                <p className="whitespace-pre-line text-[15px] text-[#1B2433]">{r.message}</p>
                <p className="text-xs text-[#4A5A70]">
                  {r.profiles?.full_name?.trim() || "Someone"} · {ROLE[r.role ?? ""] ?? r.role} ·{" "}
                  {r.school_id ? (
                    <Link className="underline" href={`/super/schools/${r.school_id}`}>
                      {r.schools?.name}
                    </Link>
                  ) : (
                    "no school"
                  )}
                  {r.page ? ` · on ${r.page}` : ""}
                </p>
                {r.team_note && <p className="rounded-lg bg-brand-cloud p-2 text-sm"><strong>Team note:</strong> {r.team_note}</p>}
                <div className="flex flex-wrap items-end gap-2">
                  {r.status === "new" && (
                    <ActionForm action={markFeedback}>
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="status" value="seen" />
                      <SubmitButton className="s-btn2 !min-h-[40px]" pending="…">
                        Mark seen
                      </SubmitButton>
                    </ActionForm>
                  )}
                  {r.status !== "done" ? (
                    <details>
                      <summary className="s-link cursor-pointer text-sm">Mark done…</summary>
                      <ActionForm action={markFeedback} className="mt-2 flex w-[min(80vw,360px)] flex-col gap-2">
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="status" value="done" />
                        <label className="label" htmlFor={`fn-${r.id}`}>
                          What was done (optional)
                        </label>
                        <input id={`fn-${r.id}`} name="note" className="sk-input" maxLength={2000} placeholder="e.g. Fixed in the 24 Nov update" />
                        <SubmitButton className="s-btn2 self-start" pending="Saving…">
                          Mark done
                        </SubmitButton>
                      </ActionForm>
                    </details>
                  ) : (
                    <ActionForm action={markFeedback}>
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="status" value="seen" />
                      <SubmitButton className="s-link text-sm" pending="…">
                        Reopen
                      </SubmitButton>
                    </ActionForm>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>{q ? `No feedback matches “${q}”.` : show === "new" ? "No new feedback. Nice." : "Nothing here yet."}</Empty>
        )}
        <Pager p={pg} href={(n) => href({ page: String(n) })} label="Feedback pages" />
      </Box>
    </SuperShell>
  );
}
