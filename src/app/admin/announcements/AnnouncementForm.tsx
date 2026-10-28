"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { sendAnnouncement } from "./actions";

type Audience = "school" | "parents" | "class" | "staff";

export function AnnouncementForm({ schoolName, classes, reach, emailReady }: { schoolName: string; classes: { id: string; label: string; reach: number }[]; reach: Record<"school" | "parents" | "staff", number>; emailReady: boolean }) {
  const [aud, setAud] = useState<Audience>("parents");
  const [picked, setPicked] = useState<string[]>([]);
  const [kind, setKind] = useState<"notice" | "event">("notice");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const classReach = classes.filter((c) => picked.includes(c.id)).reduce((a, c) => a + c.reach, 0);
  const options: { id: Audience; label: string; note: string }[] = [
    { id: "school", label: "Whole school", note: `everyone (${reach.school})` },
    { id: "parents", label: "All parents", note: `${reach.parents} parent${reach.parents === 1 ? "" : "s"}` },
    { id: "class", label: "Selected classes", note: picked.length ? `parents and students of ${picked.length} class${picked.length === 1 ? "" : "es"} (about ${classReach})` : "choose classes" },
    { id: "staff", label: "Staff only", note: `${reach.staff} staff` },
  ];
  const cur = options.find((o) => o.id === aud)!;
  const count = aud === "class" ? classReach : reach[aud];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 xl:grid-cols-[1.4fr_1fr]">
      <ActionForm
        action={sendAnnouncement}
        resetOnSuccess
        onSuccess={() => {
          setTitle("");
          setBody("");
          setPicked([]);
          setKind("notice");
        }}
        className="flex flex-col gap-4 rounded-[18px] border border-[#E3EAF3] bg-white p-[22px]">
        <h2 className="text-lg !text-c1">New announcement</h2>
        <fieldset className="flex flex-wrap gap-2">
          <legend className="label">Type</legend>
          {(["notice", "event"] as const).map((k) => (
            <label key={k} className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border-[1.5px] border-[#DCE5F0] px-4 text-sm font-bold has-[:checked]:border-c2 has-[:checked]:bg-[#F3FBF9] has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-c2">
              <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="h-4 w-4" />
              {k === "notice" ? "Notice" : "Event (parents can say if they'll attend)"}
            </label>
          ))}
        </fieldset>
        <div>
          <label className="label" htmlFor="a-title">
            Title
          </label>
          <input id="a-title" name="title" className="sk-input" required minLength={3} maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. PTA meeting on Saturday, 14 November" />
        </div>
        <div>
          <label className="label" htmlFor="a-body">
            Message
          </label>
          <textarea id="a-body" name="body" rows={6} required maxLength={3000} className="sk-input min-h-[150px] py-3" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Dear parents, ..." />
        </div>
        {kind === "event" && (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="a-date">
                Event date
              </label>
              <input id="a-date" name="event_date" type="date" className="sk-input" required />
            </div>
            <div>
              <label className="label" htmlFor="a-time">
                Time
              </label>
              <input id="a-time" name="event_time" type="time" className="sk-input" defaultValue="10:00" />
            </div>
          </div>
        )}
        <fieldset className="flex flex-col gap-2">
          <legend className="label">Who should get it?</legend>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-2">
            {options.map((o) => (
              <label key={o.id} className="flex min-h-[56px] cursor-pointer items-center gap-3 rounded-xl border-[1.5px] border-[#DCE5F0] px-3 py-2 has-[:checked]:border-c2 has-[:checked]:bg-[#F3FBF9] has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-c2">
                <input type="radio" name="audience" value={o.id} checked={aud === o.id} onChange={() => setAud(o.id)} className="h-4 w-4" />
                <span>
                  <span className="block text-sm font-bold text-brand-slate">{o.label}</span>
                  <span className="block text-xs text-[#4A5A70]">{o.note}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        {aud === "class" && (
          <fieldset className="flex flex-col gap-2">
            <legend className="label">Classes</legend>
            <div className="flex flex-wrap gap-2">
              {classes.map((c) => (
                <label key={c.id} className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border-[1.5px] border-[#DCE5F0] px-3 text-sm font-bold has-[:checked]:border-c1 has-[:checked]:bg-c1 has-[:checked]:text-white has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-c2">
                  <input type="checkbox" name="class" value={c.id} className="sr-only" checked={picked.includes(c.id)} onChange={(e) => setPicked(e.target.checked ? [...picked, c.id] : picked.filter((x) => x !== c.id))} />
                  {c.label}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <fieldset className="flex flex-col gap-2">
          <legend className="label">Send by</legend>
          <label className="flex min-h-[44px] items-center gap-2 text-sm font-semibold text-brand-slate">
            <input type="checkbox" checked disabled className="h-5 w-5" /> In the app (always)
          </label>
          <label className="flex min-h-[44px] items-center gap-2 text-sm font-semibold text-brand-slate">
            <input type="checkbox" name="email" value="1" defaultChecked={emailReady} disabled={!emailReady} className="h-5 w-5" /> Email
          </label>
          <label className="flex min-h-[44px] items-center gap-2 text-sm font-semibold text-[#4A5A70]">
            <input type="checkbox" disabled className="h-5 w-5" /> SMS and WhatsApp (coming in a later release)
          </label>
          {!emailReady && <span className="text-[13px] text-[#4A5A70]">Email isn&apos;t switched on yet, so this goes to the app only.</span>}
        </fieldset>
        <div>
          <SubmitButton pending="Sending…">Send to {cur.id === "class" && !picked.length ? "selected classes" : `${count} ${count === 1 ? "person" : "people"}`}</SubmitButton>
        </div>
      </ActionForm>

      <section aria-labelledby="pv-h" className="flex flex-col gap-3 rounded-[18px] border border-[#E3EAF3] bg-white p-[22px]">
        <h2 id="pv-h" className="text-lg !text-c1">
          How parents will see it
        </h2>
        <div className="overflow-hidden rounded-2xl border border-[#E3EAF3]">
          <div className="bg-c1 px-4 py-2 text-xs font-extrabold tracking-[0.08em] text-white">
            {schoolName.toUpperCase()} · {kind === "event" ? "EVENT" : "ANNOUNCEMENT"}
          </div>
          <div className="flex flex-col gap-1.5 p-4">
            <span className="font-heading text-base font-extrabold text-brand-slate">{title || "Your title shows here"}</span>
            <span className="line-clamp-4 whitespace-pre-line text-sm text-[#34445A]">{body || "Your message shows here."}</span>
          </div>
        </div>
      </section>
    </div>
  );
}
