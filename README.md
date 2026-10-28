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

## AI comment suggestions (optional)

Add `ANTHROPIC_API_KEY` (from console.anthropic.com) in Vercel and redeploy. Teachers and the principal then get **Suggest with AI** on report card comments; only the student's first name and results are sent. Without the key, the button fills in a starting comment built from the scores.
