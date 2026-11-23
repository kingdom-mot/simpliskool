-- Data protection (Nigeria Data Protection Act 2023). Safe to run more than once. Run after 0020.
-- Paste this file on its own into an empty SQL editor tab.
--
-- 1. legal_acceptances: who agreed to the terms and the data processing agreement (school
--    owners), and which parents have seen the privacy notice. Kept as proof.
-- 2. privacy_requests: parents, staff and students asking the school to see, correct or
--    delete their data. The school (the data controller) answers them.
-- 3. school_deletion_requests: an owner asks Simpliskool to delete the whole school.
--    Dream Savvy deletes it after 30 days (the owner can cancel before then).
-- 4. data_incidents: the Dream Savvy breach register (72-hour clock to tell the NDPC).
-- 5. erase_student: wipes a former student's personal details but keeps their marks and
--    payments under "Former student", so the school's records still add up.

-- 1. Agreements and notices ----------------------------------------------------------
create table if not exists public.legal_acceptances (
  id bigint generated always as identity primary key,
  school_id uuid not null references public.schools (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  document text not null check (document in ('terms', 'dpa', 'parent_notice')),
  version text not null,
  accepted_at timestamptz not null default now(),
  unique (school_id, user_id, document, version)
);
alter table public.legal_acceptances enable row level security;
drop policy if exists legal_read on public.legal_acceptances;
create policy legal_read on public.legal_acceptances for select to authenticated
  using (user_id = auth.uid() or public.is_school_admin(school_id));

-- Owners accept the terms and the data processing agreement; parents acknowledge the notice.
create or replace function public.accept_legal(p_school uuid, p_documents text[], p_version text)
returns void language plpgsql security definer set search_path = public as $fn$
declare d text;
begin
  if auth.uid() is null then raise exception 'Sign in first' using errcode = 'P0001'; end if;
  if p_version !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Unknown version' using errcode = 'P0001'; end if;
  foreach d in array p_documents loop
    if d in ('terms', 'dpa') then
      if not public.has_role(p_school, array['owner']::app_role[]) then
        raise exception 'Only the school owner can accept the agreements' using errcode = 'P0001';
      end if;
    elsif d = 'parent_notice' then
      if not exists (select 1 from guardians where school_id = p_school and user_id = auth.uid()) then
        raise exception 'Only parents of this school see this notice' using errcode = 'P0001';
      end if;
    else
      raise exception 'Unknown document' using errcode = 'P0001';
    end if;
    insert into legal_acceptances (school_id, user_id, document, version)
    values (p_school, auth.uid(), d, p_version)
    on conflict do nothing;
  end loop;
end $fn$;

-- 2. Privacy requests ---------------------------------------------------------------
create table if not exists public.privacy_requests (
  id bigint generated always as identity primary key,
  school_id uuid not null references public.schools (id) on delete cascade,
  requested_by uuid references public.profiles (id) on delete set null,
  requester_name text,
  kind text not null check (kind in ('access', 'correct', 'delete', 'object', 'other')),
  student_id uuid references public.students (id) on delete set null,
  details text not null check (char_length(details) between 3 and 2000),
  status text not null default 'open' check (status in ('open', 'done', 'declined')),
  response text check (response is null or char_length(response) <= 2000),
  handled_by uuid references public.profiles (id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists privacy_requests_school on public.privacy_requests (school_id, status, created_at desc);
alter table public.privacy_requests enable row level security;
drop policy if exists privacy_read on public.privacy_requests;
create policy privacy_read on public.privacy_requests for select to authenticated
  using (requested_by = auth.uid() or public.has_role(school_id, array['owner', 'admin']::app_role[]));

create or replace function public.make_privacy_request(p_school uuid, p_kind text, p_student uuid, p_details text)
returns bigint language plpgsql security definer set search_path = public as $fn$
declare v_id bigint; v_name text;
begin
  if auth.uid() is null then raise exception 'Sign in first' using errcode = 'P0001'; end if;
  if not (public.is_member(p_school) or exists (select 1 from guardians where school_id = p_school and user_id = auth.uid())) then
    raise exception 'You are not part of this school' using errcode = 'P0001';
  end if;
  if p_student is not null and not exists (
    select 1 from students s where s.id = p_student and s.school_id = p_school
      and (s.user_id = auth.uid() or exists (select 1 from guardians g where g.student_id = s.id and g.user_id = auth.uid()))
  ) then
    raise exception 'That child is not linked to you' using errcode = 'P0001';
  end if;
  if (select count(*) from privacy_requests where requested_by = auth.uid() and created_at > now() - interval '1 day') >= 5 then
    raise exception 'You have sent several requests today. The school will reply to those first.' using errcode = 'P0001';
  end if;
  select coalesce(nullif(trim(full_name), ''), email, phone) into v_name from profiles where id = auth.uid();
  insert into privacy_requests (school_id, requested_by, requester_name, kind, student_id, details)
  values (p_school, auth.uid(), v_name, p_kind, p_student, trim(p_details))
  returning id into v_id;
  return v_id;
end $fn$;

create or replace function public.answer_privacy_request(p_id bigint, p_status text, p_response text)
returns void language plpgsql security definer set search_path = public as $fn$
declare v_school uuid;
begin
  select school_id into v_school from privacy_requests where id = p_id;
  if v_school is null or not public.has_role(v_school, array['owner', 'admin']::app_role[]) then
    raise exception 'Only the owner or an admin can answer privacy requests' using errcode = 'P0001';
  end if;
  if p_status not in ('open', 'done', 'declined') then raise exception 'Unknown status' using errcode = 'P0001'; end if;
  update privacy_requests
     set status = p_status, response = nullif(trim(p_response), ''),
         handled_by = case when p_status = 'open' then null else auth.uid() end,
         handled_at = case when p_status = 'open' then null else now() end
   where id = p_id;
end $fn$;

-- 3. Deleting a whole school ----------------------------------------------------------
create table if not exists public.school_deletion_requests (
  school_id uuid primary key references public.schools (id) on delete cascade,
  requested_by uuid references public.profiles (id) on delete set null,
  reason text check (reason is null or char_length(reason) <= 1000),
  requested_at timestamptz not null default now(),
  delete_after date not null,
  cancelled_at timestamptz
);
alter table public.school_deletion_requests enable row level security;
drop policy if exists deletion_read on public.school_deletion_requests;
create policy deletion_read on public.school_deletion_requests for select to authenticated
  using (public.has_role(school_id, array['owner']::app_role[]));

create or replace function public.request_school_deletion(p_school uuid, p_reason text)
returns date language plpgsql security definer set search_path = public as $fn$
declare v_after date := (now() at time zone 'Africa/Lagos')::date + 30;
begin
  if not public.has_role(p_school, array['owner']::app_role[]) then
    raise exception 'Only the school owner can ask for the school to be deleted' using errcode = 'P0001';
  end if;
  insert into school_deletion_requests (school_id, requested_by, reason, delete_after)
  values (p_school, auth.uid(), nullif(trim(p_reason), ''), v_after)
  on conflict (school_id) do update
    set requested_by = excluded.requested_by, reason = excluded.reason, requested_at = now(),
        delete_after = excluded.delete_after, cancelled_at = null;
  insert into platform_audit (actor_id, actor_name, action, kind, school_id, school_name, detail)
  select auth.uid(), (select full_name from profiles where id = auth.uid()), 'School asked to be deleted', 'access', s.id, s.name, 'Due ' || to_char(v_after, 'DD Mon YYYY')
  from schools s where s.id = p_school;
  return v_after;
end $fn$;

create or replace function public.cancel_school_deletion(p_school uuid)
returns void language plpgsql security definer set search_path = public as $fn$
begin
  if not public.has_role(p_school, array['owner']::app_role[]) then
    raise exception 'Only the school owner can do this' using errcode = 'P0001';
  end if;
  update school_deletion_requests set cancelled_at = now() where school_id = p_school and cancelled_at is null;
  insert into platform_audit (actor_id, actor_name, action, kind, school_id, school_name, detail)
  select auth.uid(), (select full_name from profiles where id = auth.uid()), 'School cancelled its deletion', 'access', s.id, s.name, null
  from schools s where s.id = p_school;
end $fn$;

-- 4. Breach register (Dream Savvy back office only, through the server) -------------
create table if not exists public.data_incidents (
  id bigint generated always as identity primary key,
  title text not null check (char_length(title) between 3 and 200),
  detected_at timestamptz not null,
  description text check (description is null or char_length(description) <= 5000),
  schools_affected text check (schools_affected is null or char_length(schools_affected) <= 2000),
  people_affected integer check (people_affected is null or people_affected >= 0),
  high_risk boolean not null default false,
  contained_at timestamptz,
  ndpc_notified_at timestamptz,
  schools_notified_at timestamptz,
  closed_at timestamptz,
  notes text check (notes is null or char_length(notes) <= 5000),
  logged_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.data_incidents enable row level security;
-- No policies: only the server (service role) reads and writes the register.

-- 5. Erasing a former student ---------------------------------------------------------
alter table public.students add column if not exists erased_at timestamptz;

create or replace function public.erase_student(p_student uuid)
returns text language plpgsql security definer set search_path = public as $fn$
declare s record;
begin
  select id, school_id, status, user_id, photo_url, erased_at into s from students where id = p_student;
  if s.id is null then raise exception 'Student not found' using errcode = 'P0001'; end if;
  if not public.has_role(s.school_id, array['owner']::app_role[]) then
    raise exception 'Only the school owner can erase a student''s details' using errcode = 'P0001';
  end if;
  if s.status = 'active' then
    raise exception 'Mark the student as left school or graduated first' using errcode = 'P0001';
  end if;
  if s.erased_at is not null then raise exception 'This student''s details were already erased' using errcode = 'P0001'; end if;
  update students
     set first_name = 'Former', last_name = 'student', other_names = null, gender = null, date_of_birth = null,
         photo_url = null, state_of_origin = null, blood_group = null, address = null, user_id = null,
         signin_method = 'pin', erased_at = now()
   where id = p_student;
  if s.user_id is not null then
    delete from memberships where school_id = s.school_id and user_id = s.user_id and role = 'student';
  end if;
  delete from guardians where student_id = p_student;
  delete from student_pins where student_id = p_student;
  delete from absence_reports where student_id = p_student;
  delete from notifications where student_id = p_student;
  delete from cbt_allowances where student_id = p_student;
  update admission_applications
     set child_name = 'Former student', date_of_birth = null, parent_name = 'Removed', parent_phone = 'Removed',
         parent_email = null, notes = null, previous_school = null
   where student_id = p_student;
  insert into audit_log (school_id, actor_id, table_name, record_id, action, details)
  values (s.school_id, auth.uid(), 'students', p_student, 'ERASE', jsonb_build_object('note', 'Personal details erased at the owner''s request'));
  -- The photo path is returned so the server can delete the file too.
  return s.photo_url;
end $fn$;

-- ===========================================================================
-- Permissions (same as 0020 plus the new functions), so 0008 doesn't need to be run again.
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
                     'use_sms_credit', 'add_sms_credit', 'platform_schools', 'platform_active_since', 'demo_fill', 'demo_reset') then
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
-- The breach register and acceptance proof can't be changed or deleted from the browser.
revoke insert, update, delete, truncate on public.data_incidents from authenticated, anon;
revoke insert, update, delete, truncate on public.legal_acceptances from authenticated, anon;
revoke insert, update, delete, truncate on public.privacy_requests from authenticated, anon;
revoke insert, update, delete, truncate on public.school_deletion_requests from authenticated, anon;
