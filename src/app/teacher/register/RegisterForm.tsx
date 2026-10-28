"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { enqueue, flushQueue, getDraft, isQueued, saveDraft, upload, type Mark } from "@/lib/register-queue";
import { personInitials } from "@/lib/format";

type Status = Mark["status"];
type Student = { id: string; name: string; reported?: string | null };

const OPTS: { id: Status; label: string; on: string }[] = [
  { id: "present", label: "Present", on: "var(--c2,#0B7D6E)" },
  { id: "absent", label: "Absent", on: "#B42318" },
  { id: "late", label: "Late", on: "#8A5A00" },
];
const AVATAR = ["#CFF3EC", "#D9E7FF", "#FFEDC2", "#EADBFF", "#FFDDEB", "#D3F8E2"];

function lagosToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date());
}

const noop = () => () => {};
function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

type Props = {
  classId: string;
  className: string;
  date: string;
  dateChosen: boolean;
  students: Student[];
  saved: Record<string, Status>;
};

/** The register reads this phone's saved drafts, so it renders once the page is running in the browser. */
export function RegisterForm(props: Props) {
  const hydrated = useSyncExternalStore(noop, () => true, () => false);
  if (!hydrated) {
    return (
      <ul aria-label={`Students in ${props.className}`} className="flex flex-col rounded-[18px] border border-[#E3EAF3] bg-white">
        {props.students.map((s) => (
          <li key={s.id} className="border-b border-[#EEF3F9] px-4 py-5 font-bold text-c1 last:border-b-0">
            {s.name}
          </li>
        ))}
      </ul>
    );
  }
  return <Register {...props} />;
}

function Register({
  classId,
  className,
  date: serverDate,
  dateChosen,
  students,
  saved,
}: {
  classId: string;
  className: string;
  date: string;
  /** True when the teacher picked a date; false means "today". */
  dateChosen: boolean;
  students: Student[];
  /** Marks already saved on the server for this date. */
  saved: Record<string, Status>;
}) {
  // A page opened from the phone's offline copy may be from an earlier day: use today then.
  const [start] = useState(() => {
    const today = lagosToday();
    const d = !dateChosen && serverDate !== today ? today : serverDate;
    const draft = getDraft(classId, d);
    const fromServer = d === serverDate ? saved : {};
    return { date: d, marks: draft ?? fromServer, queued: isQueued(classId, d), hasSaved: Object.keys(fromServer).length > 0 };
  });
  const date = start.date;
  const [marks, setMarks] = useState<Record<string, Status>>(start.marks);
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const [state, setState] = useState<{ kind: "idle" | "saving" | "saved" | "queued" | "error"; text: string }>(
    start.queued
      ? { kind: "queued", text: "Saved on this phone · will upload when you're back online" }
      : start.hasSaved
        ? { kind: "saved", text: "Register already taken. Change anything and save again." }
        : { kind: "idle", text: "Not saved yet" },
  );
  const [synced, setSynced] = useState<string | null>(null);

  const sync = useCallback(async () => {
    const { uploaded, failed } = await flushQueue();
    if (uploaded.length) {
      const names = uploaded.map((r) => `${r.class_name} (${r.date})`).join(", ");
      setSynced(`Back online: uploaded ${uploaded.length} saved register${uploaded.length === 1 ? "" : "s"}: ${names}.`);
      if (uploaded.some((r) => r.class_id === classId && r.date === date)) setState({ kind: "saved", text: "Saved and uploaded" });
    }
    if (failed.length) setSynced(`Couldn't upload ${failed.map((f) => `${f.r.class_name} (${f.r.date})`).join(", ")}: ${failed[0].error}`);
  }, [classId, date]);

  // Upload saved registers when the connection comes back, and once on opening.
  useEffect(() => {
    const on = () => void sync();
    window.addEventListener("online", on);
    const t = window.setTimeout(on, 0);
    return () => {
      window.removeEventListener("online", on);
      window.clearTimeout(t);
    };
  }, [sync]);

  // Children whose parents reported an absence start as absent.
  const value = (id: string): Status => marks[id] ?? (students.find((s) => s.id === id)?.reported ? "absent" : "present");
  const counts = useMemo(() => {
    const c = { present: 0, absent: 0, late: 0 };
    for (const s of students) c[value(s.id)]++;
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marks, students]);

  function pick(id: string, status: Status) {
    const next = { ...marks, [id]: status };
    setMarks(next);
    // Keep a draft on the phone so nothing is lost if the page closes before saving.
    saveDraft(classId, date, next);
    if (state.kind === "saved" || state.kind === "queued") setState({ kind: "idle", text: "Changed · not saved yet" });
  }

  async function save() {
    const payload = { class_id: classId, date, marks: students.map((s) => ({ student_id: s.id, status: value(s.id) })) };
    setState({ kind: "saving", text: "Saving…" });
    const res = navigator.onLine ? await upload(payload) : { ok: false as const, offline: true, error: "" };
    if (res.ok) {
      saveDraft(classId, date, null);
      setState({ kind: "saved", text: `Saved · ${res.present} present, ${res.absent} absent, ${res.late} late` });
    } else if (res.offline) {
      enqueue({ ...payload, class_name: className, queued_at: new Date().toISOString() });
      setState({ kind: "queued", text: "Saved on this phone · will upload when you're back online" });
    } else {
      setState({ kind: "error", text: res.error });
    }
  }

  const longDate = new Date(`${date}T12:00:00+01:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Lagos" });

  return (
    <div className="flex flex-col gap-4 pb-24">
      <p className="text-sm text-[#4A5A70]">
        {longDate}
        {date !== lagosToday() ? " · correcting an earlier day" : ""}
      </p>

      {!online && (
        <div role="status" className="rounded-2xl border-2 border-[#F4B740] bg-[#FFF6E3] p-4 text-[15px] text-[#5C4310]">
          <strong>You&apos;re offline.</strong> Keep going. The register is saved on this phone and will upload by itself when you&apos;re back online.
        </div>
      )}
      {synced && (
        <div role="status" className="rounded-2xl bg-[#E7F6F2] p-4 text-[15px] font-semibold text-[#0B6B5A]">
          {synced}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-[#E3EAF3] bg-white p-4">
        <div aria-live="polite" className="flex flex-wrap gap-2">
          <span className="rounded-full bg-[#E7F6F2] px-3 py-1.5 text-sm font-extrabold text-[#0B6B5A]">{counts.present} present</span>
          <span className="rounded-full bg-[#FEF3F2] px-3 py-1.5 text-sm font-extrabold text-[#912018]">{counts.absent} absent</span>
          <span className="rounded-full bg-[#FFF6E3] px-3 py-1.5 text-sm font-extrabold text-[#7A5300]">{counts.late} late</span>
        </div>
        <span className="text-sm text-[#4A5A70]">Everyone starts as present. Tap only those who aren&apos;t.</span>
      </div>

      <ul aria-label={`Students in ${className}`} className="flex flex-col rounded-[18px] border border-[#E3EAF3] bg-white">
        {students.map((s, i) => {
          const v = value(s.id);
          return (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EEF3F9] px-4 py-3 last:border-b-0">
              <span className="flex min-w-0 items-center gap-3">
                <span aria-hidden="true" className="flex h-10 w-10 flex-none items-center justify-center rounded-full text-xs font-extrabold text-[#1B2433]" style={{ background: AVATAR[i % AVATAR.length] }}>
                  {personInitials(s.name)}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="font-bold text-c1">{s.name}</span>
                  {s.reported && <span className="text-xs font-semibold text-[#173B70]">Parent reported: {s.reported}</span>}
                </span>
              </span>
              <span role="group" aria-label={s.name} className="flex gap-1.5">
                {OPTS.map((o) => {
                  const on = v === o.id;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => pick(s.id, o.id)}
                      className="min-h-[44px] min-w-[76px] rounded-xl border-[1.5px] px-3 text-sm font-bold"
                      style={on ? { background: o.on, borderColor: o.on, color: "#FFFFFF" } : { background: "#FFFFFF", borderColor: "#C9D6EA", color: "#263449" }}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#E3EAF3] bg-white/95 px-4 py-3 backdrop-blur md:mx-0 md:rounded-[18px] md:border">
        <span
          role="status"
          className="text-sm font-bold"
          style={{ color: state.kind === "saved" ? "#0B6B5A" : state.kind === "queued" ? "#7A5300" : state.kind === "error" ? "#912018" : "#4A5A70" }}
        >
          {state.text}
        </span>
        <button type="button" className="s-btn min-w-[180px]" onClick={save} disabled={state.kind === "saving"}>
          {state.kind === "saving" ? "Saving…" : "Save register"}
        </button>
      </div>
    </div>
  );
}
