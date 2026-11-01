-- Safety fixes before live testers. Safe to run more than once. Run after 0019.
-- Paste this file on its own into an empty SQL editor tab.

alter table public.schools add column if not exists is_demo boolean not null default false;

-- 1. Owners and admins can edit their school's details, but not the settings
--    only Simpliskool may change (now including the demo marker: a school marked
--    as a demo would be wiped every night and hidden from the back office).
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
  end if;
  return new;
end $fn$;
drop trigger if exists schools_guard on public.schools;
create trigger schools_guard before update on public.schools for each row execute function public.guard_school_columns();

-- 2. People can change their own name, but not the email or phone on their
--    profile. Simpliskool finds people by these when they're invited to a
--    school, so changing them could catch someone else's invitation.
--    (Sign-in email and phone are changed through Supabase sign-in instead.)
create or replace function public.guard_profile_columns()
returns trigger language plpgsql as $fn$
begin
  if current_user in ('authenticated', 'anon') then
    new.email := old.email;
    new.phone := old.phone;
    new.id := old.id;
  end if;
  return new;
end $fn$;
drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before update on public.profiles for each row execute function public.guard_profile_columns();

-- 3. "Active today" in the back office counts real people, not demo visitors.
create or replace function public.platform_active_since(p_since timestamptz)
returns bigint language sql stable security definer set search_path = public as $fn$
  select count(*) from auth.users where last_sign_in_at >= p_since and coalesce(email, '') not like '%@demo.simpliskool.com';
$fn$;

-- ===========================================================================
-- Permissions (same as 0019), so 0008 doesn't need to be run again.
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
