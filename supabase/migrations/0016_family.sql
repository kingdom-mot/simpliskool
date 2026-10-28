-- Parents and accounts: reporting an absence in advance, "excused" absences,
-- and each person's message preferences. Safe to run more than once. Run after 0015.

-- ===========================================================================
-- 1. Absence reports from parents
-- ===========================================================================
create table if not exists public.absence_reports (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  from_date date not null,
  to_date date not null,
  reason text not null check (reason in ('unwell', 'family', 'travel', 'other')),
  note text check (note is null or char_length(note) <= 500),
  reported_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (to_date >= from_date and to_date - from_date <= 30)
);
create index if not exists absence_reports_student on public.absence_reports (student_id, from_date);
alter table public.absence_reports enable row level security;
drop policy if exists absence_reports_read on public.absence_reports;
create policy absence_reports_read on public.absence_reports for select using (public.acts_for_student(student_id) or public.is_staff(school_id));
-- Written through report_absence() / cancel_absence_report().

-- An absence the parent told the school about is "excused".
alter table public.attendance add column if not exists excused boolean not null default false;

create or replace function public.attendance_excused()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.excused := new.status = 'absent' and exists (
    select 1 from absence_reports r where r.student_id = new.student_id and new.date between r.from_date and r.to_date);
  return new;
end $$;
drop trigger if exists attendance_excused on public.attendance;
create trigger attendance_excused before insert or update of status, date on public.attendance
  for each row execute function public.attendance_excused();

create or replace function public.report_absence(p_student uuid, p_from date, p_to date, p_reason text, p_note text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_st record; v_id uuid; v_teacher record;
begin
  if not public.acts_for_student(p_student) then raise exception 'not allowed' using errcode = '42501'; end if;
  select s.*, c.class_teacher_id into v_st from students s left join classes c on c.id = s.class_id where s.id = p_student;
  if p_from is null or p_to is null or p_to < p_from then raise exception 'Check the dates' using errcode = 'P0001'; end if;
  if p_from < public.lagos_today() - 7 then raise exception 'Too far back' using errcode = 'P0001'; end if;
  if p_to - p_from > 30 then raise exception 'Too long' using errcode = 'P0001'; end if;
  if p_reason not in ('unwell', 'family', 'travel', 'other') then raise exception 'Choose a reason' using errcode = 'P0001'; end if;
  insert into absence_reports (school_id, student_id, from_date, to_date, reason, note, reported_by)
  values (v_st.school_id, p_student, p_from, p_to, p_reason, nullif(left(trim(coalesce(p_note, '')), 500), ''), auth.uid())
  returning id into v_id;
  -- Registers already taken for those days become excused.
  update attendance set excused = true where student_id = p_student and status = 'absent' and date between p_from and p_to;
  select p.full_name, p.email into v_teacher from profiles p where p.id = v_st.class_teacher_id;
  return jsonb_build_object('id', v_id, 'teacher', v_teacher.full_name, 'teacher_email', v_teacher.email);
end $$;

create or replace function public.cancel_absence_report(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_r record;
begin
  select * into v_r from absence_reports where id = p_id;
  if v_r.id is null or not (public.acts_for_student(v_r.student_id) or public.is_school_admin(v_r.school_id)) then raise exception 'not allowed' using errcode = '42501'; end if;
  delete from absence_reports where id = p_id;
  update attendance a set excused = exists (select 1 from absence_reports r where r.student_id = a.student_id and a.date between r.from_date and r.to_date)
  where a.student_id = v_r.student_id and a.status = 'absent' and a.date between v_r.from_date and v_r.to_date;
end $$;

-- One child's attendance for a month (parents, the student, staff).
create or replace function public.attendance_month(p_student uuid, p_month date)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when not public.can_view_student(p_student) then null else jsonb_build_object(
    'days', coalesce((select jsonb_agg(jsonb_build_object('date', a.date, 'status', a.status, 'excused', a.excused) order by a.date)
      from attendance a where a.student_id = p_student and a.date >= date_trunc('month', p_month)::date and a.date < (date_trunc('month', p_month) + interval '1 month')::date), '[]'::jsonb),
    'reports', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'from', r.from_date, 'to', r.to_date, 'reason', r.reason, 'note', r.note) order by r.from_date desc)
      from absence_reports r where r.student_id = p_student and r.to_date >= date_trunc('month', p_month)::date - 60), '[]'::jsonb)
  ) end;
$$;

-- ===========================================================================
-- 2. Message preferences (each person can turn off school emails or texts)
-- ===========================================================================
create table if not exists public.message_optouts (
  user_id uuid not null references public.profiles (id) on delete cascade,
  channel text not null check (channel in ('email', 'sms')),
  created_at timestamptz not null default now(),
  primary key (user_id, channel)
);
alter table public.message_optouts enable row level security;
drop policy if exists message_optouts_own on public.message_optouts;
create policy message_optouts_own on public.message_optouts for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ===========================================================================
-- 3. Teachers' names for parents and students (names only, never contact details)
-- ===========================================================================
create or replace function public.staff_names(p_ids uuid[])
returns table (id uuid, full_name text) language sql stable security definer set search_path = public as $$
  select p.id, p.full_name from profiles p
  where p.id = any(p_ids) and exists (
    select 1 from memberships theirs join memberships mine on mine.school_id = theirs.school_id
    where theirs.user_id = p.id and mine.user_id = auth.uid()
      and theirs.role in ('owner', 'admin', 'principal', 'bursar', 'teacher'));
$$;

-- ===========================================================================
-- 4. Permissions (same as 0015), so 0008 doesn't need to be run again.
-- ===========================================================================
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig, p.proname
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
  loop
    execute format('grant execute on function %s to service_role', f.sig);
    if f.proname in ('verify_student_pin', 'announcement_users', 'complete_online_payment', 'release_due_announcements', 'cbt_mark') then
      execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
    elsif f.proname not in ('handle_new_user', 'audit_row', 'check_score_limits', 'sync_period_times', 'sync_invoice_paid', 'application_ref', 'lock_paid_payslips', 'attendance_excused') then
      execute format('grant execute on function %s to authenticated', f.sig);
    end if;
  end loop;
end $$;
grant execute on function public.admissions_open(uuid) to anon;
grant execute on function public.is_school_admin(uuid) to anon;
