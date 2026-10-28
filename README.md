# Simpliskool

**Simplifying school management.** A product of Dream Savvy Solutions.

Next.js 14 (App Router, TypeScript, Tailwind) + Supabase (Postgres, row-level security, email one-time-code login).

## What's in this foundation

- Database schema for Release 1 with row-level security: every school's data is isolated (`supabase/migrations/0001_foundation.sql`)
- Email one-time-code sign-in (no passwords)
- School onboarding: the signed-in user creates a school and becomes its owner; a default Nigerian grading scale is added
- Role-based homes: `/admin` (owner, admin, bursar), `/teacher`, `/parent`, `/student`
- School chooser at `/dashboard` for people in more than one school or role
- Public school website on each school's subdomain (`brightfuture.simpliskool.com`) with an admissions form
- Simpliskool landing page

## Setup

1. **Supabase**
   - Create a project at supabase.com.
   - Run each file in `supabase/migrations/` **in order, one at a time**: open it, copy **all of its contents**, paste into **SQL Editor → New query** and click **Run**.
     - `0001_foundation.sql`
     - `0002_principal_role.sql` (run it on its own before 0003)
     - `0003_signin_and_principal.sql`
     - `0004_school_colours.sql` (each school picks 0–2 colours from the 20-colour palette)
     - `0005_dashboards.sql` (the numbers on each portal home page)
     - `0006_admin_setup.sql` (sessions and terms, staff list, PIN slips)
     - `0007_attendance_notifications.sql` (school-wide attendance, absence emails)
     - `0009_school_settings.sql` (motto, principal's name, logo storage)
     - `0010_fees.sql` (fee setup, invoices, payments, receipts, defaulters)
     - `0011_results.sql` (score entry, broadsheet, comments, report cards)
     - `0008_grants.sql` (permissions for the app)
     - `0012_timetable_announcements.sql` (timetable, announcements, mark split, approving results). From this file on, each file sets its own permissions, so 0008 doesn't need running again.
     - `0013_school_admin.sql` (admissions, parents, staff attendance, lesson notes, payroll, website editor, grading scale, payout account)
     - `0014_payments_sms_schedule.sql` (online fee payments, SMS settings, scheduled announcements; also switches on pg_cron to release scheduled announcements every minute)
     - `0015_teaching.sql` (homework and marking, question bank, CBT tests, AI assistant allowance, My classes; private "learning" file storage)
     - `0016_family.sql` (parents report absences in advance, excused absences, everyone's email/text choices, teachers' names for families)
   - **Authentication → Sign In / Providers → Email**: keep Email enabled.
   - **Authentication → URL Configuration**: set the Site URL to `https://simpliskool.com` and add these Redirect URLs: `http://localhost:3000/auth/callback` and `https://simpliskool.com/auth/callback` (plus your Vercel preview URL + `/auth/callback`).
   - Sign-in works with Supabase's default email: users click the link in the email. Open it in the same browser you requested it from.
   - Optional: to show a 6-digit code instead, add `{{ .Token }}` to the *Magic Link* and *Confirm signup* templates under **Authentication → Emails → Templates**.
   - Before the pilot: connect Resend under **Authentication → Emails → SMTP Settings** (host `smtp.resend.com`, port 465, username `resend`, password = your Resend API key, sender `enquiries@simpliskool.com`). Without custom SMTP, Supabase only emails members of your Supabase organization, with a low hourly limit.
   - **Phone sign-in**: under **Authentication → Sign In / Providers → Phone**, turn Phone on and connect an SMS provider (Twilio, MessageBird, Vonage or Textlocal; for Termii use a *Send SMS* auth hook). Until then the Phone tab tells people to use email.
   - **Student PIN sign-in** needs `SUPABASE_SERVICE_ROLE_KEY` set on the server (Vercel). Students get their PIN from the school (admin, principal or class teacher resets it); 5 wrong PINs lock the account for 15 minutes.
2. **Environment**: copy `.env.example` to `.env.local` and fill in the Supabase URL, anon key and service role key.
3. **Run locally**
   ```bash
   npm install
   npm run dev
   ```
   Open http://localhost:3000. School websites work locally at `http://<slug>.localhost:3000`.
4. **Deploy on Vercel**: import the GitHub repo, add the same environment variables, and add the domains `simpliskool.com` and `*.simpliskool.com` (see the wildcard note in the PRD: delegate `_acme-challenge` to Vercel and keep DNS on Cloudflare).

## Making someone a platform admin

```sql
insert into public.platform_admins (user_id)
select id from public.profiles where email = 'you@example.com';
```

## Roles

| Role | Home | Can do |
| --- | --- | --- |
| owner, admin | /admin | Everything in their school |
| principal | /admin | Academics, staff, lesson notes and student PINs; not school settings or money |
| bursar | /admin | Fees and payments |
| teacher | /teacher | Attendance and scores for their classes and subjects |
| parent | /parent | Their own children's records, released results and fees |
| student | /student | Their own records |

## Email (absence emails and register reminders)

1. Create a free account at [resend.com](https://resend.com) and add the domain `simpliskool.com` under **Domains**. Add the DNS records it shows at your domain registrar and wait until it says *Verified*.
2. Create an API key and add these to Vercel (Project → Settings → Environment Variables), then redeploy:
   - `RESEND_API_KEY` = the key
   - `EMAIL_FROM_ADDRESS` = `notifications@simpliskool.com`
   - `NEXT_PUBLIC_SITE_URL` = `https://simpliskool.com`
3. Until this is done, attendance works as normal and the attendance page says emails aren't switched on yet.

Run `0007_attendance_notifications.sql` in Supabase before using the attendance page.

## Online fee payments (Paystack)

1. Vercel → Environment Variables: `PAYSTACK_SECRET_KEY` (start with the test key `sk_test_...`; switch to `sk_live_...` when ready).
2. Paystack → Settings → API Keys & Webhooks → Webhook URL: `https://www.simpliskool.com/api/paystack/webhook`.
3. Each school owner opens **Settings → Online fee payments**, picks the bank and enters the account number. Simpliskool checks the name with the bank and creates a Paystack subaccount, so parents' payments go straight to the school. The school bears Paystack's charge; `PLATFORM_FEE_PERCENT` (default 0) is Simpliskool's share.

Payments are recorded when the parent comes back from Paystack or when the webhook arrives, whichever is first (never twice), with a receipt number, email and (if on) a text.

## SMS (Termii)

Vercel: `TERMII_API_KEY`, `TERMII_SENDER_ID` (your approved sender name, e.g. `Simpliskool`), optionally `TERMII_BASE_URL` (the base URL in your Termii dashboard; default `https://v3.api.termii.com`) and `TERMII_CHANNEL` (`generic`, or `dnd` once Termii approves it, to reach numbers on Do-Not-Disturb). Each school switches SMS on under **Settings → SMS to parents** (off by default because texts cost money): absences, fee reminders, payment receipts, and announcements when ticked.

## Scheduled announcements

Admins can schedule an announcement for later. It stays hidden until then. With pg_cron (switched on by 0014), the database releases it on the minute; the app also releases due ones whenever someone opens Simpliskool, and a daily Vercel Cron job (`vercel.json`, needs `CRON_SECRET`) catches anything left. Emails and texts go out when it's released.

For exact-time emails and texts on schools that are quiet at night, you can also have Supabase call the app every 5 minutes (Database → Extensions: enable `pg_net`, then run once, with your secret):

```sql
select cron.schedule('simpliskool-dispatch', '*/5 * * * *',
  $$select net.http_get('https://www.simpliskool.com/api/cron/dispatch', headers := '{"Authorization": "Bearer YOUR_CRON_SECRET"}'::jsonb)$$);
```

## AI comment suggestions and the AI assistant (optional)

Add `ANTHROPIC_API_KEY` (from console.anthropic.com) in Vercel and redeploy. Teachers and the principal then get **Suggest with AI** on report card comments; only the student's first name and results are sent. Without the key, the button fills in a starting comment built from the scores. With it, teachers also get the AI teaching assistant (lesson notes, quiz questions for the bank, simpler explanations, homework ideas), up to `AI_TEACHER_MONTHLY_LIMIT` requests each a month (default 200).
