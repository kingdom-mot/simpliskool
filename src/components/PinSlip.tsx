/** A cut-out sign-in slip for a student who uses admission number + PIN. */
export type Slip = { name: string; className: string; admissionNo: string; pin: string };

export function PinSlip({ slip, schoolName, schoolCode, loginHost }: { slip: Slip; schoolName: string; schoolCode: string; loginHost: string }) {
  return (
    <article className="pin-slip flex break-inside-avoid flex-col gap-3 rounded-2xl border-2 border-dashed border-[#9AA9BF] bg-white p-5 text-brand-slate">
      <header className="flex items-center justify-between gap-3 border-b border-[#E3EAF3] pb-2.5">
        <span className="font-heading text-base font-extrabold text-c1">{schoolName}</span>
        <span className="text-xs font-bold uppercase tracking-[0.06em] text-[#4A5A70]">Student sign-in</span>
      </header>
      <div>
        <div className="font-heading text-xl font-extrabold">{slip.name}</div>
        <div className="text-sm text-[#4A5A70]">{slip.className}</div>
      </div>
      <dl className="grid grid-cols-3 gap-3 text-sm">
        <div>
          <dt className="text-xs font-bold text-[#4A5A70]">School code</dt>
          <dd className="font-mono text-base font-bold">{schoolCode}</dd>
        </div>
        <div>
          <dt className="text-xs font-bold text-[#4A5A70]">Admission no.</dt>
          <dd className="font-mono text-base font-bold">{slip.admissionNo}</dd>
        </div>
        <div>
          <dt className="text-xs font-bold text-[#4A5A70]">PIN</dt>
          <dd className="font-mono text-2xl font-black tracking-[0.3em] text-c1">{slip.pin}</dd>
        </div>
      </dl>
      <p className="text-[13px] leading-snug text-[#4A5A70]">
        Go to <strong className="text-brand-slate">{loginHost}/login</strong>, choose <strong className="text-brand-slate">Student PIN</strong> and type the three codes above. Keep this slip safe. If you forget your PIN, ask your class teacher for a new one.
      </p>
    </article>
  );
}
