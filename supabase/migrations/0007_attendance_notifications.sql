-- School-wide attendance view and messages to parents.

-- Each school decides whether parents get an email when their child is marked absent.
alter table public.schools add column if not exists notify_absence_email boolean not null default true;

-- Every message we send (or skip), so nobody gets the same message twice and the
-- school can see who was told. Written only by the server (service role).
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  student_id uuid references public.students (id) on delete cascade,
  kind text not null check (kind in ('absence', 'register_reminder')),
  channel text not null check (channel in ('email', 'sms', 'whatsapp')),
  recipient text not null,
  about_date date not null,
  status text not null check (status in ('sent', 'failed', 'skipped')),
  error text,
  provider_id text,
  created_at timestamptz not null default now(),
  constraint notifications_once unique nulls not distinct (kind, channel, recipient, about_date, student_id)
);
create index if not exists notifications_school_date on public.notifications (school_id, about_date);

alter table public.notifications enable row level security;
drop policy if exists notifications_admin_read on public.notifications;
create policy notifications_admin_read on public.notifications for select using (public.is_school_admin(school_id));

-- One day's attendance for the whole school: every class, who took the register,
-- and every absent or late student with whether their parents were emailed.
create or replace function public.attendance_overview(p_school uuid, p_date date)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when not public.is_school_admin(p_school) then null else jsonb_build_object(
    'date', p_date,
    'students', (select count(*) from students where school_id = p_school and status = 'active'),
    'present', (select count(*) from attendance where school_id = p_school and date = p_date and status = 'present'),
    'absent', (select count(*) from attendance where school_id = p_school and date = p_date and status = 'absent'),
    'late', (select count(*) from attendance where school_id = p_school and date = p_date and status = 'late'),
    'classes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id,
        'name', public.class_label(c.name, c.arm),
        'teacher', nullif(trim(coalesce(p.full_name, '')), ''),
        'teacher_email', p.email,
        'students', (select count(*) from students s where s.class_id = c.id and s.status = 'active'),
        'marked', (select count(*) from attendance a where a.class_id = c.id and a.date = p_date),
        'present', (select count(*) from attendance a where a.class_id = c.id and a.date = p_date and a.status = 'present'),
        'absent', (select count(*) from attendance a where a.class_id = c.id and a.date = p_date and a.status = 'absent'),
        'late', (select count(*) from attendance a where a.class_id = c.id and a.date = p_date and a.status = 'late'),
        'taken_at', (select min(a.synced_at) from attendance a where a.class_id = c.id and a.date = p_date),
        'reminded', exists (select 1 from notifications n where n.school_id = p_school and n.kind = 'register_reminder'
                              and n.about_date = p_date and n.recipient = coalesce(p.email, '') and n.status = 'sent'))
        order by c.level_order, c.name, c.arm)
      from classes c left join profiles p on p.id = c.class_teacher_id
      where c.school_id = p_school
        and exists (select 1 from students s where s.class_id = c.id and s.status = 'active')), '[]'::jsonb),
    'missing', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'name', s.first_name || ' ' || s.last_name,
        'class', public.class_label(c.name, c.arm),
        'status', a.status,
        'absences_this_term', (select count(*) from attendance a2 join terms t on t.school_id = p_school and t.is_current
                                where a2.student_id = s.id and a2.status = 'absent'
                                  and (t.starts_on is null or a2.date >= t.starts_on)),
        'parents_with_email', (select count(*) from guardians g join profiles gp on gp.id = g.user_id
                                where g.student_id = s.id and coalesce(gp.email, '') <> ''),
        'emailed', (select count(*) from notifications n where n.student_id = s.id and n.kind = 'absence'
                     and n.about_date = p_date and n.status = 'sent'))
        order by a.status, c.level_order, c.name, s.last_name)
      from attendance a join students s on s.id = a.student_id join classes c on c.id = a.class_id
      where a.school_id = p_school and a.date = p_date and a.status in ('absent', 'late')), '[]'::jsonb),
    'notify_absence_email', (select notify_absence_email from schools where id = p_school)
  ) end;
$$;
revoke all on function public.attendance_overview(uuid, date) from public, anon;
grant execute on function public.attendance_overview(uuid, date) to authenticated;
