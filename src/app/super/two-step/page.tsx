import Image from "next/image";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { ActionForm, SubmitButton } from "@/components/forms";
import { SignOutButton } from "@/components/SignOutButton";
import { PASS_COOKIE, teamMember } from "@/lib/platform";
import { newTotpSecret, otpauthUri, readPass, seal, spaced, unseal } from "@/lib/totp";
import { confirmTwoStep } from "./actions";

export const metadata = { title: "Two-step sign-in — Simpliskool back office" };

export default async function TwoStepPage() {
  const m = await teamMember();
  if (!m) redirect("/dashboard");
  if (m.team.totp_on_at && readPass((await cookies()).get(PASS_COOKIE)?.value, m.user.id)) redirect("/super");
  const setup = !m.team.totp_on_at;
  let secret = unseal(m.team.totp_secret);
  if (setup && !secret) {
    secret = newTotpSecret();
    await m.admin.from("platform_team").update({ totp_secret: seal(secret) }).eq("user_id", m.user.id);
  }
  const svg = setup && secret ? await QRCode.toString(otpauthUri(secret, m.user.email ?? m.user.phone ?? "team"), { type: "svg", margin: 1, width: 200, color: { dark: "#0A1F3D", light: "#FFFFFF" } }) : "";

  return (
    <main id="main" className="flex min-h-screen items-center justify-center bg-brand-mist px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Image src="/simpliskool-logo-dark.png" alt="Simpliskool" width={200} height={45} />
        </div>
        <div className="card flex flex-col gap-4">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-[#0B6B5A]">Dream Savvy back office</p>
            <h1 className="mt-1 text-xl font-semibold text-brand-navy">{setup ? "Set up two-step sign-in" : "Enter your two-step code"}</h1>
          </div>
          {setup ? (
            <>
              <p className="text-sm text-slate-700">Everyone on the team needs this before they can see any school. Open an authenticator app (Google Authenticator, Microsoft Authenticator or 1Password), add an account and scan this code.</p>
              <div className="flex justify-center rounded-xl border border-[#E3EAF3] bg-white p-3" role="img" aria-label="QR code for your authenticator app" dangerouslySetInnerHTML={{ __html: svg }} />
              <p className="text-sm text-slate-700">
                Can&apos;t scan? Type this key instead: <span className="block break-all font-mono text-base font-bold text-brand-navy">{secret ? spaced(secret) : ""}</span>
              </p>
            </>
          ) : (
            <p className="text-sm text-slate-700">Open your authenticator app and enter the 6-digit code for Simpliskool. Lost your phone? Ask a super admin to reset your two-step sign-in.</p>
          )}
          <ActionForm action={confirmTwoStep} className="flex flex-col gap-3">
            <div>
              <label className="label" htmlFor="ts-code">
                6-digit code
              </label>
              <input id="ts-code" name="code" className="sk-input font-mono text-lg tracking-[0.3em]" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} required />
            </div>
            <SubmitButton className="s-btn" pending="Checking…">
              {setup ? "Turn on and continue" : "Continue"}
            </SubmitButton>
          </ActionForm>
          <SignOutButton className="self-start text-sm font-bold text-[#0B6B5A] underline" />
        </div>
      </div>
    </main>
  );
}
