-- Online fee payments (Paystack), SMS (Termii) and scheduled announcements.
-- Safe to run more than once. Run after 0013.

-- ===========================================================================
-- 1. Online fee payments
-- ===========================================================================

-- The school's payout account becomes a Paystack "subaccount": parents' payments
-- are split straight into the school's bank account.
alter table public.school_payouts add column if not exists bank_code text;
alter table public.school_payouts add column if not exists paystack_subaccount text;

alter table public.payments add column if not exists channel text;      -- card, bank_transfer, ussd ...
alter table public.payments add column if not exists fees_kobo bigint;  -- Paystack's charge, for the school's records

-- One row per "Pay online" click. The payment row is only created once Paystack
-- confirms the money arrived (callback or webhook, whichever comes first).
create table if not exists public.payment_intents (
  reference text primary key,
  school_id uuid not null references public.schools (id) on delete cascade,
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  amount_kobo bigint not null check (amount_kobo >= 10000),
  created_by uuid references public.profiles (id) on delete set null,
  status text not null default 'started' check (status in ('started', 'paid', 'failed')),
  payment_id uuid references public.payments (id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists payment_intents_invoice on public.payment_intents (invoice_id, created_at desc);
alter table public.payment_intents enable row level security;
drop policy if exists payment_intents_read on public.payment_intents;
create policy payment_intents_read on public.payment_intents for select
  using (created_by = auth.uid() or public.is_finance(school_id));
-- No write policies: only the server (service role) writes intents.

-- Can parents of this school pay online? (They can't read the payout account itself.)
create or replace function public.online_payments_ready(p_school uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_member(p_school) and exists (
    select 1 from school_payouts where school_id = p_school and paystack_subaccount is not null);
$$;

-- Records a payment Paystack has confirmed. Server only. Safe to call twice for
-- the same reference (callback and webhook both arrive): the second call returns
-- the first payment.
create or replace function public.complete_online_payment(p_reference text, p_amount_kobo bigint, p_paid_at timestamptz, p_channel text, p_fees_kobo bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_int record;
  v_pay record;
  v_no int;
  v_receipt text;
  v_id uuid;
begin
  select * into v_int from payment_intents where reference = p_reference for update;
  if v_int.reference is null then raise exception 'Unknown payment reference' using errcode = 'P0002'; end if;
  select id, receipt_no into v_pay from payments where paystack_reference = p_reference;
  if v_pay.id is not null then
    return jsonb_build_object('id', v_pay.id, 'receipt_no', v_pay.receipt_no, 'new', false);
  end if;
  if p_amount_kobo is distinct from v_int.amount_kobo then
    update payment_intents set status = 'failed', note = 'Paid amount ' || coalesce(p_amount_kobo::text, '?') || ' kobo did not match', updated_at = now()
     where reference = p_reference;
    raise exception 'Amount does not match' using errcode = 'P0001';
  end if;

  insert into receipt_counters (school_id, last_no) values (v_int.school_id, 1)
  on conflict (school_id) do update set last_no = receipt_counters.last_no + 1
  returning last_no into v_no;
  v_receipt := 'RC' || lpad(v_no::text, 6, '0');

  insert into payments (school_id, invoice_id, amount_kobo, method, paystack_reference, status, receipt_no, paid_at, reference, recorded_by, channel, fees_kobo)
  values (v_int.school_id, v_int.invoice_id, v_int.amount_kobo, 'paystack', p_reference, 'success', v_receipt,
          coalesce(p_paid_at, now()), p_reference, v_int.created_by, left(p_channel, 30), p_fees_kobo)
  returning id into v_id;
  update payment_intents set status = 'paid', payment_id = v_id, updated_at = now() where reference = p_reference;
  return jsonb_build_object('id', v_id, 'receipt_no', v_receipt, 'new', true);
end $$;

-- ===========================================================================
-- 2. SMS (Termii)
-- ===========================================================================
-- SMS costs money, so it is off until the owner switches it on.
alter table public.schools add column if not exists sms_enabled boolean not null default false;
alter table public.schools add column if not exists sms_absence boolean not null default true;
alter table public.schools add column if not exists sms_fees boolean not null default true;
alter table public.schools add column if not exists sms_receipts boolean not null default true;

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('absence', 'register_reminder', 'fee_reminder', 'fee_invoice', 'report_card', 'score_reminder', 'payment_receipt'));
-- A parent can pay twice in a day, so receipt texts are logged with the receipt
-- number in the recipient ("+234... RC000123"): one text per payment.

-- Announcements can also go by SMS, and be scheduled for later (section 3).
alter table public.announcements add column if not exists send_email boolean not null default false;
alter table public.announcements add column if not exists send_sms boolean not null default false;
alter table public.announcements add column if not exists dispatched_at timestamptz;
alter table public.announcements add column if not exists sms_sent int not null default 0;
alter table public.announcements add column if not exists scheduled_for timestamptz;

-- SMS sent this month (individual messages plus announcement texts).
create or replace function public.sms_usage(p_school uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when not public.is_school_admin(p_school) then null else jsonb_build_object(
    'month', (select count(*) from notifications where school_id = p_school and channel = 'sms' and status = 'sent'
               and created_at >= date_trunc('month', now() at time zone 'Africa/Lagos') at time zone 'Africa/Lagos')
           + coalesce((select sum(sms_sent) from announcements where school_id = p_school
               and created_at >= date_trunc('month', now() at time zone 'Africa/Lagos') at time zone 'Africa/Lagos'), 0),
    'failed', (select count(*) from notifications where school_id = p_school and channel = 'sms' and status = 'failed'
               and created_at >= now() - interval '7 days'),
    'parents', (select count(distinct g.user_id) from guardians g join students s on s.id = g.student_id
                 join profiles p on p.id = g.user_id where s.school_id = p_school and s.status = 'active' and coalesce(p.phone, '') <> '')
  ) end;
$$;

-- ===========================================================================
-- 3. Announcements: SMS, and scheduling for later
-- ===========================================================================
-- Announcements sent before this file was run have already been emailed.
update public.announcements set dispatched_at = created_at where dispatched_at is null and not send_email and not send_sms;

-- Waiting announcements live here, out of sight of parents, staff and students,
-- until their time comes. Then they move into announcements.
create table if not exists public.scheduled_announcements (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 3 and 120),
  body text not null check (char_length(body) between 1 and 3000),
  audience public.announcement_audience not null,
  class_ids uuid[],
  kind text not null default 'notice' check (kind in ('notice', 'event')),
  event_at timestamptz,
  send_email boolean not null default false,
  send_sms boolean not null default false,
  publish_at timestamptz not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (audience <> 'class' or coalesce(array_length(class_ids, 1), 0) > 0)
);
create index if not exists scheduled_announcements_due on public.scheduled_announcements (publish_at);
alter table public.scheduled_announcements enable row level security;
drop policy if exists scheduled_announcements_admin on public.scheduled_announcements;
create policy scheduled_announcements_admin on public.scheduled_announcements for all
  using (public.is_school_admin(school_id)) with check (public.is_school_admin(school_id));

-- Moves every announcement whose time has come into announcements. Server and
-- pg_cron only. Returns how many were released.
create or replace function public.release_due_announcements()
returns int language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  with due as (
    delete from scheduled_announcements where publish_at <= now() returning *
  ), ins as (
    insert into announcements (school_id, title, body, audience, class_ids, kind, event_at, created_by, reach, send_email, send_sms, scheduled_for, dispatched_at)
    select d.school_id, d.title, d.body, d.audience, d.class_ids, d.kind, d.event_at, d.created_by,
           (select count(distinct u.user_id)::int from public.announcement_users(d.school_id, d.audience, d.class_ids) u),
           d.send_email, d.send_sms, d.publish_at,
           case when d.send_email or d.send_sms then null else now() end
    from due d
    returning 1
  )
  select count(*) into v_n from ins;
  return v_n;
end $$;

-- Every minute, if the database has pg_cron (Supabase does; switch it on under
-- Database → Extensions if this step says it's missing). Without it, the app
-- releases them whenever someone uses Simpliskool, and the daily job catches the rest.
do $$
begin
  create extension if not exists pg_cron with schema pg_catalog;
  if exists (select 1 from cron.job where jobname = 'simpliskool-release-announcements') then
    perform cron.unschedule('simpliskool-release-announcements');
  end if;
  perform cron.schedule('simpliskool-release-announcements', '* * * * *', 'select public.release_due_announcements()');
exception when others then
  raise notice 'pg_cron is not available (%). Scheduled announcements are released by the app instead.', sqlerrm;
end $$;

-- History also shows announcements still waiting to go out.
create or replace function public.announcement_history(p_school uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when not public.is_school_admin(p_school) then '[]'::jsonb else coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', a.id, 'title', a.title, 'audience', a.audience, 'kind', a.kind, 'event_at', a.event_at, 'at', a.created_at,
      'class_names', (select jsonb_agg(public.class_label(c.name, c.arm) order by c.level_order, c.name, c.arm) from classes c where c.id = any(a.class_ids)),
      'reach', a.reach, 'emailed', a.emailed, 'sms_sent', a.sms_sent, 'scheduled_for', a.scheduled_for,
      'read', (select count(*) from announcement_reads r where r.announcement_id = a.id),
      'going', (select count(*) from announcement_rsvps r where r.announcement_id = a.id and r.going),
      'not_going', (select count(*) from announcement_rsvps r where r.announcement_id = a.id and not r.going))
      order by a.created_at desc)
    from (select * from announcements where school_id = p_school order by created_at desc limit 50) a), '[]'::jsonb) end;
$$;

-- ===========================================================================
-- 4. Permissions (same as 0013), so 0008 doesn't need to be run again.
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
    if f.proname in ('verify_student_pin', 'announcement_users', 'complete_online_payment', 'release_due_announcements') then
      -- Server only.
      execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
    elsif f.proname not in ('handle_new_user', 'audit_row', 'check_score_limits', 'sync_period_times', 'sync_invoice_paid', 'application_ref', 'lock_paid_payslips') then
      execute format('grant execute on function %s to authenticated', f.sig);
    end if;
  end loop;
end $$;
grant execute on function public.admissions_open(uuid) to anon;
grant execute on function public.is_school_admin(uuid) to anon;
