import Link from "next/link";
import { AdminPage, PageHero } from "@/components/admin";
import { ActionForm, SubmitButton } from "@/components/forms";
import { MobileShell } from "@/components/MobileShell";
import { PortalShell } from "@/components/PortalShell";
import { requireSchool, ROLE_LABEL, type Role } from "@/lib/auth";
import { PARENT_TABS, STUDENT_TABS, TEACHER_NAV } from "@/lib/nav";
import { saveMessages, saveName, signOutEverywhere } from "./actions";

export const metadata = { title: "My account" };

const ALL: Role[] = ["owner", "admin", "principal", "bursar", "teacher", "parent", "student"];

export default async function Account() {
  const ctx = await requireSchool(ALL);
  const { supabase, user, school, membership, memberships } = ctx;
  const [{ data: me }, { data: off }] = await Promise.all([
    supabase.from("profiles").select("full_name, email, phone").eq("id", user.id).maybeSingle<{ full_name: string | null; email: string | null; phone: string | null }>(),
    supabase.from("message_optouts").select("channel").eq("user_id", user.id).returns<{ channel: string }[]>(),
  ]);
  const role = membership.role;
  const family = role === "parent" || role === "student";
  const isStudent = role === "student";
  const noEmail = (off ?? []).some((o) => o.channel === "email");
  const noSms = (off ?? []).some((o) => o.channel === "sms");
  const email = me?.email && !me.email.endsWith("@students.simpliskool.com") ? me.email : null;
  const card = "flex flex-col gap-3 rounded-[18px] border border-[#E3EAF3] bg-white p-[18px]";

  const body = (
    <div className="flex flex-col gap-4">
      <section aria-labelledby="me-h" className={card}>
        <h2 id="me-h" className="text-base !text-c1">
          Your details
        </h2>
        {isStudent ? (
          <p className="text-sm text-brand-slate">
            <strong>{me?.full_name}</strong>. Your name is set by the school.
          </p>
        ) : (
          <ActionForm action={saveName} className="flex flex-col gap-3">
            <div className="max-w-md">
              <label className="label" htmlFor="acc-name">
                Full name
              </label>
              <input id="acc-name" name="full_name" required minLength={2} maxLength={120} autoComplete="name" defaultValue={me?.full_name ?? ""} className="sk-input" />
            </div>
            <div>
              <SubmitButton>Save name</SubmitButton>
            </div>
          </ActionForm>
        )}
        <dl className="grid grid-cols-[minmax(0,1fr)] gap-2 text-sm sm:grid-cols-2">
          {!isStudent && (
            <>
              <div>
                <dt className="text-xs font-bold uppercase tracking-[0.05em] text-[#4A5A70]">Email</dt>
                <dd className="break-words text-brand-slate">{email ?? "None"}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-[0.05em] text-[#4A5A70]">Phone</dt>
                <dd className="text-brand-slate">{me?.phone ?? "None"}</dd>
              </div>
            </>
          )}
        </dl>
        <p className="text-[13px] text-[#4A5A70]">
          {isStudent
            ? "You sign in with your admission number and PIN. If you forget your PIN, ask your class teacher for a new slip."
            : `You sign in with a one-time code sent to your ${email && me?.phone ? "email or phone" : email ? "email" : "phone"}. To change ${email && me?.phone ? "them" : "it"}, ask ${family ? "the school office" : "the school owner"}: the school uses it to reach you.`}
        </p>
      </section>

      {!isStudent && (
        <section aria-labelledby="msg-h" className={card}>
          <h2 id="msg-h" className="text-base !text-c1">
            Messages from the school
          </h2>
          <ActionForm action={saveMessages} className="flex flex-col gap-2">
            <label className="flex min-h-[44px] items-center gap-3 text-sm font-semibold text-brand-slate">
              <input type="checkbox" name="email" value="1" defaultChecked={!noEmail} className="h-5 w-5" /> Email me {family ? "about absences, fees, results and notices" : "school notices and reminders"}
            </label>
            <label className="flex min-h-[44px] items-center gap-3 text-sm font-semibold text-brand-slate">
              <input type="checkbox" name="sms" value="1" defaultChecked={!noSms} className="h-5 w-5" /> Text me (if the school sends texts)
            </label>
            <p className="text-[13px] text-[#4A5A70]">Everything is always in the app as well. Sign-in codes are always sent.</p>
            <div>
              <SubmitButton>Save</SubmitButton>
            </div>
          </ActionForm>
        </section>
      )}

      <section aria-labelledby="sch-h" className={card}>
        <h2 id="sch-h" className="text-base !text-c1">
          Your schools
        </h2>
        <ul className="flex flex-col">
          {memberships.map((m) => (
            <li key={m.school_id + m.role} className="flex min-h-[44px] items-center justify-between gap-2 border-b border-[#EEF3F9] text-sm last:border-0">
              <span>
                <strong className="text-brand-slate">{m.schools?.name ?? "School"}</strong> · {ROLE_LABEL[m.role]}
              </span>
              {m.school_id === school.id && m.role === role && <span className="text-xs font-bold text-[#0B6B5A]">Now using</span>}
            </li>
          ))}
        </ul>
        {memberships.length > 1 && (
          <Link href="/dashboard" className="s-btn2 self-start">
            Switch school or role
          </Link>
        )}
      </section>

      <section aria-labelledby="sec-h" className={card}>
        <h2 id="sec-h" className="text-base !text-c1">
          Security
        </h2>
        <p className="text-sm text-brand-slate">Lost a phone, or signed in on a shared computer? Sign out everywhere, then sign in again on your own device.</p>
        <ActionForm action={signOutEverywhere}>
          <SubmitButton className="s-btn-danger" pending="Signing out…">
            Sign out on all devices
          </SubmitButton>
        </ActionForm>
        <p className="text-[13px] text-[#4A5A70]">
          How we use your information:{" "}
          <Link href="/help" className="font-bold text-c1 underline">
            help and privacy
          </Link>
          .
        </p>
      </section>
    </div>
  );

  if (role === "parent" || role === "student")
    return (
      <MobileShell school={school} title="My account" tabs={role === "parent" ? PARENT_TABS : STUDENT_TABS} active="home">
        {body}
      </MobileShell>
    );
  if (role === "teacher")
    return (
      <PortalShell school={school} roleLabel="Teacher" fullName={ctx.fullName} groups={TEACHER_NAV} active="">
        <div className="flex flex-col gap-5">
          <PageHero title="My account" />
          {body}
        </div>
      </PortalShell>
    );
  return (
    <AdminPage ctx={{ ...ctx, membership }} active="" crumb={[{ label: "My account" }]} title="My account">
      {body}
    </AdminPage>
  );
}
