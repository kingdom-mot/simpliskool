import Link from "next/link";
import { MobileShell } from "@/components/MobileShell";
import { Bar, Empty, ICONS, Icon, Pill, TONES } from "@/components/ui";
import type { ShellSchool } from "@/components/PortalShell";
import { greeting, naira, pct, TERM_NAME, when } from "@/lib/format";
import { PARENT_TABS } from "@/lib/nav";

type Child = {
  id: string;
  first_name: string;
  last_name: string;
  class: string;
  today: "present" | "absent" | "late" | null;
  fee_total: number | null;
  fee_paid: number | null;
  att_days: number;
  att_present: number;
  average: number | null;
};
export type ParentData = {
  today: string;
  term: { term_no: number; session: string } | null;
  children: Child[];
  announcements: { title: string; body: string; at: string }[];
};

const AVATAR = ["#3FD1B4", "#F4B740", "#93C5FD", "#F9A8D4", "#C4B5FD"];

export function ParentView({ school, fullName, d, childId, basePath = "/parent" }: { school: ShellSchool; fullName: string; d: ParentData | null; childId?: string; basePath?: string }) {
  const kids = d?.children ?? [];
  const kid = kids.find((k) => k.id === childId) ?? kids[0];
  const termName = d?.term ? TERM_NAME[d.term.term_no] : "This term";

  return (
    <MobileShell school={school} title={`${greeting()}, ${fullName}`} tabs={PARENT_TABS} active="home">
      {kids.length === 0 ? (
        <Empty>No children are linked to your account yet. Please contact the school.</Empty>
      ) : (
        <>
          {kids.length > 1 && (
            <div role="group" aria-label="Choose a child" className="flex gap-2 overflow-x-auto pb-0.5">
              {kids.map((k, i) => {
                const on = k.id === kid.id;
                return (
                  <Link
                    key={k.id}
                    href={`${basePath}?child=${k.id}`}
                    aria-current={on ? "true" : undefined}
                    className={`flex min-h-[48px] flex-none items-center gap-2 rounded-full border-[1.5px] py-1.5 pl-1.5 pr-3.5 text-sm ${on ? "border-c1 bg-c1 font-extrabold text-white" : "border-[#DCE5F0] bg-white font-semibold text-brand-slate"}`}
                  >
                    <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-extrabold text-[#1B2433]" style={{ background: AVATAR[i % AVATAR.length] }}>
                      {(k.first_name[0] ?? "") + (k.last_name[0] ?? "")}
                    </span>
                    {k.first_name} · {k.class || "No class"}
                  </Link>
                );
              })}
            </div>
          )}

          <TodayCard kid={kid} />

          <FeeCard kid={kid} termName={termName} />

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1 rounded-[18px] border p-4" style={{ background: TONES.purple.bg, borderColor: TONES.purple.border }}>
              <span className="text-[13px] font-bold" style={{ color: TONES.purple.fg }}>
                {termName} average
              </span>
              <span className="font-heading text-2xl font-black" style={{ color: TONES.purple.fg }}>
                {kid.average ?? "—"}
              </span>
              <span className="text-[13px] text-[#34445A]">{kid.average ? "Released results" : "Shows when results are released"}</span>
            </div>
            <div className="flex flex-col gap-1 rounded-[18px] border p-4" style={{ background: TONES.blue.bg, borderColor: TONES.blue.border }}>
              <span className="text-[13px] font-bold" style={{ color: TONES.blue.fg }}>
                Attendance
              </span>
              <span className="font-heading text-2xl font-black" style={{ color: TONES.blue.fg }}>
                {kid.att_days ? `${pct(kid.att_present, kid.att_days)}%` : "—"}
              </span>
              <span className="text-[13px] text-[#34445A]">{kid.att_days ? `${kid.att_present} of ${kid.att_days} days this term` : "No registers yet this term"}</span>
            </div>
          </div>
        </>
      )}

      {d?.announcements.map((a) => (
        <div key={a.at + a.title} className="flex flex-col gap-1 rounded-[18px] bg-[#FFF6E3] p-4">
          <span className="text-xs font-extrabold text-[#7A5300]">FROM THE SCHOOL · {when(a.at, d.today).toUpperCase()}</span>
          <span className="text-[15px] font-bold text-c1">{a.title}</span>
          <span className="text-sm text-[#5C4310]">{a.body}</span>
        </div>
      ))}
    </MobileShell>
  );
}

function TodayCard({ kid }: { kid: Child }) {
  const state = kid.today;
  const look =
    state === "present"
      ? { bg: "#E7F6F2", fg: "#0B6B5A", title: `${kid.first_name} is in school today`, text: "Marked present by the class teacher.", icon: "M20 6 9 17l-5-5" }
      : state === "late"
        ? { bg: "#FFF6E3", fg: "#7A5300", title: `${kid.first_name} arrived late today`, text: "Marked late by the class teacher.", icon: ICONS.clock }
        : state === "absent"
          ? { bg: "#FEF3F2", fg: "#912018", title: `${kid.first_name} was marked absent today`, text: "Please contact the school if this is wrong.", icon: "M18 6 6 18M6 6l12 12" }
          : { bg: "#EEF3F9", fg: "#173B70", title: "Today's register isn't in yet", text: `You'll see here when ${kid.first_name} is marked.`, icon: ICONS.clock };
  return (
    <section aria-labelledby="today-h" className="flex items-center gap-3 rounded-[18px] p-4" style={{ background: look.bg }}>
      <span aria-hidden="true" className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-white" style={{ color: look.fg }}>
        <Icon d={look.icon} size={22} width={2.4} />
      </span>
      <div>
        <h2 id="today-h" className="text-base" style={{ color: look.fg }}>
          {look.title}
        </h2>
        <p className="mt-0.5 text-sm">{look.text}</p>
      </div>
    </section>
  );
}

function FeeCard({ kid, termName }: { kid: Child; termName: string }) {
  const total = kid.fee_total ?? 0;
  const paid = kid.fee_paid ?? 0;
  const balance = total - paid;
  const p = pct(paid, total);
  return (
    <section aria-labelledby="fee-h" className="flex flex-col gap-2.5 rounded-[18px] border border-[#E3EAF3] bg-white p-[18px]">
      <div className="flex items-center justify-between">
        <h2 id="fee-h" className="text-base !text-c1">
          {termName} fees
        </h2>
        {kid.fee_total === null ? <Pill kind="info">Not billed yet</Pill> : balance <= 0 ? <Pill kind="good">Paid</Pill> : <Pill kind={paid > 0 ? "warn" : "bad"}>{paid > 0 ? "Part paid" : "Unpaid"}</Pill>}
      </div>
      {kid.fee_total === null ? (
        <p className="text-sm text-[#4A5A70]">The school hasn&apos;t sent this term&apos;s fees yet.</p>
      ) : (
        <>
          <div className="font-heading text-[28px] font-black text-c1">
            {naira(Math.max(balance, 0))} <span className="font-sans text-sm font-semibold text-[#4A5A70]">{balance <= 0 ? "Paid in full" : `left of ${naira(total)}`}</span>
          </div>
          <Bar value={p} fill="var(--c2,#0B7D6E)" label="Fees paid" />
          <Link className="s-link text-sm" href="/parent/fees">
            {balance > 0 ? "See the bill and how to pay" : "See the bill and receipts"}
          </Link>
        </>
      )}
    </section>
  );
}
