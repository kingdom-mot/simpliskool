-- Dream Savvy back office (super admin): team and roles, read-only "view as a
-- school", new-school checks before payments, plans and features, support
-- requests, notices to schools, SMS credit and sender names, refunds, an audit
-- log that can't be changed, and platform settings.
-- Safe to run more than once. Run after 0017.
-- Paste this file on its own into an empty SQL editor tab.

-- ===========================================================================
-- 1. Platform settings (one row). Read and written by the server only.
-- ===========================================================================
create table if not exists public.platform_settings (
  id boolean primary key default true check (id),
  data jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.platform_settings enable row level security;

-- ===========================================================================
-- 2. Schools: plan, checks, features, SMS credit, sender name
-- ===========================================================================
alter table public.schools add column if not exists pilot_ends date;
alter table public.schools add column if not exists features jsonb not null default '{}'::jsonb;
alter table public.schools add column if not exists payments_approved_at timestamptz;
alter table public.schools add column if not exists payments_approved_by uuid references public.profiles (id) on delete set null;
alter table public.schools add column if not exists check_status text not null default 'waiting';
alter table public.schools add column if not exists check_note text;
alter table public.schools add column if not exists cac_number text;
alter table public.schools add column if not exists sms_credit int not null default 500;
alter table public.schools add column if not exists sender_id text;
alter table public.schools add column if not exists sender_status text not null default 'none';
alter table public.schools add column if not exists sender_note text;
alter table public.schools add column if not exists sender_asked_at timestamptz;
alter table public.schools add column if not exists suspended_at timestamptz;
alter table public.schools add column if not exists suspended_reason text;
alter table public.schools drop constraint if exists schools_check_status_check;
alter table public.schools add constraint schools_check_status_check check (check_status in ('waiting', 'asked', 'approved'));
alter table public.schools drop constraint if exists schools_sender_status_check;
alter table public.schools add constraint schools_sender_status_check check (sender_status in ('none', 'asked', 'sent', 'live', 'rejected'));
alter table public.schools drop constraint if exists schools_sender_id_check;
alter table public.schools add constraint schools_sender_id_check check (sender_id is null or sender_id ~ '^[A-Za-z0-9 ]{3,11}$');

-- Schools that already take online payments keep them (only the first time this runs).
do $grandfather$
begin
  if not exists (select 1 from platform_settings) then
    update schools s set payments_approved_at = now(), check_status = 'approved'
    where s.payments_approved_at is null
      and exists (select 1 from school_payouts p where p.school_id = s.id and p.paystack_subaccount is not null);
  end if;
end $grandfather$;

insert into public.platform_settings (id, data) values (true, jsonb_build_object(
  'fee_kobo', 0,
  'flags', jsonb_build_object('ai', true, 'cbt', true, 'payroll', true, 'grp', true, 'inspect', true, 'wa', false),
  'trial_days', 30,
  'free_sms', 500,
  'sms_price', '',
  'pin_tries', 5,
  'pin_lock_minutes', 15,
  'view_minutes', 30,
  'pilot_ends', null,
  'plans', jsonb_build_object(
    'pilot', jsonb_build_object('price', 'Free', 'desc', 'Everything included until the pilot ends. For our first 20 schools.'),
    'single', jsonb_build_object('price', '', 'desc', 'All features for one school. SMS bought separately.'),
    'group', jsonb_build_object('price', '', 'desc', 'For 2 or more branches. Adds the group portal and shared settings.'))
)) on conflict (id) do nothing;

-- Internal notes about a school: never shown to the school.
create table if not exists public.school_accounts (
  school_id uuid primary key references public.schools (id) on delete cascade,
  account_manager uuid references public.profiles (id) on delete set null,
  signed_up_by uuid references public.profiles (id) on delete set null,
  team_note text,
  billing_talk text not null default 'not_yet' check (billing_talk in ('not_yet', 'happy', 'later', 'unsure', 'leaving')),
  real_check text,
  real_checked_by uuid references public.profiles (id) on delete set null,
  real_checked_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.school_accounts enable row level security;

-- Owners and admins can edit their school's details, but not these.
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
  end if;
  return new;
end $fn$;
drop trigger if exists schools_guard on public.schools;
create trigger schools_guard before update on public.schools for each row execute function public.guard_school_columns();

-- New schools start with the free SMS credit from the platform settings.
create or replace function public.school_defaults()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  new.sms_credit := coalesce((select (data ->> 'free_sms')::int from platform_settings), 500);
  return new;
end $fn$;
drop trigger if exists schools_defaults on public.schools;
create trigger schools_defaults before insert on public.schools for each row execute function public.school_defaults();

-- A new or changed payout account pauses online payments until someone checks it.
create or replace function public.payout_changed()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  if tg_op = 'INSERT' or new.account_no is distinct from old.account_no or new.bank_code is distinct from old.bank_code then
    update schools set payments_approved_at = null, payments_approved_by = null, check_status = 'waiting' where id = new.school_id;
  end if;
  return new;
end $fn$;
drop trigger if exists school_payouts_changed on public.school_payouts;
create trigger school_payouts_changed after insert or update on public.school_payouts for each row execute function public.payout_changed();

-- Parents can pay online only once the payout account has been checked.
create or replace function public.online_payments_ready(p_school uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select public.is_member(p_school)
    and exists (select 1 from schools where id = p_school and payments_approved_at is not null and status = 'active')
    and exists (select 1 from school_payouts where school_id = p_school and paystack_subaccount is not null);
$fn$;

-- Takes SMS credit; false (and nothing taken) when there isn't enough. Server only.
create or replace function public.use_sms_credit(p_school uuid, p_n int)
returns boolean language plpgsql security definer set search_path = public as $fn$
begin
  if coalesce(p_n, 0) <= 0 then return true; end if;
  update schools set sms_credit = sms_credit - p_n where id = p_school and sms_credit >= p_n;
  return found;
end $fn$;

-- Gives credit back (a failed send) or adds bought credit. Server only.
create or replace function public.add_sms_credit(p_school uuid, p_n int)
returns int language sql security definer set search_path = public as $fn$
  update schools set sms_credit = greatest(0, sms_credit + coalesce(p_n, 0)) where id = p_school returning sms_credit;
$fn$;

-- The owner asks for their own SMS sender name (Dream Savvy sends it to the SMS provider).
create or replace function public.request_sender(p_school uuid, p_sender text)
returns void language plpgsql security definer set search_path = public as $fn$
declare v text := upper(trim(coalesce(p_sender, '')));
begin
  if not public.has_role(p_school, array['owner']::public.app_role[]) then raise exception 'not allowed' using errcode = '42501'; end if;
  if v !~ '^[A-Z0-9 ]{3,11}$' then raise exception 'Use 3 to 11 letters or numbers' using errcode = 'P0001'; end if;
  if exists (select 1 from schools where id = p_school and sender_status in ('asked', 'sent') and sender_id = v) then return; end if;
  update schools set sender_id = v, sender_status = 'asked', sender_note = null, sender_asked_at = now() where id = p_school;
end $fn$;

-- ===========================================================================
-- 3. The Dream Savvy team, and read-only "view as a school"
-- ===========================================================================
create table if not exists public.platform_team (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  role text not null check (role in ('super', 'support', 'finance', 'growth')),
  totp_secret text,
  totp_on_at timestamptz,
  invited_by uuid references public.profiles (id) on delete set null,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.platform_team enable row level security;
insert into public.platform_team (user_id, role) select user_id, 'super' from public.platform_admins on conflict do nothing;

create table if not exists public.platform_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  school_id uuid not null references public.schools (id) on delete cascade,
  reason text not null,
  ticket text,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  ended_at timestamptz
);
create index if not exists platform_views_user on public.platform_views (user_id, expires_at desc);
alter table public.platform_views enable row level security;

-- True while a team member has an open viewing session for the school, and only
-- inside read-only requests: they can look but never change anything.
create or replace function public.viewing_school(p_school uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select coalesce(current_setting('transaction_read_only', true), 'off') = 'on' and exists (
    select 1 from platform_views v join platform_team t on t.user_id = v.user_id
    where v.user_id = auth.uid() and v.school_id = p_school and v.ended_at is null and v.expires_at > now());
$fn$;

-- Platform team members are no longer treated as owners of every school. They
-- see a school only while viewing it, read only, as its owner would.
create or replace function public.has_role(p_school uuid, p_roles public.app_role[])
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (
    select 1 from memberships m
    where m.school_id = p_school and m.user_id = auth.uid() and m.role = any (p_roles)
  ) or ('owner' = any (p_roles) and public.viewing_school(p_school));
$fn$;

-- ===========================================================================
-- 4. Support requests from schools
-- ===========================================================================
create table if not exists public.support_tickets (
  id bigint generated always as identity (start with 1001) primary key,
  school_id uuid not null references public.schools (id) on delete cascade,
  opened_by uuid references public.profiles (id) on delete set null,
  subject text not null check (char_length(subject) between 3 and 140),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'urgent')),
  status text not null default 'open' check (status in ('open', 'closed')),
  assigned_to uuid references public.profiles (id) on delete set null,
  last_from text not null default 'school' check (last_from in ('school', 'team')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists support_tickets_school on public.support_tickets (school_id, updated_at desc);
alter table public.support_tickets enable row level security;
drop policy if exists support_tickets_read on public.support_tickets;
create policy support_tickets_read on public.support_tickets for select
  using (public.has_role(school_id, array['owner', 'admin', 'principal', 'bursar']::public.app_role[]));

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id bigint not null references public.support_tickets (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  author_name text,
  from_team boolean not null default false,
  internal boolean not null default false,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index if not exists support_messages_ticket on public.support_messages (ticket_id, created_at);
alter table public.support_messages enable row level security;
drop policy if exists support_messages_read on public.support_messages;
create policy support_messages_read on public.support_messages for select using (
  not internal and exists (select 1 from support_tickets t where t.id = ticket_id
    and public.has_role(t.school_id, array['owner', 'admin', 'principal', 'bursar']::public.app_role[])));

create or replace function public.open_ticket(p_school uuid, p_subject text, p_body text, p_priority text)
returns bigint language plpgsql security definer set search_path = public as $fn$
declare v_id bigint; v_name text;
begin
  if not public.has_role(p_school, array['owner', 'admin', 'principal', 'bursar']::public.app_role[]) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_subject, ''))) not between 3 and 140 then raise exception 'Say in a few words what you need help with' using errcode = 'P0001'; end if;
  if char_length(trim(coalesce(p_body, ''))) not between 5 and 4000 then raise exception 'Tell us a little more' using errcode = 'P0001'; end if;
  if (select count(*) from support_tickets where school_id = p_school and created_at > now() - interval '1 day') >= 20 then
    raise exception 'Too many requests today. Reply on an open request instead.' using errcode = 'P0001';
  end if;
  select full_name into v_name from profiles where id = auth.uid();
  insert into support_tickets (school_id, opened_by, subject, priority)
  values (p_school, auth.uid(), trim(p_subject), case when p_priority in ('low', 'normal', 'urgent') then p_priority else 'normal' end)
  returning id into v_id;
  insert into support_messages (ticket_id, author_id, author_name, body) values (v_id, auth.uid(), v_name, trim(p_body));
  return v_id;
end $fn$;

create or replace function public.reply_ticket(p_ticket bigint, p_body text)
returns void language plpgsql security definer set search_path = public as $fn$
declare v_school uuid; v_name text;
begin
  select school_id into v_school from support_tickets where id = p_ticket;
  if v_school is null or not public.has_role(v_school, array['owner', 'admin', 'principal', 'bursar']::public.app_role[]) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_body, ''))) not between 1 and 4000 then raise exception 'Write a reply' using errcode = 'P0001'; end if;
  select full_name into v_name from profiles where id = auth.uid();
  insert into support_messages (ticket_id, author_id, author_name, body) values (p_ticket, auth.uid(), v_name, trim(p_body));
  update support_tickets set status = 'open', last_from = 'school', updated_at = now() where id = p_ticket;
end $fn$;

-- ===========================================================================
-- 5. Notices to schools (shown in school admins' portals)
-- ===========================================================================
create table if not exists public.platform_notices (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('feat', 'down', 'change')),
  headline text not null check (char_length(headline) between 3 and 120),
  details text check (details is null or char_length(details) <= 500),
  audience text not null check (audience in ('admins', 'bursars', 'pilot', 'chosen')),
  school_ids uuid[],
  show_until date not null,
  email_owners boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  ended_at timestamptz
);
alter table public.platform_notices enable row level security;

create table if not exists public.notice_reads (
  notice_id uuid not null references public.platform_notices (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  school_id uuid references public.schools (id) on delete cascade,
  dismissed_at timestamptz not null default now(),
  primary key (notice_id, user_id)
);
alter table public.notice_reads enable row level security;
drop policy if exists notice_reads_own on public.notice_reads;
create policy notice_reads_own on public.notice_reads for select using (user_id = auth.uid());
drop policy if exists notice_reads_add on public.notice_reads;
create policy notice_reads_add on public.notice_reads for insert with check (user_id = auth.uid() and (school_id is null or public.is_member(school_id)));

-- ===========================================================================
-- 6. Refunds asked for by schools
-- ===========================================================================
create table if not exists public.refund_requests (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  payment_id uuid not null references public.payments (id) on delete cascade,
  amount_kobo bigint not null check (amount_kobo > 0),
  reason text not null check (char_length(reason) between 3 and 300),
  requested_by uuid references public.profiles (id) on delete set null,
  status text not null default 'asked' check (status in ('asked', 'refunded', 'declined')),
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  decline_note text,
  paystack_refund text,
  created_at timestamptz not null default now()
);
create unique index if not exists refund_requests_open on public.refund_requests (payment_id) where status <> 'declined';
alter table public.refund_requests enable row level security;
drop policy if exists refund_requests_read on public.refund_requests;
create policy refund_requests_read on public.refund_requests for select using (public.is_finance(school_id));

create or replace function public.request_refund(p_payment uuid, p_reason text)
returns uuid language plpgsql security definer set search_path = public as $fn$
declare v_pay record; v_id uuid;
begin
  select * into v_pay from payments where id = p_payment;
  if not found or not public.has_role(v_pay.school_id, array['owner', 'bursar']::public.app_role[]) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if v_pay.method <> 'paystack' or v_pay.status <> 'success' or v_pay.voided_at is not null then
    raise exception 'Only online payments that went through can be refunded this way' using errcode = 'P0001';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) not between 3 and 300 then raise exception 'Say why the parent should get the money back' using errcode = 'P0001'; end if;
  if exists (select 1 from refund_requests where payment_id = p_payment and status <> 'declined') then
    raise exception 'A refund was already asked for on this payment' using errcode = 'P0001';
  end if;
  insert into refund_requests (school_id, payment_id, amount_kobo, reason, requested_by)
  values (v_pay.school_id, p_payment, v_pay.amount_kobo, trim(p_reason), auth.uid()) returning id into v_id;
  return v_id;
end $fn$;

-- ===========================================================================
-- 7. Audit log of sensitive actions. Can be added to, never changed.
-- ===========================================================================
-- No foreign keys: entries must outlive the people and schools they mention
-- (deleting a school or a user must never need to change the log).
create table if not exists public.platform_audit (
  id bigint generated always as identity primary key,
  actor_id uuid,
  actor_name text,
  action text not null,
  kind text not null default 'other' check (kind in ('view', 'money', 'access', 'other')),
  school_id uuid,
  school_name text,
  detail text,
  created_at timestamptz not null default now()
);
alter table public.platform_audit drop constraint if exists platform_audit_actor_id_fkey;
alter table public.platform_audit drop constraint if exists platform_audit_school_id_fkey;
alter table public.platform_audit add column if not exists school_name text;
create index if not exists platform_audit_time on public.platform_audit (created_at desc);
alter table public.platform_audit enable row level security;
create or replace function public.audit_locked()
returns trigger language plpgsql as $fn$
begin
  raise exception 'The audit log can''t be changed' using errcode = '42501';
end $fn$;
drop trigger if exists platform_audit_locked on public.platform_audit;
create trigger platform_audit_locked before update or delete on public.platform_audit for each row execute function public.audit_locked();

-- ===========================================================================
-- 8. Student PIN lock follows the platform settings
-- ===========================================================================
create or replace function public.verify_student_pin(p_school_slug text, p_admission_no text, p_pin text)
returns table (status text, student_id uuid, school_id uuid, user_id uuid, locked_until timestamptz)
language plpgsql security definer set search_path = public, extensions as $fn$
#variable_conflict use_column
declare
  s students%rowtype;
  p student_pins%rowtype;
  v_tries int := coalesce((select (data ->> 'pin_tries')::int from platform_settings), 5);
  v_lock interval := make_interval(mins => coalesce((select (data ->> 'pin_lock_minutes')::int from platform_settings), 15));
begin
  select st.* into s
  from students st join schools sc on sc.id = st.school_id
  where sc.slug = lower(trim(p_school_slug)) and sc.status = 'active'
    and upper(st.admission_no) = upper(trim(p_admission_no)) and st.status = 'active'
  limit 1;
  if not found then
    return query select 'invalid'::text, null::uuid, null::uuid, null::uuid, null::timestamptz; return;
  end if;

  select * into p from student_pins where student_pins.student_id = s.id for update;
  if not found or s.signin_method <> 'pin' then
    return query select 'invalid'::text, null::uuid, null::uuid, null::uuid, null::timestamptz; return;
  end if;

  if p.locked_until is not null and p.locked_until > now() then
    return query select 'locked'::text, null::uuid, null::uuid, null::uuid, p.locked_until; return;
  end if;

  if p.pin_hash = crypt(p_pin, p.pin_hash) then
    update student_pins set failed_count = 0, locked_until = null where student_pins.student_id = s.id;
    return query select 'ok'::text, s.id, s.school_id, s.user_id, null::timestamptz; return;
  end if;

  if p.failed_count + 1 >= v_tries then
    update student_pins set failed_count = 0, locked_until = now() + v_lock where student_pins.student_id = s.id;
    insert into audit_log (school_id, actor_id, action, table_name, record_id, details)
    values (s.school_id, null, 'PIN_LOCKED', 'student_pins', s.id, null);
    return query select 'locked'::text, null::uuid, null::uuid, null::uuid, now() + v_lock; return;
  end if;

  update student_pins set failed_count = failed_count + 1 where student_pins.student_id = s.id;
  return query select 'invalid'::text, null::uuid, null::uuid, null::uuid, null::timestamptz;
end $fn$;

-- ===========================================================================
-- 9. Figures for the back office (server only)
-- ===========================================================================
create or replace function public.platform_schools()
returns table (
  id uuid, name text, slug text, address text, status text, plan text, created_at timestamptz,
  group_id uuid, group_name text, owner_id uuid, owner_name text, owner_email text, owner_phone text,
  students bigint, families_joined bigint, staff bigint, last_active timestamptz,
  payout_bank text, payout_account text, payout_name text, payout_verified boolean, subaccount text,
  payments_approved_at timestamptz, check_status text, sms_credit int, sender_id text, sender_status text,
  pilot_ends date, suspended_at timestamptz)
language sql stable security definer set search_path = public as $fn$
  select s.id, s.name, s.slug, s.address, s.status, s.plan, s.created_at,
    s.group_id, g.name, o.user_id, op.full_name, op.email, op.phone,
    (select count(*) from students st where st.school_id = s.id and st.status = 'active'),
    (select count(distinct gu.student_id) from guardians gu join students st on st.id = gu.student_id where st.school_id = s.id and st.status = 'active'),
    (select count(distinct m.user_id) from memberships m where m.school_id = s.id and m.role in ('owner', 'admin', 'principal', 'bursar', 'teacher')),
    (select max(u.last_sign_in_at) from memberships m join auth.users u on u.id = m.user_id where m.school_id = s.id),
    p.bank_name, p.account_no, p.account_name, p.verified_at is not null, p.paystack_subaccount,
    s.payments_approved_at, s.check_status, s.sms_credit, s.sender_id, s.sender_status, s.pilot_ends, s.suspended_at
  from schools s
  left join school_groups g on g.id = s.group_id
  left join lateral (select m.user_id from memberships m where m.school_id = s.id and m.role = 'owner' order by m.created_at limit 1) o on true
  left join profiles op on op.id = o.user_id
  left join school_payouts p on p.school_id = s.id;
$fn$;

create or replace function public.platform_active_since(p_since timestamptz)
returns bigint language sql stable security definer set search_path = public as $fn$
  select count(*) from auth.users where last_sign_in_at >= p_since;
$fn$;

-- ===========================================================================
-- Permissions (same as 0017), so 0008 doesn't need to be run again.
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
                     'use_sms_credit', 'add_sms_credit', 'platform_schools', 'platform_active_since') then
      execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
    elsif f.proname not in ('handle_new_user', 'audit_row', 'check_score_limits', 'sync_period_times', 'sync_invoice_paid', 'application_ref', 'lock_paid_payslips', 'attendance_excused',
                            'guard_school_columns', 'school_defaults', 'payout_changed', 'audit_locked') then
      execute format('grant execute on function %s to authenticated', f.sig);
    end if;
  end loop;
end $grants$;
grant execute on function public.admissions_open(uuid) to anon;
grant execute on function public.is_school_admin(uuid) to anon;
-- The audit log is add-only, for everyone.
revoke update, delete, truncate on public.platform_audit from authenticated, anon, service_role;
