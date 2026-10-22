-- Simpliskool foundation schema (Release 1)
-- Multi-tenant: every school-owned row carries school_id and is protected by row-level security.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('owner', 'admin', 'bursar', 'teacher', 'student', 'parent');
create type public.attendance_status as enum ('present', 'absent', 'late');
create type public.announcement_audience as enum ('school', 'staff', 'parents', 'class');
create type public.payment_status as enum ('pending', 'success', 'failed');

-- ---------------------------------------------------------------------------
-- Core tenancy
-- ---------------------------------------------------------------------------
create table public.school_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.school_groups (id) on delete set null,
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$'),
  logo_url text,
  primary_color text not null default '#173B70',
  secondary_color text not null default '#0F9D84',
  address text,
  phone text,
  email text,
  about text,
  plan text not null default 'pilot',
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text,
  phone text,
  created_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (school_id, user_id, role)
);
create index on public.memberships (user_id);

create table public.platform_admins (
  user_id uuid primary key references public.profiles (id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- Academic structure
-- ---------------------------------------------------------------------------
create table public.academic_sessions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null,                       -- e.g. 2026/2027
  starts_on date,
  ends_on date,
  is_current boolean not null default false,
  unique (school_id, name)
);

create table public.terms (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  session_id uuid not null references public.academic_sessions (id) on delete cascade,
  term_no smallint not null check (term_no between 1 and 3),
  starts_on date,
  ends_on date,
  is_current boolean not null default false,
  unique (session_id, term_no)
);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null,                       -- e.g. JSS 1, Primary 3
  arm text not null default '',             -- e.g. A, Gold
  level_order int not null default 0,
  class_teacher_id uuid references public.profiles (id) on delete set null,
  unique (school_id, name, arm)
);

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null,
  code text,
  unique (school_id, name)
);

create table public.class_subjects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  teacher_id uuid references public.profiles (id) on delete set null,
  unique (class_id, subject_id)
);

create table public.grading_scales (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  grade text not null,
  min_score numeric(5,2) not null,
  max_score numeric(5,2) not null,
  remark text,
  check (min_score <= max_score)
);

create table public.timetable_periods (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  class_subject_id uuid references public.class_subjects (id) on delete cascade,
  label text,                               -- for non-subject periods: Break, Assembly
  day_of_week smallint not null check (day_of_week between 1 and 7),
  starts_at time not null,
  ends_at time not null,
  check (starts_at < ends_at)
);

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------
create table public.students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  admission_no text not null,
  first_name text not null,
  last_name text not null,
  other_names text,
  gender text check (gender in ('male', 'female')),
  date_of_birth date,
  class_id uuid references public.classes (id) on delete set null,
  photo_url text,
  status text not null default 'active' check (status in ('active', 'graduated', 'withdrawn')),
  created_at timestamptz not null default now(),
  unique (school_id, admission_no)
);
create index on public.students (class_id);

create table public.guardians (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  relationship text,
  unique (student_id, user_id)
);
create index on public.guardians (user_id);

create table public.enrolments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  session_id uuid not null references public.academic_sessions (id) on delete cascade,
  unique (student_id, session_id)
);

-- ---------------------------------------------------------------------------
-- Attendance and results
-- ---------------------------------------------------------------------------
create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  date date not null,
  status public.attendance_status not null,
  recorded_by uuid references public.profiles (id) on delete set null,
  client_id uuid unique,                    -- idempotency key from offline sync
  synced_at timestamptz not null default now(),
  unique (student_id, date)
);

create table public.scores (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  class_subject_id uuid not null references public.class_subjects (id) on delete cascade,
  term_id uuid not null references public.terms (id) on delete cascade,
  ca1 numeric(5,2) check (ca1 >= 0),
  ca2 numeric(5,2) check (ca2 >= 0),
  exam numeric(5,2) check (exam >= 0),
  total numeric(6,2) generated always as (coalesce(ca1, 0) + coalesce(ca2, 0) + coalesce(exam, 0)) stored,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (student_id, class_subject_id, term_id)
);

create table public.result_comments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  term_id uuid not null references public.terms (id) on delete cascade,
  class_teacher_comment text,
  principal_comment text,
  approved_at timestamptz,
  approved_by uuid references public.profiles (id) on delete set null,
  unique (student_id, term_id)
);

create table public.report_cards (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  term_id uuid not null references public.terms (id) on delete cascade,
  pdf_path text,
  released_at timestamptz,
  unique (student_id, term_id)
);

-- ---------------------------------------------------------------------------
-- Fees (amounts stored in kobo)
-- ---------------------------------------------------------------------------
create table public.fee_items (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  term_id uuid not null references public.terms (id) on delete cascade,
  class_id uuid references public.classes (id) on delete cascade,   -- null = all classes
  name text not null,
  amount_kobo bigint not null check (amount_kobo >= 0)
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  term_id uuid not null references public.terms (id) on delete cascade,
  total_kobo bigint not null default 0,
  paid_kobo bigint not null default 0,
  balance_kobo bigint generated always as (total_kobo - paid_kobo) stored,
  created_at timestamptz not null default now(),
  unique (student_id, term_id)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  amount_kobo bigint not null check (amount_kobo > 0),
  method text not null default 'paystack',
  paystack_reference text unique,
  status public.payment_status not null default 'pending',
  receipt_no text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Communication and website
-- ---------------------------------------------------------------------------
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  title text not null,
  body text not null,
  audience public.announcement_audience not null default 'school',
  class_id uuid references public.classes (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.website_posts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  kind text not null default 'news' check (kind in ('news', 'gallery')),
  title text not null,
  body text,
  image_url text,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.admission_applications (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  child_name text not null,
  date_of_birth date,
  class_applied text,
  parent_name text not null,
  parent_phone text not null,
  parent_email text,
  notes text,
  status text not null default 'new' check (status in ('new', 'contacted', 'admitted', 'declined')),
  created_at timestamptz not null default now()
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  school_id uuid references public.schools (id) on delete cascade,
  actor_id uuid,
  action text not null,
  table_name text not null,
  record_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Access helpers (security definer so policies can call them without recursion)
-- ---------------------------------------------------------------------------
create or replace function public.has_role(p_school uuid, p_roles public.app_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships m
    where m.school_id = p_school and m.user_id = auth.uid() and m.role = any (p_roles)
  ) or exists (select 1 from platform_admins pa where pa.user_id = auth.uid());
$$;

create or replace function public.is_member(p_school uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(p_school, enum_range(null::public.app_role));
$$;

create or replace function public.is_staff(p_school uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(p_school, array['owner','admin','bursar','teacher']::public.app_role[]);
$$;

create or replace function public.is_school_admin(p_school uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(p_school, array['owner','admin']::public.app_role[]);
$$;

create or replace function public.is_finance(p_school uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(p_school, array['owner','admin','bursar']::public.app_role[]);
$$;

create or replace function public.can_view_student(p_student uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from students s where s.id = p_student and public.is_staff(s.school_id))
      or exists (select 1 from guardians g where g.student_id = p_student and g.user_id = auth.uid())
      or exists (select 1 from students s where s.id = p_student and s.user_id = auth.uid());
$$;

create or replace function public.teaches_class(p_class uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from classes c where c.id = p_class and c.class_teacher_id = auth.uid())
      or exists (select 1 from class_subjects cs where cs.class_id = p_class and cs.teacher_id = auth.uid());
$$;

create or replace function public.teaches_class_subject(p_class_subject uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from class_subjects cs where cs.id = p_class_subject and cs.teacher_id = auth.uid());
$$;

create or replace function public.result_released(p_student uuid, p_term uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from report_cards r
    where r.student_id = p_student and r.term_id = p_term and r.released_at is not null
  );
$$;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
alter table public.school_groups enable row level security;
alter table public.schools enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.platform_admins enable row level security;
alter table public.academic_sessions enable row level security;
alter table public.terms enable row level security;
alter table public.classes enable row level security;
alter table public.subjects enable row level security;
alter table public.class_subjects enable row level security;
alter table public.grading_scales enable row level security;
alter table public.timetable_periods enable row level security;
alter table public.students enable row level security;
alter table public.guardians enable row level security;
alter table public.enrolments enable row level security;
alter table public.attendance enable row level security;
alter table public.scores enable row level security;
alter table public.result_comments enable row level security;
alter table public.report_cards enable row level security;
alter table public.fee_items enable row level security;
alter table public.invoices enable row level security;
alter table public.payments enable row level security;
alter table public.announcements enable row level security;
alter table public.website_posts enable row level security;
alter table public.admission_applications enable row level security;
alter table public.audit_log enable row level security;

-- Schools: public can read active schools (needed for school websites); admins update.
create policy schools_public_read on public.schools for select using (status = 'active' or public.is_member(id));
create policy schools_admin_update on public.schools for update using (public.is_school_admin(id)) with check (public.is_school_admin(id));

-- Profiles: you see yourself and people in your schools; you edit only yourself.
create or replace function public.staff_can_see_user(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships mine join memberships theirs on theirs.school_id = mine.school_id
    where mine.user_id = auth.uid() and theirs.user_id = p_user
      and mine.role in ('owner','admin','bursar','teacher')
  );
$$;

create policy profiles_read on public.profiles for select using (id = auth.uid() or public.staff_can_see_user(id));
create policy profiles_update_self on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- Memberships: see your own; school admins manage the school's.
create policy memberships_read on public.memberships for select using (user_id = auth.uid() or public.is_school_admin(school_id));
create policy memberships_admin_write on public.memberships for all using (public.is_school_admin(school_id)) with check (public.is_school_admin(school_id));

-- School structure: any member reads; admins write.
do $$
declare t text;
begin
  foreach t in array array['academic_sessions','terms','classes','subjects','class_subjects','grading_scales','timetable_periods','enrolments']
  loop
    execute format('create policy %1$s_member_read on public.%1$s for select using (public.is_member(school_id))', t);
    execute format('create policy %1$s_admin_write on public.%1$s for all using (public.is_school_admin(school_id)) with check (public.is_school_admin(school_id))', t);
  end loop;
end $$;

-- Students and guardians
create policy students_read on public.students for select using (public.can_view_student(id));
create policy students_admin_write on public.students for all using (public.is_school_admin(school_id)) with check (public.is_school_admin(school_id));
create policy guardians_read on public.guardians for select using (public.is_staff(school_id) or user_id = auth.uid());
create policy guardians_admin_write on public.guardians for all using (public.is_school_admin(school_id)) with check (public.is_school_admin(school_id));

-- Attendance: staff and the student's family read; class teachers and admins write.
create policy attendance_read on public.attendance for select using (public.can_view_student(student_id));
create policy attendance_write on public.attendance for insert with check (
  public.is_school_admin(school_id) or (public.is_staff(school_id) and public.teaches_class(class_id))
);
create policy attendance_update on public.attendance for update using (
  public.is_school_admin(school_id) or (public.is_staff(school_id) and public.teaches_class(class_id))
);

-- Scores: staff read; families read once the report card is released; subject teachers and admins write.
create policy scores_read on public.scores for select using (
  public.is_staff(school_id) or (public.can_view_student(student_id) and public.result_released(student_id, term_id))
);
create policy scores_insert on public.scores for insert with check (
  public.is_school_admin(school_id) or public.teaches_class_subject(class_subject_id)
);
create policy scores_update on public.scores for update using (
  public.is_school_admin(school_id) or public.teaches_class_subject(class_subject_id)
);

create policy comments_read on public.result_comments for select using (
  public.is_staff(school_id) or (public.can_view_student(student_id) and public.result_released(student_id, term_id))
);
create policy comments_write on public.result_comments for all using (public.is_staff(school_id)) with check (public.is_staff(school_id));

create policy report_cards_read on public.report_cards for select using (
  public.is_staff(school_id) or (released_at is not null and public.can_view_student(student_id))
);
create policy report_cards_admin_write on public.report_cards for all using (public.is_school_admin(school_id)) with check (public.is_school_admin(school_id));

-- Fees: finance staff manage; families read their own. Payments are written only by the server (service role).
create policy fee_items_read on public.fee_items for select using (public.is_member(school_id));
create policy fee_items_write on public.fee_items for all using (public.is_finance(school_id)) with check (public.is_finance(school_id));
create policy invoices_read on public.invoices for select using (public.is_finance(school_id) or public.can_view_student(student_id));
create policy invoices_write on public.invoices for all using (public.is_finance(school_id)) with check (public.is_finance(school_id));
create policy payments_read on public.payments for select using (
  public.is_finance(school_id) or exists (
    select 1 from invoices i where i.id = payments.invoice_id and public.can_view_student(i.student_id)
  )
);

-- Communication
create policy announcements_read on public.announcements for select using (public.is_member(school_id));
create policy announcements_write on public.announcements for all using (public.is_staff(school_id)) with check (public.is_staff(school_id));

-- Website: public reads published posts; admins manage. Anyone may submit an admission application.
create policy website_posts_public_read on public.website_posts for select using (published_at is not null or public.is_member(school_id));
create policy website_posts_admin_write on public.website_posts for all using (public.is_school_admin(school_id)) with check (public.is_school_admin(school_id));
create policy applications_public_insert on public.admission_applications for insert with check (true);
create policy applications_admin_read on public.admission_applications for select using (public.is_school_admin(school_id));
create policy applications_admin_update on public.admission_applications for update using (public.is_school_admin(school_id));

create policy audit_admin_read on public.audit_log for select using (public.is_school_admin(school_id));

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
-- Create a profile for every new auth user.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, phone, full_name)
  values (new.id, new.email, new.phone, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- Audit changes to scores and payments.
create or replace function public.audit_row()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into audit_log (school_id, actor_id, action, table_name, record_id, details)
  values (
    coalesce(new.school_id, old.school_id), auth.uid(), tg_op, tg_table_name,
    coalesce(new.id, old.id),
    jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new))
  );
  return coalesce(new, old);
end $$;

create trigger audit_scores after insert or update or delete on public.scores
for each row execute function public.audit_row();
create trigger audit_payments after insert or update or delete on public.payments
for each row execute function public.audit_row();

-- ---------------------------------------------------------------------------
-- School creation (called by the signed-in owner during onboarding)
-- ---------------------------------------------------------------------------
create or replace function public.create_school(p_name text, p_slug text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_school uuid;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to create a school';
  end if;

  insert into schools (name, slug) values (trim(p_name), lower(trim(p_slug))) returning id into v_school;
  insert into memberships (school_id, user_id, role) values (v_school, auth.uid(), 'owner');

  -- Default Nigerian grading scale; schools can edit it in settings.
  insert into grading_scales (school_id, grade, min_score, max_score, remark) values
    (v_school, 'A', 70, 100, 'Excellent'),
    (v_school, 'B', 60, 69.99, 'Very good'),
    (v_school, 'C', 50, 59.99, 'Good'),
    (v_school, 'D', 45, 49.99, 'Fair'),
    (v_school, 'E', 40, 44.99, 'Pass'),
    (v_school, 'F', 0, 39.99, 'Fail');

  return v_school;
end $$;

grant execute on function public.create_school(text, text) to authenticated;
