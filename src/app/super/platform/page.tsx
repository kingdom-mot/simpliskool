import { Flash } from "@/components/Flash";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Box, SuperShell } from "@/components/super";
import { Pill } from "@/components/ui";
import { paystackReady, paystackTestMode } from "@/lib/paystack";
import { requirePlatform } from "@/lib/platform";
import { FEATURES, getSettings } from "@/lib/platform-settings";
import { savePlatformSettings } from "../actions";

export const metadata = { title: "Platform settings — Simpliskool back office" };

export default async function SuperPlatform() {
  const ctx = await requirePlatform("platform");
  const s = await getSettings();
  const mode = !paystackReady() ? { l: "Not set up", k: "warn" as const } : paystackTestMode() ? { l: "Test mode", k: "warn" as const } : { l: "Live payments", k: "good" as const };

  return (
    <SuperShell ctx={ctx} active="platform" title="Platform settings" sub="Settings that apply to every school. Only super admins can change these, and every change is in the audit log.">
      <Flash />
      <ActionForm action={savePlatformSettings} className="flex flex-col gap-5">
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-2">
          <Box id="ps-h" title="Paystack" actions={<Pill kind={mode.k}>{mode.l}</Pill>}>
            <p className="text-sm text-[#4A5A70]">Test or live is set by which secret key is in Vercel (sk_test_… or sk_live_…), so switching needs a redeploy.</p>
            <dl className="grid grid-cols-2 gap-3">
              {[
                ["Main account", "Dream Savvy Solutions"],
                ["Who pays the charge", "The school, from each payment"],
                ["Charge", "1.5% + ₦100 (no ₦100 under ₦2,500)"],
                ["Most charged per payment", "₦2,000"],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[13px] font-bold text-[#4A5A70]">{k}</dt>
                  <dd className="font-bold">{v}</dd>
                </div>
              ))}
            </dl>
            <div>
              <label className="label" htmlFor="fee">
                Simpliskool fee per payment (₦)
              </label>
              <input id="fee" name="fee" inputMode="decimal" className="sk-input" defaultValue={String(s.fee_kobo / 100)} aria-describedby="fee-h" />
              <p id="fee-h" className="mt-1 text-xs text-[#4A5A70]">
                Recorded for billing plans. Not charged to parents yet.
              </p>
            </div>
          </Box>
          <Box id="fl-h" title="Features">
            <p className="text-sm text-[#4A5A70]">Switching one off hides it for every school, unless a school has its own setting on its Plan tab.</p>
            <ul>
              {FEATURES.map((f) => (
                <li key={f.key} className="border-t border-[#EEF3F9] first:border-t-0">
                  <label className="flex min-h-[52px] items-center justify-between gap-3 py-2">
                    <span>
                      <strong className="block text-[#173B70]">{f.label}</strong>
                      <span className="block text-[13px] text-[#4A5A70]">{f.note}</span>
                    </span>
                    <input type="checkbox" role="switch" name={`flag_${f.key}`} defaultChecked={s.flags[f.key]} className="h-6 w-6 flex-none" />
                  </label>
                </li>
              ))}
            </ul>
          </Box>
          <Box id="df-h" title="Defaults for new schools">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="tl">
                  Free trial
                </label>
                <select id="tl" name="trial_days" className="sk-input" defaultValue={String(s.trial_days)}>
                  <option value="30">30 days</option>
                  <option value="14">14 days</option>
                  <option value="0">None</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="sc">
                  Free SMS credit
                </label>
                <input id="sc" name="free_sms" type="number" min={0} max={100000} className="sk-input" defaultValue={s.free_sms} />
              </div>
              <div>
                <label className="label" htmlFor="sp">
                  Price per SMS to schools
                </label>
                <input id="sp" name="sms_price" className="sk-input" maxLength={20} defaultValue={s.sms_price} placeholder="₦4" />
              </div>
            </div>
          </Box>
          <Box id="sec-h" title="Security">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="pw">
                  Wrong student PINs before lock
                </label>
                <input id="pw" name="pin_tries" type="number" min={3} max={10} className="sk-input" defaultValue={s.pin_tries} />
              </div>
              <div>
                <label className="label" htmlFor="pl2">
                  Lock lasts
                </label>
                <select id="pl2" name="pin_lock_minutes" className="sk-input" defaultValue={String(s.pin_lock_minutes)}>
                  <option value="15">15 minutes</option>
                  <option value="60">1 hour</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="vl">
                  &ldquo;View as school&rdquo; lasts
                </label>
                <select id="vl" name="view_minutes" className="sk-input" defaultValue={String(s.view_minutes)}>
                  <option value="30">30 minutes</option>
                  <option value="60">60 minutes</option>
                </select>
              </div>
              <div>
                <span className="label">Sign-in code expires after</span>
                <p className="text-sm text-[#4A5A70]">Set in Supabase → Authentication → Providers (email OTP expiry).</p>
              </div>
            </div>
          </Box>
        </div>
        <div className="flex justify-end">
          <SubmitButton>Save settings</SubmitButton>
        </div>
      </ActionForm>
    </SuperShell>
  );
}
