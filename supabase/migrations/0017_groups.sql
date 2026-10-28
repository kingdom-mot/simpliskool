-- School groups: one proprietor, several branches. Each branch is a normal school
-- (its own principal, staff, classes and fees); the group sees them side by side.
-- Safe to run more than once. Run after 0016.

alter table public.school_groups add column if not exists created_by uuid references public.profiles (id) on delete set null;
alter table public.schools add column if not exists capacity int check (capacity is null or capacity between 1 and 20000);

-- Who looks after the group (not branch staff).
create table if not exists public.group_members (
  group_id uuid not null references public.school_groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('proprietor', 'finance', 'academic')),
  branch_ids uuid[],                 -- null = every branch
  invited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
alter table public.group_members enable row level security;
-- Looked up outside the policy, so the policy doesn't read its own table.
create or replace function public.is_group_proprietor(p_group uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from group_members where group_id = p_group and user_id = auth.uid() and role = 'proprietor');
$$;
drop policy if exists group_members_read on public.group_members;
create policy group_members_read on public.group_members for select using (user_id = auth.uid() or public.is_group_proprietor(group_id));
-- Written by the server only.

drop policy if exists school_groups_read on public.school_groups;
create policy school_groups_read on public.school_groups for select using (
  exists (select 1 from group_members m where m.group_id = school_groups.id and m.user_id = auth.uid())
  or exists (select 1 from schools s where s.group_id = school_groups.id and public.is_member(s.id)));

-- An owner turns their school into the first branch of a new group.
create or replace function public.create_group(p_school uuid, p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_group uuid;
begin
  if not public.has_role(p_school, array['owner']::public.app_role[]) then raise exception 'not allowed' using errcode = '42501'; end if;
  if exists (select 1 from schools where id = p_school and group_id is not null) then raise exception 'Already in a group' using errcode = 'P0001'; end if;
  if char_length(trim(coalesce(p_name, ''))) not between 3 and 120 then raise exception 'Name the group' using errcode = 'P0001'; end if;
  insert into school_groups (name, created_by) values (trim(p_name), auth.uid()) returning id into v_group;
  update schools set group_id = v_group where id = p_school;
  insert into group_members (group_id, user_id, role) values (v_group, auth.uid(), 'proprietor');
  return v_group;
end $$;

-- A new branch, optionally set up like an existing one (classes, subjects, bell
-- times, grading, mark split, colours). Students, staff and fees are never copied.
create or replace function public.add_branch(p_group uuid, p_name text, p_slug text, p_copy_from uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_school uuid; v_src record;
begin
  if not public.is_group_proprietor(p_group) then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_copy_from is not null and not exists (select 1 from schools where id = p_copy_from and group_id = p_group) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  v_school := public.create_school(p_name, p_slug);
  update schools set group_id = p_group where id = v_school;
  if p_copy_from is not null then
    select * into v_src from schools where id = p_copy_from;
    update schools set primary_color = v_src.primary_color, secondary_color = v_src.secondary_color, logo_url = v_src.logo_url,
      assessment = v_src.assessment, staff_late_after = v_src.staff_late_after, motto = v_src.motto
    where id = v_school;
    delete from grading_scales where school_id = v_school;
    insert into grading_scales (school_id, grade, min_score, max_score, remark)
      select v_school, grade, min_score, max_score, remark from grading_scales where school_id = p_copy_from;
    insert into subjects (school_id, name, code) select v_school, name, code from subjects where school_id = p_copy_from on conflict do nothing;
    insert into classes (school_id, name, arm, level_order) select v_school, name, arm, level_order from classes where school_id = p_copy_from on conflict do nothing;
    insert into class_subjects (school_id, class_id, subject_id)
      select v_school, nc.id, ns.id
      from class_subjects cs
      join classes oc on oc.id = cs.class_id join subjects os on os.id = cs.subject_id
      join classes nc on nc.school_id = v_school and nc.name = oc.name and nc.arm = oc.arm
      join subjects ns on ns.school_id = v_school and ns.name = os.name
      where cs.school_id = p_copy_from
    on conflict do nothing;
    insert into school_periods (school_id, label, kind, starts_at, ends_at)
      select v_school, label, kind, starts_at, ends_at from school_periods where school_id = p_copy_from;
  end if;
  return v_school;
end $$;

-- ===========================================================================
-- Permissions (same as 0016), so 0008 doesn't need to be run again.
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
