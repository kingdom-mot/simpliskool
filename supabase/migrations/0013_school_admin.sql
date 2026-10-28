-- Admissions, parents, staff attendance, lesson notes, payroll, school website,
-- grading scale and fee payout account. Sets its own permissions at the end.

-- ===========================================================================
-- Shared helpers
-- ===========================================================================
-- Owner, principal or head teacher (clocking staff in, approving lesson notes).
create or replace function public.is_head(p_school uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(p_school, array['owner', 'principal']::public.app_role[]);
$$;
-- Owner and bursar only (payroll).
create or replace function public.is_payroll(p_school uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(p_school, array['owner', 'bursar']::public.app_role[]);
$$;

alter table public.schools add column if not exists website jsonb not null default '{}'::jsonb;

-- ===========================================================================
-- 1. Student details for the profile page
-- ===========================================================================
alter table public.students add column if not exists state_of_origin text check (state_of_origin is null or char_length(state_of_origin) <= 40);
alter table public.students add column if not exists blood_group text check (blood_group is null or blood_group in ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'));
alter table public.students add column if not exists address text check (address is null or char_length(address) <= 300);
alter table public.students add column if not exists admitted_on date;

-- ===========================================================================
-- 2. Admissions: New -> Assessment -> Offer -> Enrolled (or Declined)
-- ===========================================================================
alter table public.admission_applications add column if not exists gender text check (gender is null or gender in ('male', 'female'));
alter table public.admission_applications add column if not exists previous_school text check (previous_school is null or char_length(previous_school) <= 120);
alter table public.admission_applications add column if not exists ref_no int;
alter table public.admission_applications add column if not exists admin_notes text check (admin_notes is null or char_length(admin_notes) <= 2000);
alter table public.admission_applications add column if not exists assessment_at timestamptz;
alter table public.admission_applications add column if not exists student_id uuid references public.students (id) on delete set null;
alter table public.admission_applications add column if not exists updated_at timestamptz not null default now();
alter table public.admission_applications drop constraint if exists admission_applications_status_check;
update public.admission_applications set status = 'assessment' where status = 'contacted';
update public.admission_applications set status = 'enrolled' where status = 'admitted';
alter table public.admission_applications add constraint admission_applications_status_check
  check (status in ('new', 'assessment', 'offer', 'enrolled', 'declined'));
alter table public.admission_applications drop constraint if exists admission_applications_len;
alter table public.admission_applications add constraint admission_applications_len check (
  char_length(child_name) <= 120 and char_length(parent_name) <= 120 and char_length(parent_phone) <= 30
  and (notes is null or char_length(notes) <= 1000));

-- A short reference number per school (APP-0091).
create or replace function public.application_ref()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtext(new.school_id::text));
  select coalesce(max(ref_no), 0) + 1 into new.ref_no from admission_applications where school_id = new.school_id;
  new.status := 'new';
  return new;
end $$;
drop trigger if exists admission_ref on public.admission_applications;
create trigger admission_ref before insert on public.admission_applications for each row execute function public.application_ref();

-- Visitors may only apply while admissions are open.
create or replace function public.admissions_open(p_school uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select (website->>'admissions_open')::boolean from schools where id = p_school and status = 'active'), true);
$$;
drop policy if exists applications_public_insert on public.admission_applications;
create policy applications_public_insert on public.admission_applications for insert with check (public.admissions_open(school_id));

-- ===========================================================================
-- 3. Parents: invites sent
-- ===========================================================================
create table if not exists public.parent_invites (
  school_id uuid not null references public.schools (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  sent_at timestamptz not null default now(),
  sent_by uuid references public.profiles (id) on delete set null,
  primary key (school_id, user_id)
);
alter table public.parent_invites enable row level security;
drop policy if exists parent_invites_admin on public.parent_invites;
create policy parent_invites_admin on public.parent_invites for all using (public.is_school_admin(school_id)) with check (public.is_school_admin(school_id));

-- Every parent with their children, contact details and whether they've signed in.
create or replace function public.parent_list(p_school uuid)
returns jsonb language sql stable security definer set search_path = public, auth as $$
  select case when not public.is_school_admin(p_school) then '[]'::jsonb else coalesce((
    select jsonb_agg(x order by x->>'name') from (
      select jsonb_build_object(
        'id', p.id,
        'name', coalesce(nullif(trim(p.full_name), ''), 'No name'),
        'email', p.email, 'phone', p.phone,
        'joined', u.last_sign_in_at is not null,
        'invited_at', pi.sent_at,
        'children', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.first_name, 'class', public.class_label(c.name, c.arm), 'relationship', g.relationship) order by s.first_name)
                              from guardians g join students s on s.id = g.student_id left join classes c on c.id = s.class_id
                              where g.user_id = p.id and g.school_id = p_school), '[]'::jsonb)) x
      from memberships m join profiles p on p.id = m.user_id
      left join auth.users u on u.id = p.id
      left join parent_invites pi on pi.school_id = p_school and pi.user_id = p.id
      where m.school_id = p_school and m.role = 'parent') q), '[]'::jsonb) end;
$$;

-- ===========================================================================
-- 4. Staff attendance (clocked by the owner or principal)
-- ===========================================================================
alter table public.schools add column if not exists staff_late_after time not null default '07:45';
create table if not exists public.staff_attendance (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  date date not null,
  clock_in timestamptz,
  clock_out timestamptz,
  status text not null default 'present' check (status in ('present', 'absent', 'leave', 'duty')),
  note text check (note is null or char_length(note) <= 200),
  marked_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (school_id, user_id, date)
);
alter table public.staff_attendance enable row level security;
drop policy if exists staff_attendance_read on public.staff_attendance;
create policy staff_attendance_read on public.staff_attendance for select using (user_id = auth.uid() or public.is_school_admin(school_id));
-- Written only by clock_staff().
drop trigger if exists audit_staff_attendance on public.staff_attendance;
create trigger audit_staff_attendance after insert or update or delete on public.staff_attendance for each row execute function public.audit_row();

create or replace function public.clock_staff(p_school uuid, p_user uuid, p_date date, p_action text, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_head(p_school) then raise exception 'not allowed' using errcode = '42501'; end if;
  if not exists (select 1 from memberships where school_id = p_school and user_id = p_user and role in ('owner', 'admin', 'principal', 'bursar', 'teacher')) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_date > public.lagos_today() then raise exception 'Future date' using errcode = 'P0001'; end if;
  if p_action = 'in' then
    insert into staff_attendance (school_id, user_id, date, clock_in, status, marked_by)
    values (p_school, p_user, p_date, now(), 'present', auth.uid())
    on conflict (school_id, user_id, date) do update set clock_in = coalesce(staff_attendance.clock_in, now()), status = 'present', marked_by = auth.uid(), updated_at = now();
  elsif p_action = 'out' then
    update staff_attendance set clock_out = now(), marked_by = auth.uid(), updated_at = now()
    where school_id = p_school and user_id = p_user and date = p_date and clock_in is not null and clock_out is null;
  elsif p_action in ('absent', 'leave', 'duty') then
    insert into staff_attendance (school_id, user_id, date, status, note, marked_by)
    values (p_school, p_user, p_date, p_action, nullif(trim(coalesce(p_note, '')), ''), auth.uid())
    on conflict (school_id, user_id, date) do update set status = excluded.status, note = coalesce(excluded.note, staff_attendance.note),
      clock_in = case when excluded.status = 'duty' then staff_attendance.clock_in else null end,
      clock_out = case when excluded.status = 'duty' then staff_attendance.clock_out else null end,
      marked_by = auth.uid(), updated_at = now();
  elsif p_action = 'clear' then
    if char_length(trim(coalesce(p_note, ''))) < 3 then raise exception 'Give a reason' using errcode = 'P0001'; end if;
    update staff_attendance set note = trim(p_note), marked_by = auth.uid() where school_id = p_school and user_id = p_user and date = p_date;
    delete from staff_attendance where school_id = p_school and user_id = p_user and date = p_date;
  else
    raise exception 'Bad action' using errcode = 'P0001';
  end if;
end $$;

-- One day's register, or a month's summary, for the whole staff.
create or replace function public.staff_attendance_day(p_school uuid, p_date date)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when not public.is_school_admin(p_school) then null else jsonb_build_object(
    'late_after', (select to_char(staff_late_after, 'HH24:MI') from schools where id = p_school),
    'staff', coalesce((select jsonb_agg(x order by x->>'name') from (
      select jsonb_build_object('id', p.id, 'name', coalesce(nullif(trim(p.full_name), ''), p.email, 'Staff member'),
        'role', (select string_agg(initcap(m2.role::text), ', ' order by m2.role) from memberships m2 where m2.school_id = p_school and m2.user_id = p.id and m2.role in ('owner','admin','principal','bursar','teacher')),
        'clock_in', a.clock_in, 'clock_out', a.clock_out, 'status', a.status, 'note', a.note) x
      from (select distinct user_id from memberships where school_id = p_school and role in ('owner','admin','principal','bursar','teacher')) m
      join profiles p on p.id = m.user_id
      left join staff_attendance a on a.school_id = p_school and a.user_id = p.id and a.date = p_date) q), '[]'::jsonb)) end;
$$;

create or replace function public.staff_attendance_month(p_school uuid, p_month date)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when not public.is_school_admin(p_school) then null else coalesce((select jsonb_agg(x order by x->>'name') from (
    select jsonb_build_object('id', p.id, 'name', coalesce(nullif(trim(p.full_name), ''), p.email, 'Staff member'),
      'present', count(a.*) filter (where a.status = 'present' and a.clock_in is not null),
      'late', count(a.*) filter (where a.status = 'present' and (a.clock_in at time zone 'Africa/Lagos')::time > sc.staff_late_after),
      'absent', count(a.*) filter (where a.status = 'absent'),
      'leave', count(a.*) filter (where a.status = 'leave'),
      'duty', count(a.*) filter (where a.status = 'duty'),
      'avg_in', to_char(to_timestamp(avg(extract(epoch from (a.clock_in at time zone 'Africa/Lagos')::time)) filter (where a.clock_in is not null)) at time zone 'UTC', 'HH24:MI')) x
    from (select distinct user_id from memberships where school_id = p_school and role in ('owner','admin','principal','bursar','teacher')) m
    join profiles p on p.id = m.user_id
    join schools sc on sc.id = p_school
    left join staff_attendance a on a.school_id = p_school and a.user_id = p.id
      and a.date >= date_trunc('month', p_month)::date and a.date < (date_trunc('month', p_month) + interval '1 month')::date
    group by p.id, p.full_name, p.email, sc.staff_late_after) q), '[]'::jsonb) end;
$$;

-- ===========================================================================
-- 5. Lesson notes: teacher writes -> submits -> principal approves or returns -> shared
-- ===========================================================================
create table if not exists public.lesson_notes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  class_subject_id uuid not null references public.class_subjects (id) on delete cascade,
  term_id uuid not null references public.terms (id) on delete cascade,
  week smallint not null check (week between 1 and 16),
  teacher_id uuid references public.profiles (id) on delete set null,
  topic text not null check (char_length(topic) between 2 and 160),
  lesson_date date,
  duration_min smallint not null default 40 check (duration_min between 10 and 240),
  objectives text check (objectives is null or char_length(objectives) <= 2000),
  materials text check (materials is null or char_length(materials) <= 1000),
  content text check (content is null or char_length(content) <= 8000),
  evaluation text check (evaluation is null or char_length(evaluation) <= 2000),
  status text not null default 'draft' check (status in ('draft', 'submitted', 'returned', 'approved', 'shared')),
  score smallint check (score is null or score between 1 and 10),
  review_comment text check (review_comment is null or char_length(review_comment) <= 1000),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  submitted_at timestamptz,
  shared_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (class_subject_id, term_id, week)
);
create index if not exists lesson_notes_school on public.lesson_notes (school_id, term_id, status);
alter table public.lesson_notes enable row level security;
drop policy if exists lesson_notes_read on public.lesson_notes;
create policy lesson_notes_read on public.lesson_notes for select using (
  teacher_id = auth.uid() or public.is_school_admin(school_id)
  or (status = 'shared' and exists (select 1 from class_subjects cs join students s on s.class_id = cs.class_id
       left join guardians g on g.student_id = s.id
       where cs.id = lesson_notes.class_subject_id and (s.user_id = auth.uid() or g.user_id = auth.uid()))));
-- Written through the functions below.

create or replace function public.save_lesson_note(p_note jsonb, p_submit boolean)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_cs record; v_id uuid; v_old record;
begin
  select * into v_cs from class_subjects where id = (p_note->>'class_subject_id')::uuid;
  if v_cs.id is null or not public.teaches_class_subject(v_cs.id) then raise exception 'not allowed' using errcode = '42501'; end if;
  if not exists (select 1 from terms where id = (p_note->>'term_id')::uuid and school_id = v_cs.school_id) then raise exception 'not allowed' using errcode = '42501'; end if;
  select * into v_old from lesson_notes where class_subject_id = v_cs.id and term_id = (p_note->>'term_id')::uuid and week = (p_note->>'week')::smallint;
  if v_old.status in ('approved', 'shared') then raise exception 'Already approved' using errcode = 'P0001'; end if;
  insert into lesson_notes (school_id, class_subject_id, term_id, week, teacher_id, topic, lesson_date, duration_min, objectives, materials, content, evaluation, status, submitted_at, updated_at)
  values (v_cs.school_id, v_cs.id, (p_note->>'term_id')::uuid, (p_note->>'week')::smallint, auth.uid(), trim(p_note->>'topic'),
          nullif(p_note->>'lesson_date', '')::date, coalesce(nullif(p_note->>'duration_min', '')::smallint, 40),
          nullif(trim(p_note->>'objectives'), ''), nullif(trim(p_note->>'materials'), ''), nullif(trim(p_note->>'content'), ''), nullif(trim(p_note->>'evaluation'), ''),
          case when p_submit then 'submitted' else coalesce(v_old.status, 'draft') end,
          case when p_submit then now() else v_old.submitted_at end, now())
  on conflict (class_subject_id, term_id, week) do update set
    teacher_id = excluded.teacher_id, topic = excluded.topic, lesson_date = excluded.lesson_date, duration_min = excluded.duration_min,
    objectives = excluded.objectives, materials = excluded.materials, content = excluded.content, evaluation = excluded.evaluation,
    status = excluded.status, submitted_at = excluded.submitted_at, updated_at = now()
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.review_lesson_note(p_id uuid, p_approve boolean, p_score smallint, p_comment text)
returns void language plpgsql security definer set search_path = public as $$
declare v_school uuid;
begin
  select school_id into v_school from lesson_notes where id = p_id and status in ('submitted', 'returned', 'approved');
  if v_school is null or not public.is_school_admin(v_school) then raise exception 'not allowed' using errcode = '42501'; end if;
  if not p_approve and char_length(trim(coalesce(p_comment, ''))) < 3 then raise exception 'Say what to change' using errcode = 'P0001'; end if;
  update lesson_notes set status = case when p_approve then 'approved' else 'returned' end, score = p_score,
    review_comment = nullif(trim(coalesce(p_comment, '')), ''), reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
  where id = p_id;
end $$;

create or replace function public.share_lesson_note(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update lesson_notes set status = 'shared', shared_at = now(), updated_at = now()
  where id = p_id and status = 'approved' and (teacher_id = auth.uid() or public.is_school_admin(school_id));
  if not found then raise exception 'not allowed' using errcode = '42501'; end if;
end $$;

-- Read-only links for visiting inspectors (approved notes only).
create table if not exists public.inspector_links (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  token text not null unique,
  name text not null check (char_length(name) between 2 and 120),
  organisation text check (organisation is null or char_length(organisation) <= 120),
  term_id uuid references public.terms (id) on delete cascade,
  session_id uuid references public.academic_sessions (id) on delete cascade,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists public.inspector_views (
  id bigint generated always as identity primary key,
  link_id uuid not null references public.inspector_links (id) on delete cascade,
  note_id uuid references public.lesson_notes (id) on delete set null,
  viewed_at timestamptz not null default now()
);
alter table public.inspector_links enable row level security;
alter table public.inspector_views enable row level security;
drop policy if exists inspector_links_admin on public.inspector_links;
create policy inspector_links_admin on public.inspector_links for all using (public.is_school_admin(school_id)) with check (public.is_school_admin(school_id));
drop policy if exists inspector_views_admin on public.inspector_views;
create policy inspector_views_admin on public.inspector_views for select using (exists (select 1 from inspector_links l where l.id = link_id and public.is_school_admin(l.school_id)));

-- ===========================================================================
-- 6. Payroll (owner and bursar only)
-- ===========================================================================
create table if not exists public.pay_structures (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 60),
  basic_kobo bigint not null check (basic_kobo >= 0 and basic_kobo <= 100000000000),
  allowances jsonb not null default '[]'::jsonb,
  deductions jsonb not null default '[]'::jsonb,
  unique (school_id, name)
);
create table if not exists public.staff_pay (
  school_id uuid not null references public.schools (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  structure_id uuid references public.pay_structures (id) on delete set null,
  job_title text check (job_title is null or char_length(job_title) <= 60),
  bank_name text check (bank_name is null or char_length(bank_name) <= 60),
  account_no text check (account_no is null or account_no ~ '^\d{10}$'),
  account_name text check (account_name is null or char_length(account_name) <= 120),
  pfa text check (pfa is null or char_length(pfa) <= 80),
  pension_pin text check (pension_pin is null or char_length(pension_pin) <= 30),
  monthly_rent_kobo bigint check (monthly_rent_kobo is null or monthly_rent_kobo >= 0),
  primary key (school_id, user_id)
);
create table if not exists public.payroll_settings (
  school_id uuid primary key references public.schools (id) on delete cascade,
  pension_on boolean not null default false,
  pension_staff_pct numeric(5,2) not null default 8 check (pension_staff_pct between 0 and 30),
  pension_employer_pct numeric(5,2) not null default 10 check (pension_employer_pct between 0 and 30),
  paye_on boolean not null default false,
  tax_state text check (tax_state is null or char_length(tax_state) <= 40),
  tin text check (tin is null or char_length(tin) <= 30)
);
create table if not exists public.payroll_runs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  status text not null default 'draft' check (status in ('draft', 'approved', 'paid')),
  approved_by uuid references public.profiles (id) on delete set null,
  approved_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (school_id, month)
);
create table if not exists public.payslips (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.payroll_runs (id) on delete cascade,
  school_id uuid not null references public.schools (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  job_title text,
  basic_kobo bigint not null,
  allowances jsonb not null default '[]'::jsonb,
  deductions jsonb not null default '[]'::jsonb,
  gross_kobo bigint not null,
  pension_kobo bigint not null default 0,
  employer_pension_kobo bigint not null default 0,
  paye_kobo bigint not null default 0,
  net_kobo bigint not null,
  bank_name text, account_no text, account_name text,
  emailed_at timestamptz,
  unique (run_id, user_id)
);
alter table public.pay_structures enable row level security;
alter table public.staff_pay enable row level security;
alter table public.payroll_settings enable row level security;
alter table public.payroll_runs enable row level security;
alter table public.payslips enable row level security;
do $$
declare t text;
begin
  foreach t in array array['pay_structures', 'staff_pay', 'payroll_settings', 'payroll_runs'] loop
    execute format('drop policy if exists %1$s_payroll on public.%1$s', t);
    execute format('create policy %1$s_payroll on public.%1$s for all using (public.is_payroll(school_id)) with check (public.is_payroll(school_id))', t);
  end loop;
end $$;
drop policy if exists payslips_payroll on public.payslips;
create policy payslips_payroll on public.payslips for all using (public.is_payroll(school_id)) with check (public.is_payroll(school_id));
-- Staff see their own payslips (and that month's run) once the month is paid.
create or replace function public.run_is_paid(p_run uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from payroll_runs where id = p_run and status = 'paid');
$$;
drop policy if exists payslips_own on public.payslips;
create policy payslips_own on public.payslips for select using (user_id = auth.uid() and public.run_is_paid(run_id));
drop policy if exists payroll_runs_own on public.payroll_runs;
create policy payroll_runs_own on public.payroll_runs for select using (
  status = 'paid' and exists (select 1 from payslips p where p.run_id = payroll_runs.id and p.user_id = auth.uid()));

-- Approved and paid runs can't be edited.
create or replace function public.lock_paid_payslips()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from payroll_runs r where r.id = coalesce(new.run_id, old.run_id) and r.status <> 'draft')
     and not (tg_op = 'UPDATE' and new.emailed_at is distinct from old.emailed_at
              and (new.net_kobo, new.gross_kobo, new.paye_kobo, new.pension_kobo) = (old.net_kobo, old.gross_kobo, old.paye_kobo, old.pension_kobo)) then
    raise exception 'This payroll is approved and can''t be changed' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists payslips_lock on public.payslips;
create trigger payslips_lock before insert or update or delete on public.payslips for each row execute function public.lock_paid_payslips();
drop trigger if exists audit_payroll_runs on public.payroll_runs;
create trigger audit_payroll_runs after insert or update or delete on public.payroll_runs for each row execute function public.audit_row();

-- ===========================================================================
-- 7. School website content
-- ===========================================================================
alter table public.website_posts add column if not exists image_alt text check (image_alt is null or char_length(image_alt) <= 200);
alter table public.website_posts add column if not exists album text check (album is null or char_length(album) <= 80);
alter table public.website_posts drop constraint if exists website_posts_len;
alter table public.website_posts add constraint website_posts_len check (char_length(title) between 1 and 160 and (body is null or char_length(body) <= 8000));
-- Gallery photos need a description for screen readers.
alter table public.website_posts drop constraint if exists website_posts_gallery_alt;
alter table public.website_posts add constraint website_posts_gallery_alt check (kind <> 'gallery' or (image_url is not null and char_length(coalesce(image_alt, '')) >= 3));

do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('school-site', 'school-site', true, 3145728, array['image/png', 'image/jpeg', 'image/webp'])
    on conflict (id) do update set public = true, file_size_limit = 3145728, allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp'];
  end if;
end $$;

-- ===========================================================================
-- 8. Grading scale (owner or admin)
-- ===========================================================================
create or replace function public.set_grading_scale(p_school uuid, p_rows jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare e jsonb; v_prev numeric := null; v_n int := 0;
begin
  if not public.is_owner_or_admin(p_school) then raise exception 'not allowed' using errcode = '42501'; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) not between 2 and 12 then raise exception 'Use 2 to 12 grades' using errcode = 'P0001'; end if;
  -- Rows come highest first; each grade runs from its minimum up to just below the one above.
  for e in select * from jsonb_array_elements(p_rows) loop
    if char_length(trim(coalesce(e->>'grade', ''))) not between 1 and 3 then raise exception 'Grade names are 1 to 3 letters' using errcode = 'P0001'; end if;
    if (e->>'min')::numeric < 0 or (e->>'min')::numeric > 100 then raise exception 'Bad minimum' using errcode = 'P0001'; end if;
    if v_prev is not null and (e->>'min')::numeric >= v_prev then raise exception 'Minimums must go down' using errcode = 'P0001'; end if;
    v_prev := (e->>'min')::numeric;
    v_n := v_n + 1;
  end loop;
  if v_prev <> 0 then raise exception 'The lowest grade must start at 0' using errcode = 'P0001'; end if;
  delete from grading_scales where school_id = p_school;
  insert into grading_scales (school_id, grade, min_score, max_score, remark)
  select p_school, trim(x.e->>'grade'), (x.e->>'min')::numeric,
         coalesce(lag((x.e->>'min')::numeric) over (order by x.i) - 0.01, 100),
         nullif(left(trim(coalesce(x.e->>'remark', '')), 40), '')
  from jsonb_array_elements(p_rows) with ordinality as x(e, i);
end $$;

-- ===========================================================================
-- 9. Where fee payments are paid out (owner only)
-- ===========================================================================
create table if not exists public.school_payouts (
  school_id uuid primary key references public.schools (id) on delete cascade,
  id uuid not null default gen_random_uuid(), -- for the activity log
  bank_name text not null check (char_length(bank_name) between 2 and 60),
  account_no text not null check (account_no ~ '^\d{10}$'),
  account_name text not null check (char_length(account_name) between 2 and 120),
  verified_at timestamptz,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.school_payouts add column if not exists id uuid not null default gen_random_uuid();
alter table public.school_payouts enable row level security;
drop policy if exists school_payouts_owner on public.school_payouts;
create policy school_payouts_owner on public.school_payouts for all
  using (public.has_role(school_id, array['owner']::public.app_role[])) with check (public.has_role(school_id, array['owner']::public.app_role[]));
drop trigger if exists audit_school_payouts on public.school_payouts;
create trigger audit_school_payouts after insert or update or delete on public.school_payouts for each row execute function public.audit_row();

-- ===========================================================================
-- Permissions (so 0008 doesn't need to be run again)
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
    if f.proname in ('verify_student_pin', 'announcement_users') then
      execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
    elsif f.proname not in ('handle_new_user', 'audit_row', 'check_score_limits', 'sync_period_times', 'sync_invoice_paid', 'application_ref', 'lock_paid_payslips') then
      execute format('grant execute on function %s to authenticated', f.sig);
    end if;
  end loop;
end $$;
grant execute on function public.admissions_open(uuid) to anon;
-- The website posts rules also check "is this a school admin?" (always no for visitors).
-- Without this, visitors couldn't read published news at all.
grant execute on function public.is_school_admin(uuid) to anon;
