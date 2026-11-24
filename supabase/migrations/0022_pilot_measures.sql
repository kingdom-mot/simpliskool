-- Measuring the pilot. Safe to run more than once. Run after 0021.
-- Paste this file on its own into an empty SQL editor tab.
--
-- 1. feedback: the Feedback button in every portal.
-- 2. survey_responses: the week-1 baseline survey and the end-of-pilot survey.
-- 3. school_completeness: how complete a school's student records are (for the scorecard).
-- 4. platform_support_times: when each help request got its first reply from Dream Savvy.

-- 1. Feedback ------------------------------------------------------------------------
create table if not exists public.feedback (
  id bigint generated always as identity primary key,
  school_id uuid references public.schools (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  role text,
  page text check (page is null or char_length(page) <= 300),
  kind text not null check (kind in ('problem', 'idea', 'hard', 'like')),
  rating smallint check (rating between 1 and 5),
  message text not null check (char_length(message) between 3 and 2000),
  status text not null default 'new' check (status in ('new', 'seen', 'done')),
  team_note text check (team_note is null or char_length(team_note) <= 2000),
  created_at timestamptz not null default now()
);
create index if not exists feedback_new on public.feedback (status, created_at desc);
alter table public.feedback enable row level security;
drop policy if exists feedback_own on public.feedback;
create policy feedback_own on public.feedback for select to authenticated using (user_id = auth.uid());

create or replace function public.give_feedback(p_school uuid, p_kind text, p_rating smallint, p_message text, p_page text)
returns bigint language plpgsql security definer set search_path = public as $fn$
declare v_role text; v_id bigint;
begin
  if auth.uid() is null then raise exception 'Sign in first' using errcode = 'P0001'; end if;
  select role::text into v_role from memberships where school_id = p_school and user_id = auth.uid()
   order by array_position(array['owner', 'admin', 'principal', 'bursar', 'teacher', 'parent', 'student'], role::text) limit 1;
  if v_role is null then raise exception 'You are not part of this school' using errcode = 'P0001'; end if;
  if (select count(*) from feedback where user_id = auth.uid() and created_at > now() - interval '1 day') >= 10 then
    raise exception 'Thank you for all your feedback today. Please send more tomorrow.' using errcode = 'P0001';
  end if;
  insert into feedback (school_id, user_id, role, page, kind, rating, message)
  values (p_school, auth.uid(), v_role, left(p_page, 300), p_kind, p_rating, trim(p_message))
  returning id into v_id;
  return v_id;
end $fn$;

-- 2. Surveys -------------------------------------------------------------------------
create table if not exists public.survey_responses (
  id bigint generated always as identity primary key,
  school_id uuid not null references public.schools (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null,
  survey text not null check (survey in ('baseline', 'end')),
  answers jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, user_id, survey)
);
alter table public.survey_responses enable row level security;
drop policy if exists survey_own on public.survey_responses;
create policy survey_own on public.survey_responses for select to authenticated using (user_id = auth.uid());

create or replace function public.submit_survey(p_school uuid, p_survey text, p_answers jsonb)
returns void language plpgsql security definer set search_path = public as $fn$
declare v_role text;
begin
  if auth.uid() is null then raise exception 'Sign in first' using errcode = 'P0001'; end if;
  if p_survey not in ('baseline', 'end') then raise exception 'Unknown survey' using errcode = 'P0001'; end if;
  if jsonb_typeof(p_answers) <> 'object' or octet_length(p_answers::text) > 8000 then raise exception 'Answers are too long' using errcode = 'P0001'; end if;
  select role::text into v_role from memberships where school_id = p_school and user_id = auth.uid()
   order by array_position(array['owner', 'admin', 'principal', 'bursar', 'teacher', 'parent', 'student'], role::text) limit 1;
  if v_role is null then raise exception 'You are not part of this school' using errcode = 'P0001'; end if;
  insert into survey_responses (school_id, user_id, role, survey, answers)
  values (p_school, auth.uid(), v_role, p_survey, p_answers)
  on conflict (school_id, user_id, survey) do update set answers = excluded.answers, role = excluded.role, updated_at = now();
end $fn$;

-- 3. Record completeness ---------------------------------------------------------------
-- A student record counts as complete when it has a class, a date of birth, an admission
-- number and at least one parent the school can reach (phone or email).
create or replace function public.school_completeness(p_school uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $fn$
declare r jsonb;
begin
  -- The server (service role), the school's own owner or admin, or someone in the SQL editor.
  if not (coalesce(auth.role(), '') = 'service_role' or public.is_school_admin(p_school) or session_user in ('postgres', 'supabase_admin')) then
    raise exception 'Not allowed' using errcode = 'P0001';
  end if;
  with s as (
    select st.id,
           st.class_id is not null as has_class,
           st.date_of_birth is not null as has_dob,
           nullif(trim(st.admission_no), '') is not null as has_adm,
           st.gender is not null as has_gender,
           exists (select 1 from guardians g where g.student_id = st.id) as has_parent,
           exists (select 1 from guardians g join profiles p on p.id = g.user_id where g.student_id = st.id and (nullif(p.phone, '') is not null or nullif(p.email, '') is not null)) as has_contact
    from students st
    where st.school_id = p_school and st.status = 'active'
  )
  select jsonb_build_object(
    'students', count(*),
    'complete', count(*) filter (where has_class and has_dob and has_adm and has_contact),
    'no_class', count(*) filter (where not has_class),
    'no_dob', count(*) filter (where not has_dob),
    'no_admission_no', count(*) filter (where not has_adm),
    'no_gender', count(*) filter (where not has_gender),
    'no_parent', count(*) filter (where not has_parent),
    'no_parent_contact', count(*) filter (where has_parent and not has_contact),
    'classes', (select count(*) from classes where school_id = p_school),
    'classes_no_teacher', (select count(*) from classes where school_id = p_school and class_teacher_id is null),
    'subjects', (select count(*) from class_subjects where school_id = p_school),
    'subjects_no_teacher', (select count(*) from class_subjects where school_id = p_school and teacher_id is null)
  ) into r from s;
  return r;
end $fn$;

-- 4. Support reply times (Dream Savvy back office, server only) -------------------------
create or replace function public.platform_support_times(p_since timestamptz)
returns table (ticket_id bigint, school_id uuid, created_at timestamptz, first_reply_at timestamptz, status text)
language sql stable security definer set search_path = public as $fn$
  select t.id, t.school_id, t.created_at,
         (select min(m.created_at) from support_messages m where m.ticket_id = t.id and m.from_team and not m.internal),
         t.status
  from support_tickets t
  where t.created_at >= p_since;
$fn$;

-- 5. Usage figures for the pilot scorecard (Dream Savvy back office, server only) --------
-- One row per school for the period from p_since to today. Percentages are 0–100, or null
-- when there is nothing to count yet.
create or replace function public.platform_pilot_usage(p_since date)
returns table (
  school_id uuid, is_demo boolean, students bigint,
  families_joined_pct numeric, teachers_active_pct numeric, register_days_pct numeric,
  records_complete_pct numeric, notices_opened_pct numeric, fees_online_pct numeric, help_requests bigint)
language sql stable security definer set search_path = public as $fn$
  with days as (
    select count(*)::numeric as n
    from generate_series(p_since, (now() at time zone 'Africa/Lagos')::date, interval '1 day') d
    where extract(isodow from d) < 6
  )
  select s.id, coalesce(s.is_demo, false),
    (select count(*) from students st where st.school_id = s.id and st.status = 'active'),
    -- Families joined: active students with at least one parent who has signed in to Simpliskool.
    (select round(100.0 * count(*) filter (where exists (
              select 1 from guardians g join auth.users u on u.id = g.user_id
              where g.student_id = st.id and u.last_sign_in_at is not null)) / nullif(count(*), 0), 1)
       from students st where st.school_id = s.id and st.status = 'active'),
    -- Teachers who signed in during the last 7 days.
    (select round(100.0 * count(*) filter (where u.last_sign_in_at >= now() - interval '7 days') / nullif(count(*), 0), 1)
       from memberships m join auth.users u on u.id = m.user_id where m.school_id = s.id and m.role = 'teacher'),
    -- Class registers taken on school days (Monday to Friday) in the period.
    (select round(100.0 * (select count(distinct (a.class_id, a.date)) from attendance a where a.school_id = s.id and a.date >= p_since)
            / nullif((select count(*) from classes c where c.school_id = s.id) * (select n from days), 0), 1)),
    (select round(100.0 * (c ->> 'complete')::numeric / nullif((c ->> 'students')::numeric, 0), 1) from (select public.school_completeness(s.id) c) x),
    -- Notices opened: reads divided by the number of people each notice reached.
    (select round(100.0 * (select count(*) from announcement_reads r join announcements an on an.id = r.announcement_id where an.school_id = s.id and an.created_at >= p_since)
            / nullif((select sum(an.reach) from announcements an where an.school_id = s.id and an.created_at >= p_since), 0), 1)),
    -- Share of fee money received online (Paystack) in the period.
    (select round(100.0 * sum(p.amount_kobo) filter (where p.method = 'paystack') / nullif(sum(p.amount_kobo), 0), 1)
       from payments p where p.school_id = s.id and p.voided_at is null and coalesce(p.paid_at, p.created_at) >= p_since),
    (select count(*) from support_tickets t where t.school_id = s.id and t.created_at >= p_since)
  from schools s;
$fn$;

-- ===========================================================================
-- Permissions (same as 0021 plus the new server-only functions).
-- ===========================================================================
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;
do $grants$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig, p.proname
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
  loop
    execute format('grant execute on function %s to service_role', f.sig);
    if f.proname in ('verify_student_pin', 'announcement_users', 'complete_online_payment', 'release_due_announcements', 'cbt_mark',
                     'use_sms_credit', 'add_sms_credit', 'platform_schools', 'platform_active_since', 'demo_fill', 'demo_reset',
                     'platform_support_times', 'platform_pilot_usage') then
      execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
    elsif f.proname not in ('handle_new_user', 'audit_row', 'check_score_limits', 'sync_period_times', 'sync_invoice_paid', 'application_ref', 'lock_paid_payslips', 'attendance_excused',
                            'guard_school_columns', 'school_defaults', 'payout_changed', 'audit_locked', 'guard_profile_columns') then
      execute format('grant execute on function %s to authenticated', f.sig);
    end if;
  end loop;
end $grants$;
grant execute on function public.admissions_open(uuid) to anon;
grant execute on function public.is_school_admin(uuid) to anon;
revoke update, delete, truncate on public.platform_audit from authenticated, anon, service_role;
revoke insert, update, delete, truncate on public.data_incidents from authenticated, anon;
revoke insert, update, delete, truncate on public.legal_acceptances from authenticated, anon;
revoke insert, update, delete, truncate on public.privacy_requests from authenticated, anon;
revoke insert, update, delete, truncate on public.school_deletion_requests from authenticated, anon;
revoke insert, update, delete, truncate on public.feedback from authenticated, anon;
revoke insert, update, delete, truncate on public.survey_responses from authenticated, anon;
