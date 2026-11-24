-- 0023: Staff clock themselves in and out, only from the school premises.
-- Safe to run more than once. Run after 0022. Paste this file on its own into an empty SQL editor tab.
--
-- What changes:
--   * Each school sets its location (a pin), an allowed distance and a closing time (owner only).
--   * Teachers and staff clock in and out on their own phone. The phone sends its location;
--     the server measures the distance and refuses anyone outside the allowed distance, or whose
--     location is too vague to trust. The time always comes from the server, never the phone.
--   * Every refused try is kept and shown to the principal as a flag ("Tried from 2.4 km away").
--   * "I'm on official duty": staff ask, the principal approves or declines.
--   * The principal, owner and admin only see the times. They can no longer clock anyone in or out,
--     but can still mark absent or on leave.

-- ---------------------------------------------------------------------------
-- 1. School settings
-- ---------------------------------------------------------------------------
alter table public.schools add column if not exists geo_lat double precision;
alter table public.schools add column if not exists geo_lng double precision;
alter table public.schools add column if not exists geo_radius_m integer not null default 100;
alter table public.schools add column if not exists staff_close_at time;
do $c$ begin
  alter table public.schools add constraint schools_geo_radius_chk check (geo_radius_m between 30 and 1000);
exception when duplicate_object then null; end $c$;
do $c$ begin
  alter table public.schools add constraint schools_geo_pair_chk check ((geo_lat is null) = (geo_lng is null) and (geo_lat is null or (geo_lat between -90 and 90 and geo_lng between -180 and 180)));
exception when duplicate_object then null; end $c$;

-- Only set_staff_clock_settings() may change these (so a principal or staff member can't move the
-- school's pin to their house). Same guard as 0020 plus the clock settings.
create or replace function public.guard_school_columns()
returns trigger language plpgsql as $fn$
begin
  if current_user in ('authenticated', 'anon') then
    new.status := old.status;
    new.plan := old.plan;
    new.group_id := old.group_id;
    new.features := old.features;
    new.pilot_ends := old.pilot_ends;
    new.payments_approved_at := old.payments_approved_at;
    new.payments_approved_by := old.payments_approved_by;
    new.check_status := old.check_status;
    new.check_note := old.check_note;
    new.sms_credit := old.sms_credit;
    new.sender_status := old.sender_status;
    new.sender_note := old.sender_note;
    new.suspended_at := old.suspended_at;
    new.suspended_reason := old.suspended_reason;
    new.is_demo := old.is_demo;
    new.geo_lat := old.geo_lat;
    new.geo_lng := old.geo_lng;
    new.geo_radius_m := old.geo_radius_m;
    new.staff_close_at := old.staff_close_at;
    new.staff_late_after := old.staff_late_after;
  end if;
  return new;
end $fn$;

-- ---------------------------------------------------------------------------
-- 2. What each clock-in and clock-out recorded
-- ---------------------------------------------------------------------------
alter table public.staff_attendance add column if not exists in_lat double precision;
alter table public.staff_attendance add column if not exists in_lng double precision;
alter table public.staff_attendance add column if not exists in_accuracy_m integer;
alter table public.staff_attendance add column if not exists in_distance_m integer;
alter table public.staff_attendance add column if not exists out_lat double precision;
alter table public.staff_attendance add column if not exists out_lng double precision;
alter table public.staff_attendance add column if not exists out_accuracy_m integer;
alter table public.staff_attendance add column if not exists out_distance_m integer;
alter table public.staff_attendance add column if not exists duty_request text;
alter table public.staff_attendance add column if not exists duty_state text;
alter table public.staff_attendance add column if not exists duty_decided_by uuid references public.profiles (id) on delete set null;
alter table public.staff_attendance add column if not exists duty_decided_at timestamptz;
do $c$ begin
  alter table public.staff_attendance add constraint staff_attendance_duty_chk check (duty_state is null or duty_state in ('pending', 'approved', 'declined'));
exception when duplicate_object then null; end $c$;
do $c$ begin
  alter table public.staff_attendance add constraint staff_attendance_duty_len_chk check (duty_request is null or char_length(duty_request) between 3 and 200);
exception when duplicate_object then null; end $c$;

-- Every try, kept even when refused. Written only by self_clock().
create table if not exists public.staff_clock_attempts (
  id bigint generated always as identity primary key,
  school_id uuid not null references public.schools (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  date date not null,
  at timestamptz not null default now(),
  kind text not null check (kind in ('in', 'out')),
  outcome text not null check (outcome in ('ok', 'too_far', 'too_vague', 'not_set')),
  distance_m integer,
  accuracy_m integer,
  lat double precision,
  lng double precision
);
create index if not exists staff_clock_attempts_day on public.staff_clock_attempts (school_id, date);
create index if not exists staff_clock_attempts_user on public.staff_clock_attempts (user_id, date);
alter table public.staff_clock_attempts enable row level security;
drop policy if exists staff_clock_attempts_read on public.staff_clock_attempts;
create policy staff_clock_attempts_read on public.staff_clock_attempts for select using (user_id = auth.uid() or public.is_school_admin(school_id));

-- ---------------------------------------------------------------------------
-- 3. Functions
-- ---------------------------------------------------------------------------
-- Distance in metres between two points (haversine).
create or replace function public.geo_distance_m(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision language sql immutable as $fn$
  select 2 * 6371000 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)));
$fn$;

-- People who clock in: staff roles. A proprietor who is only the owner isn't on the staff list.
create or replace function public.is_clocking_staff(p_school uuid, p_user uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (select 1 from memberships where school_id = p_school and user_id = p_user and role in ('admin', 'principal', 'bursar', 'teacher'));
$fn$;

-- Owner sets the school's pin, allowed distance, late time and closing time.
create or replace function public.set_staff_clock_settings(p_school uuid, p_lat double precision, p_lng double precision, p_radius integer, p_late time, p_close time)
returns void language plpgsql security definer set search_path = public as $fn$
begin
  if not exists (select 1 from memberships where school_id = p_school and user_id = auth.uid() and role = 'owner') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if (p_lat is null) <> (p_lng is null) or (p_lat is not null and (p_lat not between -90 and 90 or p_lng not between -180 and 180)) then
    raise exception 'Bad location' using errcode = 'P0001';
  end if;
  if p_radius is null or p_radius not between 30 and 1000 then raise exception 'Bad distance' using errcode = 'P0001'; end if;
  if p_late is null then raise exception 'Bad late time' using errcode = 'P0001'; end if;
  if p_close is not null and p_close <= p_late then raise exception 'Closing before late time' using errcode = 'P0001'; end if;
  update schools set geo_lat = p_lat, geo_lng = p_lng, geo_radius_m = p_radius, staff_late_after = p_late, staff_close_at = p_close where id = p_school;
end $fn$;

-- A staff member clocks in or out from their own phone. Returns what happened rather than raising,
-- so a refused try is still saved for the principal to see.
create or replace function public.self_clock(p_school uuid, p_kind text, p_lat double precision, p_lng double precision, p_accuracy double precision)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare
  v_uid uuid := auth.uid();
  v_s schools%rowtype;
  v_today date := public.lagos_today();
  v_now timestamptz := now();
  v_dist integer;
  v_acc integer := case when p_accuracy is null then null else least(round(p_accuracy), 100000)::integer end;
  v_row staff_attendance%rowtype;
  v_local time := (now() at time zone 'Africa/Lagos')::time;
begin
  if v_uid is null or not public.is_clocking_staff(p_school, v_uid) then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_kind not in ('in', 'out') then raise exception 'Bad action' using errcode = 'P0001'; end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'Bad location' using errcode = 'P0001';
  end if;
  if (select count(*) from staff_clock_attempts where user_id = v_uid and school_id = p_school and date = v_today) >= 30 then
    raise exception 'Too many tries' using errcode = 'P0001';
  end if;
  select * into v_s from schools where id = p_school;

  if not v_s.is_demo then
    if v_s.geo_lat is null then
      insert into staff_clock_attempts (school_id, user_id, date, kind, outcome, accuracy_m, lat, lng) values (p_school, v_uid, v_today, p_kind, 'not_set', v_acc, p_lat, p_lng);
      return jsonb_build_object('ok', false, 'reason', 'not_set');
    end if;
    v_dist := round(public.geo_distance_m(v_s.geo_lat, v_s.geo_lng, p_lat, p_lng))::integer;
    if v_acc is null or v_acc > 100 then
      insert into staff_clock_attempts (school_id, user_id, date, kind, outcome, distance_m, accuracy_m, lat, lng) values (p_school, v_uid, v_today, p_kind, 'too_vague', v_dist, v_acc, p_lat, p_lng);
      return jsonb_build_object('ok', false, 'reason', 'too_vague', 'accuracy', v_acc);
    end if;
    if v_dist > v_s.geo_radius_m then
      insert into staff_clock_attempts (school_id, user_id, date, kind, outcome, distance_m, accuracy_m, lat, lng) values (p_school, v_uid, v_today, p_kind, 'too_far', v_dist, v_acc, p_lat, p_lng);
      return jsonb_build_object('ok', false, 'reason', 'too_far', 'distance', v_dist, 'radius', v_s.geo_radius_m);
    end if;
  else
    v_dist := 0; -- The demo school has no real premises: everyone is "at school".
  end if;

  select * into v_row from staff_attendance where school_id = p_school and user_id = v_uid and date = v_today for update;

  if p_kind = 'in' then
    if v_row.clock_in is not null then return jsonb_build_object('ok', false, 'reason', 'already_in', 'at', v_row.clock_in); end if;
    if v_row.status = 'leave' then return jsonb_build_object('ok', false, 'reason', 'on_leave'); end if;
    insert into staff_attendance (school_id, user_id, date, clock_in, status, marked_by, in_lat, in_lng, in_accuracy_m, in_distance_m)
    values (p_school, v_uid, v_today, v_now, 'present', v_uid, p_lat, p_lng, v_acc, v_dist)
    on conflict (school_id, user_id, date) do update set clock_in = v_now, status = case when staff_attendance.status = 'duty' then 'duty' else 'present' end,
      marked_by = v_uid, in_lat = p_lat, in_lng = p_lng, in_accuracy_m = v_acc, in_distance_m = v_dist, updated_at = now();
  else
    if v_row.clock_in is null then return jsonb_build_object('ok', false, 'reason', 'not_in'); end if;
    if v_row.clock_out is not null then return jsonb_build_object('ok', false, 'reason', 'already_out', 'at', v_row.clock_out); end if;
    update staff_attendance set clock_out = v_now, marked_by = v_uid, out_lat = p_lat, out_lng = p_lng, out_accuracy_m = v_acc, out_distance_m = v_dist, updated_at = now()
    where id = v_row.id;
  end if;

  insert into staff_clock_attempts (school_id, user_id, date, kind, outcome, distance_m, accuracy_m, lat, lng) values (p_school, v_uid, v_today, p_kind, 'ok', v_dist, v_acc, p_lat, p_lng);
  return jsonb_build_object('ok', true, 'kind', p_kind, 'at', v_now, 'distance', v_dist,
    'late', p_kind = 'in' and v_local > v_s.staff_late_after,
    'early', p_kind = 'out' and v_s.staff_close_at is not null and v_local < v_s.staff_close_at);
end $fn$;

-- "I'm on official duty" (away from school for school business). The principal decides.
create or replace function public.request_duty(p_school uuid, p_note text)
returns void language plpgsql security definer set search_path = public as $fn$
declare v_uid uuid := auth.uid(); v_note text := trim(coalesce(p_note, ''));
begin
  if v_uid is null or not public.is_clocking_staff(p_school, v_uid) then raise exception 'not allowed' using errcode = '42501'; end if;
  if char_length(v_note) < 3 then raise exception 'Say where you are' using errcode = 'P0001'; end if;
  insert into staff_attendance (school_id, user_id, date, status, marked_by, duty_request, duty_state)
  values (p_school, v_uid, public.lagos_today(), 'present', v_uid, left(v_note, 200), 'pending')
  on conflict (school_id, user_id, date) do update set duty_request = left(v_note, 200), duty_state = 'pending', duty_decided_by = null, duty_decided_at = null, updated_at = now()
  where staff_attendance.duty_state is distinct from 'approved';
end $fn$;

create or replace function public.decide_duty(p_school uuid, p_user uuid, p_date date, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $fn$
begin
  if not public.is_head(p_school) then raise exception 'not allowed' using errcode = '42501'; end if;
  update staff_attendance set
    duty_state = case when p_approve then 'approved' else 'declined' end,
    status = case when p_approve then 'duty' else status end,
    duty_decided_by = auth.uid(), duty_decided_at = now(), marked_by = auth.uid(), updated_at = now()
  where school_id = p_school and user_id = p_user and date = p_date and duty_state = 'pending';
  if not found then raise exception 'No request' using errcode = 'P0001'; end if;
end $fn$;

-- The principal can mark absent, on leave or official duty, or clear a day, but no longer clock
-- anyone in or out: staff do that themselves at school.
create or replace function public.clock_staff(p_school uuid, p_user uuid, p_date date, p_action text, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_head(p_school) then raise exception 'not allowed' using errcode = '42501'; end if;
  if not public.is_clocking_staff(p_school, p_user) then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_date > public.lagos_today() then raise exception 'Future date' using errcode = 'P0001'; end if;
  if p_action in ('in', 'out') then
    raise exception 'Staff clock themselves in' using errcode = 'P0001';
  elsif p_action in ('absent', 'leave', 'duty') then
    if p_action <> 'duty' and exists (select 1 from staff_attendance where school_id = p_school and user_id = p_user and date = p_date and clock_in is not null) then
      raise exception 'Already clocked in' using errcode = 'P0001';
    end if;
    insert into staff_attendance (school_id, user_id, date, status, note, marked_by)
    values (p_school, p_user, p_date, p_action, nullif(trim(coalesce(p_note, '')), ''), auth.uid())
    on conflict (school_id, user_id, date) do update set status = excluded.status, note = coalesce(excluded.note, staff_attendance.note),
      clock_in = case when excluded.status = 'duty' then staff_attendance.clock_in else null end,
      clock_out = case when excluded.status = 'duty' then staff_attendance.clock_out else null end,
      duty_state = case when excluded.status = 'duty' then 'approved' else staff_attendance.duty_state end,
      marked_by = auth.uid(), updated_at = now();
  elsif p_action = 'clear' then
    if char_length(trim(coalesce(p_note, ''))) < 3 then raise exception 'Give a reason' using errcode = 'P0001'; end if;
    update staff_attendance set note = trim(p_note), marked_by = auth.uid() where school_id = p_school and user_id = p_user and date = p_date;
    delete from staff_attendance where school_id = p_school and user_id = p_user and date = p_date;
  else
    raise exception 'Bad action' using errcode = 'P0001';
  end if;
end $$;

-- One day for the whole staff, with where each clock-in and out happened and any refused tries.
create or replace function public.staff_attendance_day(p_school uuid, p_date date)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when not public.is_school_admin(p_school) then null else jsonb_build_object(
    'late_after', (select to_char(staff_late_after, 'HH24:MI') from schools where id = p_school),
    'close_at', (select to_char(staff_close_at, 'HH24:MI') from schools where id = p_school),
    'geo_set', (select geo_lat is not null from schools where id = p_school),
    'radius', (select geo_radius_m from schools where id = p_school),
    'staff', coalesce((select jsonb_agg(x order by x->>'name') from (
      select jsonb_build_object('id', p.id, 'name', coalesce(nullif(trim(p.full_name), ''), p.email, 'Staff member'),
        'role', (select string_agg(initcap(m2.role::text), ', ' order by m2.role) from memberships m2 where m2.school_id = p_school and m2.user_id = p.id and m2.role in ('admin','principal','bursar','teacher')),
        'clock_in', a.clock_in, 'clock_out', a.clock_out, 'status', a.status, 'note', a.note,
        'in_distance', a.in_distance_m, 'out_distance', a.out_distance_m,
        'in_lat', a.in_lat, 'in_lng', a.in_lng, 'out_lat', a.out_lat, 'out_lng', a.out_lng,
        'duty_request', a.duty_request, 'duty_state', a.duty_state,
        'refused', (select jsonb_agg(jsonb_build_object('at', t.at, 'kind', t.kind, 'outcome', t.outcome, 'distance', t.distance_m, 'lat', t.lat, 'lng', t.lng) order by t.at)
                    from staff_clock_attempts t where t.school_id = p_school and t.user_id = p.id and t.date = p_date and t.outcome <> 'ok')) x
      from (select distinct user_id from memberships where school_id = p_school and role in ('admin','principal','bursar','teacher')) m
      join profiles p on p.id = m.user_id
      left join staff_attendance a on a.school_id = p_school and a.user_id = p.id and a.date = p_date) q), '[]'::jsonb)) end;
$$;

create or replace function public.staff_attendance_month(p_school uuid, p_month date)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when not public.is_school_admin(p_school) then null else coalesce((select jsonb_agg(x order by x->>'name') from (
    select jsonb_build_object('id', p.id, 'name', coalesce(nullif(trim(p.full_name), ''), p.email, 'Staff member'),
      'present', count(a.*) filter (where a.status = 'present' and a.clock_in is not null),
      'late', count(a.*) filter (where a.status = 'present' and (a.clock_in at time zone 'Africa/Lagos')::time > sc.staff_late_after),
      'left_early', count(a.*) filter (where a.clock_out is not null and sc.staff_close_at is not null and a.status = 'present' and (a.clock_out at time zone 'Africa/Lagos')::time < sc.staff_close_at),
      'no_out', count(a.*) filter (where a.clock_in is not null and a.clock_out is null and a.status = 'present' and a.date < public.lagos_today()),
      'outside', (select count(distinct t.date) from staff_clock_attempts t where t.school_id = p_school and t.user_id = p.id and t.outcome = 'too_far'
                  and t.date >= date_trunc('month', p_month)::date and t.date < (date_trunc('month', p_month) + interval '1 month')::date),
      'absent', count(a.*) filter (where a.status = 'absent'),
      'leave', count(a.*) filter (where a.status = 'leave'),
      'duty', count(a.*) filter (where a.status = 'duty'),
      'avg_in', to_char(to_timestamp(avg(extract(epoch from (a.clock_in at time zone 'Africa/Lagos')::time)) filter (where a.clock_in is not null)) at time zone 'UTC', 'HH24:MI')) x
    from (select distinct user_id from memberships where school_id = p_school and role in ('admin','principal','bursar','teacher')) m
    join profiles p on p.id = m.user_id
    join schools sc on sc.id = p_school
    left join staff_attendance a on a.school_id = p_school and a.user_id = p.id
      and a.date >= date_trunc('month', p_month)::date and a.date < (date_trunc('month', p_month) + interval '1 month')::date
    group by p.id, p.full_name, p.email, sc.staff_late_after, sc.staff_close_at) q), '[]'::jsonb) end;
$$;

-- A staff member's own day, for the clock-in card on their home page.
create or replace function public.my_staff_clock(p_school uuid)
returns jsonb language sql stable security definer set search_path = public as $fn$
  select case when not public.is_clocking_staff(p_school, auth.uid()) then null else jsonb_build_object(
    'geo_set', s.geo_lat is not null or s.is_demo,
    'late_after', to_char(s.staff_late_after, 'HH24:MI'),
    'close_at', to_char(s.staff_close_at, 'HH24:MI'),
    'clock_in', a.clock_in, 'clock_out', a.clock_out, 'status', a.status,
    'duty_request', a.duty_request, 'duty_state', a.duty_state) end
  from schools s
  left join staff_attendance a on a.school_id = s.id and a.user_id = auth.uid() and a.date = public.lagos_today()
  where s.id = p_school;
$fn$;

-- ===========================================================================
-- Permissions (same as 0022; the new functions are callable by signed-in users and check who they are).
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
-- Attendance is written only through the functions above.
revoke insert, update, delete, truncate on public.staff_attendance from authenticated, anon;
revoke insert, update, delete, truncate on public.staff_clock_attempts from authenticated, anon;
