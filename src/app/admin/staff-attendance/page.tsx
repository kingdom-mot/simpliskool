import Link from "next/link";
import { AdminPage, Panel, requireAdminPage } from "@/components/admin";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Empty, ICONS, Pill, StatCard } from "@/components/ui";
import { SearchBar, noMatch } from "@/components/ListTools";
import { matches, searchText } from "@/lib/paging";
import { decideDuty } from "@/lib/staff-clock-actions";
import { clockStaff } from "./actions";
import { ClockSettings } from "./ClockSettings";

export const metadata = { title: "Staff attendance" };

type Refused = {
  at: string;
  kind: "in" | "out";
  outcome: "too_far" | "too_vague" | "not_set";
  distance: number | null;
  lat: number | null;
  lng: number | null;
};
type Row = {
  id: string;
  name: string;
  role: string;
  clock_in: string | null;
  clock_out: string | null;
  status: "present" | "absent" | "leave" | "duty" | null;
  note: string | null;
  in_distance: number | null;
  out_distance: number | null;
  in_lat: number | null;
  in_lng: number | null;
  out_lat: number | null;
  out_lng: number | null;
  duty_request: string | null;
  duty_state: "pending" | "approved" | "declined" | null;
  refused: Refused[] | null;
};
type Day = {
  late_after: string;
  close_at: string | null;
  geo_set?: boolean;
  radius?: number;
  staff: Row[];
};
type Month = {
  id: string;
  name: string;
  present: number;
  late: number;
  left_early?: number;
  no_out?: number;
  outside?: number;
  absent: number;
  leave: number;
  duty: number;
  avg_in: string | null;
};
const TZ = "Africa/Lagos";
const lagosToday = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
const tm = (iso: string) =>
  new Date(iso)
    .toLocaleTimeString("en-GB", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: TZ,
    })
    .replace(" ", "")
    .toLowerCase();
const hhmm = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: TZ,
  }).format(new Date(iso));
const ampm = (h: string | null) => {
  if (!h) return "—";
  const [H, M] = h.split(":").map(Number);
  return `${H % 12 || 12}:${String(M).padStart(2, "0")}${H >= 12 ? "pm" : "am"}`;
};
const far = (m: number | null) =>
  m === null
    ? ""
    : m >= 1000
      ? `${(m / 1000).toFixed(m >= 10000 ? 0 : 1)} km`
      : `${m} m`;
const mapUrl = (lat: number | null, lng: number | null) =>
  lat === null || lng === null
    ? null
    : `https://www.google.com/maps?q=${lat},${lng}`;

function MapLink({
  lat,
  lng,
  label,
}: {
  lat: number | null;
  lng: number | null;
  label: string;
}) {
  const u = mapUrl(lat, lng);
  return u ? (
    <a
      href={u}
      target="_blank"
      rel="noopener noreferrer"
      className="text-xs font-bold text-c1 underline underline-offset-2"
    >
      Map<span className="sr-only"> of {label} (opens Google Maps)</span>
    </a>
  ) : null;
}

export default async function StaffAttendancePage(props: {
  searchParams: Promise<{
    date?: string;
    tab?: string;
    month?: string;
    q?: string;
  }>;
}) {
  const sp = await props.searchParams;
  const ctx = await requireAdminPage(["owner", "admin", "principal"]);
  const { supabase, school, membership } = ctx;
  const today = lagosToday();
  const date =
    sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) && sp.date <= today
      ? sp.date
      : today;
  const tab = sp.tab === "month" ? "month" : "today";
  const month =
    sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : date.slice(0, 7);
  const q = searchText(sp.q);
  const canMark =
    membership.role === "owner" || membership.role === "principal";
  const isOwner = membership.role === "owner";
  const [{ data: dayData }, { data: monthData }, { data: geo }] =
    await Promise.all([
      supabase.rpc("staff_attendance_day", {
        p_school: school.id,
        p_date: date,
      }),
      tab === "month"
        ? supabase.rpc("staff_attendance_month", {
            p_school: school.id,
            p_month: `${month}-01`,
          })
        : Promise.resolve({ data: null }),
      isOwner
        ? supabase
            .from("schools")
            .select("geo_lat, geo_lng, geo_radius_m, staff_close_at")
            .eq("id", school.id)
            .maybeSingle<{
              geo_lat: number | null;
              geo_lng: number | null;
              geo_radius_m: number;
              staff_close_at: string | null;
            }>()
        : Promise.resolve({ data: null }),
    ]);
  const d = dayData as Day | null;
  const rows = d?.staff ?? [];
  const lateAfter = d?.late_after ?? "07:45";
  const closeAt = d?.close_at ?? null;
  const geoSet = d?.geo_set ?? false;
  const upgraded = d ? "geo_set" in d : false;
  const isLate = (r: Row) =>
    !!r.clock_in && r.status !== "duty" && hhmm(r.clock_in) > lateAfter;
  const leftEarly = (r: Row) =>
    !!r.clock_out &&
    !!closeAt &&
    r.status === "present" &&
    hhmm(r.clock_out) < closeAt;
  const noOut = (r: Row) =>
    !!r.clock_in && !r.clock_out && r.status === "present" && date < today;
  const outside = (r: Row) =>
    (r.refused ?? []).filter((x) => x.outcome === "too_far");
  const counts = {
    in: rows.filter((r) => r.clock_in).length,
    late: rows.filter(isLate).length,
    flags: rows.filter((r) => leftEarly(r) || noOut(r) || outside(r).length > 0)
      .length,
    duty: rows.filter((r) => r.duty_state === "pending").length,
    absent: rows.filter((r) => r.status === "absent").length,
  };
  const longDate = new Date(`${date}T12:00:00+01:00`).toLocaleDateString(
    "en-GB",
    { weekday: "long", day: "numeric", month: "long", timeZone: TZ },
  );
  const monthName = new Date(`${month}-15T12:00:00+01:00`).toLocaleDateString(
    "en-GB",
    { month: "long", year: "numeric", timeZone: TZ },
  );
  const shown = rows.filter((r) => matches(q, r.name, r.role));
  const monthRows = ((monthData as Month[] | null) ?? []).filter((m) =>
    matches(q, m.name),
  );
  const status = (r: Row): [string, "good" | "warn" | "bad" | "info"] =>
    r.status === "absent"
      ? ["Absent", "bad"]
      : r.status === "leave"
        ? ["On leave", "info"]
        : r.status === "duty"
          ? ["Official duty", "info"]
          : !r.clock_in
            ? ["Not in yet", "info"]
            : isLate(r)
              ? ["Late", "warn"]
              : ["On time", "good"];

  return (
    <AdminPage
      ctx={ctx}
      active="staffatt"
      crumb={[{ label: "People" }]}
      title="Staff attendance"
      actions={
        <form method="get" className="flex flex-wrap items-end gap-2">
          <div>
            <label className="label" htmlFor="sa-date">
              Date
            </label>
            <input
              className="sk-input py-2"
              id="sa-date"
              name="date"
              type="date"
              defaultValue={date}
              max={today}
            />
          </div>
          <button className="s-btn2">Show</button>
          <a
            className="s-btn2"
            href={`/admin/staff-attendance/export?month=${month}`}
            download
          >
            Download monthly report
          </a>
        </form>
      }
    >
      <p className="rounded-xl bg-[#EEF3F9] px-4 py-3 text-sm text-[#173B70]">
        Teachers and staff clock themselves in and out on their own phones, only
        from the school premises. The time comes from Simpliskool, not the
        phone. Tries from outside school are refused and shown here. The
        principal can mark someone absent or on leave, and approve official
        duty, but can&apos;t clock anyone in or out.
      </p>
      {upgraded && !geoSet && (
        <p
          role="alert"
          className="rounded-xl border border-[#F1D29A] bg-[#FFF8E8] px-4 py-3 text-sm font-semibold text-[#5C4300]"
        >
          Staff can&apos;t clock in yet: the school&apos;s location isn&apos;t
          set.{" "}
          {isOwner
            ? "Set it below, standing at school."
            : "Ask the school owner to set it on this page."}
        </p>
      )}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          tone="teal"
          icon={ICONS.check}
          label="Clocked in"
          value={`${counts.in} / ${rows.length}`}
          sub={longDate}
        />
        <StatCard
          tone="amber"
          icon={ICONS.clock}
          label={`Late (after ${ampm(lateAfter)})`}
          value={String(counts.late)}
          sub="Clocked in after the late time"
        />
        <StatCard
          tone="pink"
          icon={ICONS.users}
          label="Flags"
          value={String(counts.flags)}
          sub="Tried from outside school, left early or didn't clock out"
        />
        <StatCard
          tone="blue"
          icon={ICONS.book}
          label="Duty requests"
          value={String(counts.duty)}
          sub={`${counts.absent} marked absent`}
        />
      </div>

      <nav aria-label="View" className="flex flex-wrap gap-2">
        {[
          ["today", date === today ? "Today" : longDate],
          ["month", "This month"],
        ].map(([k, l]) => (
          <Link
            key={k}
            href={`/admin/staff-attendance?${new URLSearchParams({ date, tab: k })}`}
            aria-current={tab === k ? "page" : undefined}
            className={`flex min-h-[44px] items-center rounded-xl border-[1.5px] px-4 text-sm font-bold ${tab === k ? "border-c1 bg-c1 text-white" : "border-[#DCE5F0] bg-white text-brand-slate"}`}
          >
            {l}
          </Link>
        ))}
      </nav>

      {tab === "today" ? (
        <Panel
          id="day-h"
          tip={
            "Staff clock in when they arrive and out when they leave, from their own phone at school. Late, left early and tries from outside school are flagged."
          }
          title={`Staff clock-in and clock-out for ${longDate}`}
        >
          {rows.length > 6 && (
            <SearchBar
              id="sa-q"
              label="Find a staff member"
              placeholder="Name or role"
              q={q}
              keep={{ date: date === today ? "" : date }}
              clearHref={`/admin/staff-attendance${date === today ? "" : `?date=${date}`}`}
              compact
            />
          )}
          {shown.length ? (
            <div
              className="overflow-x-auto"
              tabIndex={0}
              role="region"
              aria-label="Staff attendance: scroll sideways to see more"
            >
              <table className="tbl min-w-[1000px]">
                <caption className="sr-only">
                  Staff clock-in and clock-out for {longDate}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Staff</th>
                    <th scope="col">Clock in</th>
                    <th scope="col">Clock out</th>
                    <th scope="col">Status</th>
                    <th scope="col">Flags</th>
                    <th scope="col">Other</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r) => {
                    const [st, kind] = status(r);
                    const tries = r.refused ?? [];
                    return (
                      <tr key={r.id}>
                        <th scope="row">
                          {r.name}
                          <span className="block text-xs font-normal text-[#4A5A70]">
                            {r.role}
                          </span>
                        </th>
                        <td>
                          {r.clock_in ? (
                            <>
                              <span
                                className={
                                  isLate(r)
                                    ? "font-bold text-[#7A5300]"
                                    : "font-bold"
                                }
                              >
                                {tm(r.clock_in)}
                              </span>
                              {r.in_distance !== null && (
                                <span className="block text-xs text-[#4A5A70]">
                                  {far(r.in_distance)} from school ·{" "}
                                  <MapLink
                                    lat={r.in_lat}
                                    lng={r.in_lng}
                                    label={`${r.name}'s clock-in`}
                                  />
                                </span>
                              )}
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>
                          {r.clock_out ? (
                            <>
                              <span
                                className={
                                  leftEarly(r)
                                    ? "font-bold text-[#7A5300]"
                                    : "font-bold"
                                }
                              >
                                {tm(r.clock_out)}
                              </span>
                              {r.out_distance !== null && (
                                <span className="block text-xs text-[#4A5A70]">
                                  {far(r.out_distance)} from school ·{" "}
                                  <MapLink
                                    lat={r.out_lat}
                                    lng={r.out_lng}
                                    label={`${r.name}'s clock-out`}
                                  />
                                </span>
                              )}
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>
                          <Pill kind={kind}>{st}</Pill>
                          {r.note && (
                            <span className="block text-xs text-[#4A5A70]">
                              {r.note}
                            </span>
                          )}
                        </td>
                        <td>
                          <ul className="flex flex-col gap-1 text-xs">
                            {leftEarly(r) && closeAt && (
                              <li className="font-bold text-[#7A5300]">
                                Left early (before {ampm(closeAt)})
                              </li>
                            )}
                            {noOut(r) && (
                              <li className="font-bold text-[#7A5300]">
                                Didn&apos;t clock out
                              </li>
                            )}
                            {tries.map((t, i) => (
                              <li
                                key={i}
                                className={
                                  t.outcome === "too_far"
                                    ? "font-bold text-[#912018]"
                                    : "text-[#4A5A70]"
                                }
                              >
                                {t.outcome === "too_far"
                                  ? `Tried to clock ${t.kind} ${far(t.distance)} from school`
                                  : t.outcome === "too_vague"
                                    ? `Tried to clock ${t.kind}; location too vague`
                                    : `Tried to clock ${t.kind}; school location not set`}{" "}
                                at {tm(t.at)}{" "}
                                {t.outcome === "too_far" && (
                                  <MapLink
                                    lat={t.lat}
                                    lng={t.lng}
                                    label={`where ${r.name} tried from`}
                                  />
                                )}
                              </li>
                            ))}
                            {r.duty_state === "pending" && (
                              <li className="rounded-lg bg-[#EEF3F9] p-2 text-[#173B70]">
                                <strong>Official duty request:</strong>{" "}
                                {r.duty_request}
                                {canMark && date === today && (
                                  <span className="mt-1.5 flex gap-1.5">
                                    <ActionForm action={decideDuty}>
                                      <input
                                        type="hidden"
                                        name="user"
                                        value={r.id}
                                      />
                                      <input
                                        type="hidden"
                                        name="date"
                                        value={date}
                                      />
                                      <input
                                        type="hidden"
                                        name="decision"
                                        value="approve"
                                      />
                                      <SubmitButton
                                        className="s-btn2 !min-h-[36px] !py-1"
                                        pending="…"
                                      >
                                        Approve
                                        <span className="sr-only">
                                          {" "}
                                          {r.name}&apos;s official duty
                                        </span>
                                      </SubmitButton>
                                    </ActionForm>
                                    <ActionForm action={decideDuty}>
                                      <input
                                        type="hidden"
                                        name="user"
                                        value={r.id}
                                      />
                                      <input
                                        type="hidden"
                                        name="date"
                                        value={date}
                                      />
                                      <input
                                        type="hidden"
                                        name="decision"
                                        value="decline"
                                      />
                                      <SubmitButton
                                        className="s-btn2 !min-h-[36px] !py-1"
                                        pending="…"
                                      >
                                        Decline
                                        <span className="sr-only">
                                          {" "}
                                          {r.name}&apos;s official duty
                                        </span>
                                      </SubmitButton>
                                    </ActionForm>
                                  </span>
                                )}
                              </li>
                            )}
                            {r.duty_state === "approved" && r.duty_request && (
                              <li className="text-[#173B70]">
                                Official duty: {r.duty_request}
                              </li>
                            )}
                            {r.duty_state === "declined" && (
                              <li className="text-[#4A5A70]">
                                Duty request declined
                              </li>
                            )}
                          </ul>
                        </td>
                        <td>
                          {canMark ? (
                            <ActionForm
                              action={clockStaff}
                              className="flex flex-wrap items-center gap-1.5"
                            >
                              <input type="hidden" name="user" value={r.id} />
                              <input type="hidden" name="date" value={date} />
                              <label className="sr-only" htmlFor={`o-${r.id}`}>
                                Mark {r.name} as
                              </label>
                              <select
                                id={`o-${r.id}`}
                                name="action"
                                className="sk-input sk-select py-2"
                                defaultValue=""
                              >
                                <option value="" disabled>
                                  —
                                </option>
                                {!r.clock_in && (
                                  <option value="absent">Absent</option>
                                )}
                                {!r.clock_in && (
                                  <option value="leave">On leave</option>
                                )}
                                <option value="duty">Official duty</option>
                              </select>
                              <SubmitButton className="s-btn2" pending="…">
                                Mark<span className="sr-only"> {r.name}</span>
                              </SubmitButton>
                            </ActionForm>
                          ) : (
                            <span className="text-xs text-[#4A5A70]">
                              Principal marks
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>
              {q && rows.length
                ? noMatch(q, "staff")
                : "No staff yet. Invite staff on the Staff page."}
            </Empty>
          )}
        </Panel>
      ) : (
        <Panel id="mon-h" title={`Staff attendance summary for ${monthName}`}>
          <form method="get" className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="tab" value="month" />
            {q && <input type="hidden" name="q" value={q} />}
            <div>
              <label className="label" htmlFor="sa-month">
                Month
              </label>
              <input
                id="sa-month"
                name="month"
                type="month"
                className="sk-input py-2"
                defaultValue={month}
                max={today.slice(0, 7)}
              />
            </div>
            <button className="s-btn2">Show</button>
          </form>
          {((monthData as Month[] | null)?.length ?? 0) > 6 && (
            <SearchBar
              id="sm-q"
              label="Find a staff member"
              placeholder="Name"
              q={q}
              keep={{ tab: "month", month }}
              clearHref={`/admin/staff-attendance?tab=month&month=${month}`}
              compact
            />
          )}
          {monthRows.length ? (
            <div
              className="overflow-x-auto"
              tabIndex={0}
              role="region"
              aria-label="Monthly summary: scroll sideways to see more"
            >
              <table className="tbl min-w-[900px]">
                <caption className="sr-only">
                  Staff attendance summary for {monthName}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Staff</th>
                    <th scope="col">Days present</th>
                    <th scope="col">Late</th>
                    <th scope="col">Left early</th>
                    <th scope="col">No clock-out</th>
                    <th scope="col">Days tried from outside</th>
                    <th scope="col">Absent</th>
                    <th scope="col">Leave or duty</th>
                    <th scope="col">Average clock in</th>
                  </tr>
                </thead>
                <tbody>
                  {monthRows.map((m) => (
                    <tr key={m.id}>
                      <th scope="row">{m.name}</th>
                      <td>{m.present}</td>
                      <td className={m.late ? "font-bold text-[#7A5300]" : ""}>
                        {m.late}
                      </td>
                      <td
                        className={
                          m.left_early ? "font-bold text-[#7A5300]" : ""
                        }
                      >
                        {m.left_early ?? 0}
                      </td>
                      <td
                        className={m.no_out ? "font-bold text-[#7A5300]" : ""}
                      >
                        {m.no_out ?? 0}
                      </td>
                      <td
                        className={m.outside ? "font-bold text-[#912018]" : ""}
                      >
                        {m.outside ?? 0}
                      </td>
                      <td
                        className={m.absent ? "font-bold text-[#912018]" : ""}
                      >
                        {m.absent}
                      </td>
                      <td>{m.leave + m.duty}</td>
                      <td>{ampm(m.avg_in)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>
              {q && (monthData as Month[] | null)?.length
                ? noMatch(q, "staff")
                : "No staff yet."}
            </Empty>
          )}
        </Panel>
      )}

      {isOwner && geo && (
        <Panel
          id="clockset-h"
          title="Clock-in settings"
          tip="Only the school owner can change these, so nobody can move the school's location."
        >
          <ClockSettings
            lat={geo.geo_lat}
            lng={geo.geo_lng}
            radius={geo.geo_radius_m ?? 100}
            lateAfter={lateAfter}
            closeAt={closeAt}
          />
        </Panel>
      )}
    </AdminPage>
  );
}
