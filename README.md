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
   - Open the file `supabase/migrations/0001_foundation.sql`, copy **all of its contents**, paste them into **SQL Editor → New query** and click **Run** (run it once per project).
   - **Authentication → Sign In / Providers → Email**: keep Email enabled.
   - **Authentication → URL Configuration**: set the Site URL to `https://simpliskool.com` and add these Redirect URLs: `http://localhost:3000/auth/callback` and `https://simpliskool.com/auth/callback` (plus your Vercel preview URL + `/auth/callback`).
   - Sign-in works with Supabase's default email: users click the link in the email. Open it in the same browser you requested it from.
   - Optional: to show a 6-digit code instead, add `{{ .Token }}` to the *Magic Link* and *Confirm signup* templates under **Authentication → Emails → Templates**.
   - Before the pilot: connect Brevo under **Authentication → Emails → SMTP Settings** (host `smtp-relay.brevo.com`, port 587, your Brevo login and SMTP key, sender `enquiries@simpliskool.com`). Without custom SMTP, Supabase only emails members of your Supabase organization, with a low hourly limit.
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
| bursar | /admin | Fees and payments |
| teacher | /teacher | Attendance and scores for their classes and subjects |
| parent | /parent | Their own children's records, released results and fees |
| student | /student | Their own records |
