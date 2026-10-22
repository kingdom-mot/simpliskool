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
   - Open **SQL Editor**, paste `supabase/migrations/0001_foundation.sql` and run it.
   - **Authentication → Providers → Email**: keep Email enabled.
   - **Authentication → Email Templates → Magic Link**: make sure the template shows the code, for example:
     `Your Simpliskool sign-in code is {{ .Token }}`
   - **Authentication → URL Configuration**: set the Site URL to `https://simpliskool.com` (and `http://localhost:3000` for local work).
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
