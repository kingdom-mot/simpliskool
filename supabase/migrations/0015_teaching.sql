-- Teaching tools: homework and marking, question bank, CBT tests, AI assistant usage,
-- and the numbers behind "My classes". Safe to run more than once. Run after 0014.

-- ===========================================================================
-- 0. Helpers
-- ===========================================================================

-- Is the signed-in person a student in this class, or a parent of one?
create or replace function public.learner_in_class(p_class uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from students s left join guardians g on g.student_id = s.id
    where s.class_id = p_class and s.status = 'active' and (s.user_id = auth.uid() or g.user_id = auth.uid()));
$$;

-- May the signed-in person act for this student (the student, or a parent)?
create or replace function public.acts_for_student(p_student uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from students s where s.id = p_student and s.user_id = auth.uid())
      or exists (select 1 from guardians g where g.student_id = p_student and g.user_id = auth.uid());
$$;

-- Does the teacher teach this subject in every one of these classes?
create or replace function public.teaches_subject_in(p_subject uuid, p_classes uuid[])
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(array_length(p_classes, 1), 0) > 0 and not exists (
    select 1 from unnest(p_classes) c(id)
    where not exists (select 1 from class_subjects cs where cs.class_id = c.id and cs.subject_id = p_subject and cs.teacher_id = auth.uid()));
$$;

-- Puts one part of the score (CA 1, CA 2 or CA 3) for many students, leaving the
-- other parts alone. Used when homework or a CBT test counts toward CA.
create or replace function public.set_ca_part(p_class_subject uuid, p_term uuid, p_part text, p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_cs record; v_parts jsonb; v_max numeric; r jsonb; v_student uuid; v_score numeric;
  v_saved int := 0; v_locked int := 0; v_changed int := 0; v_n int;
begin
  select * into v_cs from class_subjects where id = p_class_subject;
  if v_cs.id is null or not (public.is_school_admin(v_cs.school_id) or public.teaches_class_subject(p_class_subject)) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if not exists (select 1 from terms where id = p_term and school_id = v_cs.school_id) then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_part not in ('ca1', 'ca2', 'ca3') then raise exception 'Choose CA 1, CA 2 or CA 3' using errcode = 'P0001'; end if;
  v_parts := public.assessment_parts(v_cs.school_id);
  v_max := public.part_max(v_parts, p_part);
  if v_max is null then raise exception 'Your school doesn''t use that part' using errcode = 'P0001'; end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    v_student := (r->>'student_id')::uuid;
    v_score := round(least(greatest((r->>'score')::numeric, 0), v_max), 1);
    if not exists (select 1 from students s where s.id = v_student and s.class_id = v_cs.class_id and s.status = 'active') then continue; end if;
    if public.result_released(v_student, p_term) then v_locked := v_locked + 1; continue; end if;
    if p_part = 'ca1' then
      insert into scores (school_id, student_id, class_subject_id, term_id, ca1, updated_by, updated_at) values (v_cs.school_id, v_student, p_class_subject, p_term, v_score, auth.uid(), now())
      on conflict (student_id, class_subject_id, term_id) do update set ca1 = excluded.ca1, updated_by = excluded.updated_by, updated_at = now() where scores.ca1 is distinct from excluded.ca1;
    elsif p_part = 'ca2' then
      insert into scores (school_id, student_id, class_subject_id, term_id, ca2, updated_by, updated_at) values (v_cs.school_id, v_student, p_class_subject, p_term, v_score, auth.uid(), now())
      on conflict (student_id, class_subject_id, term_id) do update set ca2 = excluded.ca2, updated_by = excluded.updated_by, updated_at = now() where scores.ca2 is distinct from excluded.ca2;
    else
      insert into scores (school_id, student_id, class_subject_id, term_id, ca3, updated_by, updated_at) values (v_cs.school_id, v_student, p_class_subject, p_term, v_score, auth.uid(), now())
      on conflict (student_id, class_subject_id, term_id) do update set ca3 = excluded.ca3, updated_by = excluded.updated_by, updated_at = now() where scores.ca3 is distinct from excluded.ca3;
    end if;
    get diagnostics v_n = row_count;
    v_changed := v_changed + v_n;
    v_saved := v_saved + 1;
  end loop;
  if v_changed > 0 then delete from result_approvals where class_id = v_cs.class_id and term_id = p_term; end if;
  return jsonb_build_object('saved', v_saved, 'locked', v_locked, 'max', v_max);
end $$;

-- Private storage for worksheets and students' work (files are served through the app).
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit)
    values ('learning', 'learning', false, 5242880)
    on conflict (id) do update set public = false, file_size_limit = 5242880;
  end if;
end $$;

-- ===========================================================================
-- 1. Homework and assignments
-- ===========================================================================
create table if not exists public.homework (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  class_subject_id uuid not null references public.class_subjects (id) on delete cascade,
  term_id uuid not null references public.terms (id) on delete cascade,
  teacher_id uuid references public.profiles (id) on delete set null,
  kind text not null default 'homework' check (kind in ('homework', 'assignment')),
  title text not null check (char_length(trim(title)) between 3 and 160),
  instructions text check (instructions is null or char_length(instructions) <= 4000),
  max_marks numeric(5,1) not null default 10 check (max_marks > 0 and max_marks <= 100),
  due_at timestamptz not null,
  submit_modes text[] not null default array['photo', 'file', 'text'],
  allow_late boolean not null default true,
  attachments jsonb not null default '[]'::jsonb,
  ca_part text check (ca_part in ('ca1', 'ca2', 'ca3')),
  ca_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (submit_modes <@ array['photo', 'file', 'text', 'paper'] and cardinality(submit_modes) >= 1),
  check (jsonb_typeof(attachments) = 'array')
);
create index if not exists homework_cs on public.homework (class_subject_id, due_at desc);
create index if not exists homework_school on public.homework (school_id, due_at desc);
alter table public.homework enable row level security;
drop policy if exists homework_read on public.homework;
create policy homework_read on public.homework for select using (
  public.is_school_admin(school_id) or public.teaches_class_subject(class_subject_id)
  or exists (select 1 from class_subjects cs where cs.id = homework.class_subject_id and public.learner_in_class(cs.class_id)));
drop policy if exists homework_write on public.homework;
create policy homework_write on public.homework for all
  using (public.is_school_admin(school_id) or public.teaches_class_subject(class_subject_id))
  with check (public.is_school_admin(school_id) or public.teaches_class_subject(class_subject_id));

create table if not exists public.homework_submissions (
  id uuid primary key default gen_random_uuid(),
  homework_id uuid not null references public.homework (id) on delete cascade,
  school_id uuid not null references public.schools (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  answer text check (answer is null or char_length(answer) <= 8000),
  files jsonb not null default '[]'::jsonb check (jsonb_typeof(files) = 'array'),
  note text check (note is null or char_length(note) <= 500),
  status text not null default 'submitted' check (status in ('draft', 'submitted', 'marked')),
  submitted_at timestamptz,
  submitted_by uuid references public.profiles (id) on delete set null,
  late boolean not null default false,
  score numeric(5,1),
  feedback text check (feedback is null or char_length(feedback) <= 1000),
  marked_at timestamptz,
  marked_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (homework_id, student_id)
);
create index if not exists homework_submissions_student on public.homework_submissions (student_id);
alter table public.homework_submissions enable row level security;
drop policy if exists homework_submissions_read on public.homework_submissions;
create policy homework_submissions_read on public.homework_submissions for select using (
  public.acts_for_student(student_id) or public.is_school_admin(school_id)
  or exists (select 1 from homework h where h.id = homework_submissions.homework_id and public.teaches_class_subject(h.class_subject_id)));
-- Written only through the functions below.

-- Hand in (or save) work. p_files: [{path, name, type, size}] already uploaded by the server.
create or replace function public.submit_homework(p_homework uuid, p_student uuid, p_answer text, p_files jsonb, p_note text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_hw record; v_cs record; v_old record; v_late boolean; f jsonb;
begin
  select * into v_hw from homework where id = p_homework;
  if v_hw.id is null or not public.acts_for_student(p_student) then raise exception 'not allowed' using errcode = '42501'; end if;
  select * into v_cs from class_subjects where id = v_hw.class_subject_id;
  if not exists (select 1 from students where id = p_student and class_id = v_cs.class_id and status = 'active') then raise exception 'not allowed' using errcode = '42501'; end if;
  if v_hw.submit_modes = array['paper'] then raise exception 'Hand this one in on paper' using errcode = 'P0001'; end if;
  select * into v_old from homework_submissions where homework_id = p_homework and student_id = p_student;
  if v_old.status = 'marked' then raise exception 'Already marked' using errcode = 'P0001'; end if;
  v_late := now() > v_hw.due_at;
  if v_late and not v_hw.allow_late then raise exception 'Too late' using errcode = 'P0001'; end if;
  if jsonb_typeof(coalesce(p_files, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_files, '[]'::jsonb)) > 5 then raise exception 'Too many files' using errcode = 'P0001'; end if;
  for f in select * from jsonb_array_elements(coalesce(p_files, '[]'::jsonb)) loop
    if (f->>'path') not like v_hw.school_id::text || '/hw/' || p_homework::text || '/' || p_student::text || '/%' then raise exception 'not allowed' using errcode = '42501'; end if;
  end loop;
  if nullif(trim(coalesce(p_answer, '')), '') is null and jsonb_array_length(coalesce(p_files, '[]'::jsonb)) = 0 then
    raise exception 'Add your work first' using errcode = 'P0001';
  end if;
  insert into homework_submissions (homework_id, school_id, student_id, answer, files, note, status, submitted_at, submitted_by, late, updated_at)
  values (p_homework, v_hw.school_id, p_student, nullif(trim(coalesce(p_answer, '')), ''), coalesce(p_files, '[]'::jsonb), nullif(trim(coalesce(p_note, '')), ''), 'submitted', now(), auth.uid(), v_late, now())
  on conflict (homework_id, student_id) do update set answer = excluded.answer, files = excluded.files, note = excluded.note,
    status = 'submitted', submitted_at = now(), submitted_by = auth.uid(), late = excluded.late, updated_at = now();
  return jsonb_build_object('late', v_late);
end $$;

-- "Take back to edit" (before it's marked).
create or replace function public.unsubmit_homework(p_homework uuid, p_student uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_files jsonb;
begin
  if not public.acts_for_student(p_student) then raise exception 'not allowed' using errcode = '42501'; end if;
  update homework_submissions set status = 'draft', submitted_at = null, updated_at = now()
  where homework_id = p_homework and student_id = p_student and status = 'submitted'
  returning files into v_files;
  if not found then raise exception 'Already marked' using errcode = 'P0001'; end if;
  return coalesce(v_files, '[]'::jsonb);
end $$;

-- Mark work (also for work handed in on paper: a row is made if there isn't one).
create or replace function public.mark_homework(p_homework uuid, p_student uuid, p_score numeric, p_feedback text)
returns void language plpgsql security definer set search_path = public as $$
declare v_hw record;
begin
  select * into v_hw from homework where id = p_homework;
  if v_hw.id is null or not (public.teaches_class_subject(v_hw.class_subject_id) or public.is_school_admin(v_hw.school_id)) then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_score is null or p_score < 0 or p_score > v_hw.max_marks then raise exception 'Score out of range' using errcode = 'P0001'; end if;
  if not exists (select 1 from students s join class_subjects cs on cs.class_id = s.class_id where s.id = p_student and cs.id = v_hw.class_subject_id) then raise exception 'not allowed' using errcode = '42501'; end if;
  insert into homework_submissions (homework_id, school_id, student_id, status, score, feedback, marked_at, marked_by, updated_at)
  values (p_homework, v_hw.school_id, p_student, 'marked', round(p_score, 1), nullif(left(trim(coalesce(p_feedback, '')), 1000), ''), now(), auth.uid(), now())
  on conflict (homework_id, student_id) do update set status = 'marked', score = excluded.score, feedback = excluded.feedback, marked_at = now(), marked_by = auth.uid(), updated_at = now();
end $$;

-- ===========================================================================
-- 2. Question bank
-- ===========================================================================
create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  level text not null check (char_length(level) between 1 and 40),        -- class name without arm, e.g. JSS 2
  topic text not null default 'General' check (char_length(trim(topic)) between 1 and 80),
  difficulty text not null default 'medium' check (difficulty in ('easy', 'medium', 'hard')),
  body text not null check (char_length(trim(body)) between 3 and 1000),
  options jsonb not null,
  answer smallint not null check (answer >= 0),
  explanation text check (explanation is null or char_length(explanation) <= 600),
  source text not null default 'manual' check (source in ('manual', 'ai', 'import')),
  checked boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 5 and answer < jsonb_array_length(options))
);
create index if not exists questions_bank on public.questions (school_id, subject_id, level, topic);
alter table public.questions enable row level security;
drop policy if exists questions_read on public.questions;
create policy questions_read on public.questions for select using (public.has_role(school_id, array['owner', 'admin', 'principal', 'teacher']::public.app_role[]));
drop policy if exists questions_insert on public.questions;
create policy questions_insert on public.questions for insert with check (created_by = auth.uid() and public.has_role(school_id, array['owner', 'admin', 'principal', 'teacher']::public.app_role[]));
drop policy if exists questions_change on public.questions;
create policy questions_change on public.questions for update using (created_by = auth.uid() or public.is_school_admin(school_id)) with check (created_by = auth.uid() or public.is_school_admin(school_id));
drop policy if exists questions_delete on public.questions;
create policy questions_delete on public.questions for delete using (created_by = auth.uid() or public.is_school_admin(school_id));

-- ===========================================================================
-- 3. CBT tests
-- ===========================================================================
create table if not exists public.cbt_tests (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  term_id uuid not null references public.terms (id) on delete cascade,
  level text not null,
  title text not null check (char_length(trim(title)) between 3 and 120),
  teacher_id uuid references public.profiles (id) on delete set null,
  class_ids uuid[] not null check (cardinality(class_ids) between 1 and 20),
  practice boolean not null default false,
  duration_min smallint not null check (duration_min between 5 and 240),
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  question_ids uuid[] not null check (cardinality(question_ids) between 1 and 100),
  marks_each numeric(4,1) not null default 1 check (marks_each > 0),
  shuffle boolean not null default true,
  show_score boolean not null default true,
  ca_part text check (ca_part in ('ca1', 'ca2', 'ca3')),
  ca_sent_at timestamptz,
  created_at timestamptz not null default now(),
  check (closes_at > opens_at)
);
create index if not exists cbt_tests_school on public.cbt_tests (school_id, opens_at desc);
alter table public.cbt_tests enable row level security;
drop policy if exists cbt_tests_read on public.cbt_tests;
create policy cbt_tests_read on public.cbt_tests for select using (public.has_role(school_id, array['owner', 'admin', 'principal', 'teacher']::public.app_role[]));
drop policy if exists cbt_tests_write on public.cbt_tests;
create policy cbt_tests_write on public.cbt_tests for all
  using (public.is_school_admin(school_id) or teacher_id = auth.uid())
  with check (public.is_school_admin(school_id) or (teacher_id = auth.uid() and public.teaches_subject_in(subject_id, class_ids)));
-- Students never read tests or questions directly: they use cbt_* functions, which hide the answers.

create table if not exists public.cbt_attempts (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.cbt_tests (id) on delete cascade,
  school_id uuid not null references public.schools (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  started_at timestamptz not null default now(),
  deadline_at timestamptz not null,
  submitted_at timestamptz,
  q_order uuid[] not null,
  opt_orders jsonb not null default '{}'::jsonb,
  answers jsonb not null default '{}'::jsonb,
  flags jsonb not null default '[]'::jsonb,
  score numeric(6,1),
  total numeric(6,1),
  unique (test_id, student_id)
);
alter table public.cbt_attempts enable row level security;
drop policy if exists cbt_attempts_read on public.cbt_attempts;
create policy cbt_attempts_read on public.cbt_attempts for select using (
  public.has_role(school_id, array['owner', 'admin', 'principal', 'teacher']::public.app_role[]) or public.acts_for_student(student_id));

-- Extra time or a later chance for one student (set by the teacher).
create table if not exists public.cbt_allowances (
  test_id uuid not null references public.cbt_tests (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  school_id uuid not null references public.schools (id) on delete cascade,
  extra_min smallint not null default 0 check (extra_min between 0 and 240),
  until timestamptz,
  primary key (test_id, student_id)
);
alter table public.cbt_allowances enable row level security;
drop policy if exists cbt_allowances_staff on public.cbt_allowances;
create policy cbt_allowances_staff on public.cbt_allowances for all
  using (exists (select 1 from cbt_tests t where t.id = cbt_allowances.test_id and (t.teacher_id = auth.uid() or public.is_school_admin(t.school_id))))
  with check (exists (select 1 from cbt_tests t where t.id = cbt_allowances.test_id and (t.teacher_id = auth.uid() or public.is_school_admin(t.school_id))));

-- Marks one attempt (server side; answers are compared with the bank).
create or replace function public.cbt_mark(p_attempt uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_a record; v_t record;
begin
  select * into v_a from cbt_attempts where id = p_attempt for update;
  select * into v_t from cbt_tests where id = v_a.test_id;
  update cbt_attempts set
    score = (select count(*) from questions q where q.id = any(v_a.q_order) and (v_a.answers->>(q.id::text))::int = q.answer) * v_t.marks_each,
    total = cardinality(v_a.q_order) * v_t.marks_each,
    submitted_at = coalesce(submitted_at, least(now(), v_a.deadline_at))
  where id = p_attempt;
end $$;

-- Hands in attempts whose time ran out (30 seconds grace for a slow network).
create or replace function public.cbt_finalize_due(p_test uuid)
returns int language plpgsql security definer set search_path = public as $$
declare a record; v_n int := 0;
begin
  for a in select id from cbt_attempts where (p_test is null or test_id = p_test) and submitted_at is null and deadline_at < now() - interval '30 seconds' loop
    perform public.cbt_mark(a.id);
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

-- The signed-in student's own student record (null for anyone else).
create or replace function public.my_student()
returns uuid language sql stable security definer set search_path = public as $$
  select id from students where user_id = auth.uid() and status = 'active' limit 1;
$$;

-- Tests for the signed-in student: open, coming up and finished.
create or replace function public.cbt_student_tests()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_st record; v_out jsonb;
begin
  select * into v_st from students where user_id = auth.uid() and status = 'active' limit 1;
  if v_st.id is null then return '[]'::jsonb; end if;
  perform public.cbt_finalize_due(t.id) from cbt_tests t where v_st.class_id = any(t.class_ids);
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', t.id, 'title', t.title, 'subject', s.name, 'practice', t.practice, 'questions', cardinality(t.question_ids),
      'duration', t.duration_min + coalesce(al.extra_min, 0), 'opens_at', t.opens_at, 'closes_at', greatest(t.closes_at, coalesce(al.until, t.closes_at)),
      'ca_part', t.ca_part, 'show_score', t.show_score,
      'started', a.started_at is not null, 'submitted_at', a.submitted_at, 'deadline_at', a.deadline_at,
      'score', case when a.submitted_at is not null and (t.show_score or t.practice) then a.score end,
      'total', case when a.submitted_at is not null and (t.show_score or t.practice) then a.total end)
      order by t.opens_at desc), '[]'::jsonb)
  into v_out
  from cbt_tests t join subjects s on s.id = t.subject_id
  left join cbt_attempts a on a.test_id = t.id and a.student_id = v_st.id
  left join cbt_allowances al on al.test_id = t.id and al.student_id = v_st.id
  where v_st.class_id = any(t.class_ids) and t.opens_at > now() - interval '120 days';
  return v_out;
end $$;

-- What the student sees while taking the test (never the answers).
create or replace function public.cbt_paper(p_attempt uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'attempt', a.id, 'title', t.title, 'subject', s.name, 'practice', t.practice, 'deadline_at', a.deadline_at, 'now', now(),
    'submitted_at', a.submitted_at, 'answers', a.answers, 'flags', a.flags,
    'questions', (select jsonb_agg(jsonb_build_object(
        'id', q.id, 'body', q.body,
        'options', (select jsonb_agg(jsonb_build_object('i', (o.v)::int, 't', q.options->((o.v)::int)) order by o.n)
                    from jsonb_array_elements_text(coalesce(a.opt_orders->(q.id::text), (select jsonb_agg(g) from generate_series(0, jsonb_array_length(q.options) - 1) g))) with ordinality o(v, n)))
        order by x.n)
      from unnest(a.q_order) with ordinality x(qid, n) join questions q on q.id = x.qid))
  from cbt_attempts a join cbt_tests t on t.id = a.test_id join subjects s on s.id = t.subject_id
  where a.id = p_attempt and a.student_id = public.my_student();
$$;

-- Start (or carry on with) a test.
create or replace function public.cbt_start(p_test uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_st uuid := public.my_student(); v_t record; v_a record; v_al record; v_close timestamptz; v_order uuid[]; v_opts jsonb; v_id uuid;
begin
  select * into v_t from cbt_tests where id = p_test;
  if v_st is null or v_t.id is null or not exists (select 1 from students where id = v_st and class_id = any(v_t.class_ids)) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into v_a from cbt_attempts where test_id = p_test and student_id = v_st;
  if v_a.id is not null then
    if v_a.submitted_at is not null then raise exception 'Already handed in' using errcode = 'P0001'; end if;
    if v_a.deadline_at < now() - interval '30 seconds' then perform public.cbt_mark(v_a.id); raise exception 'Time is up' using errcode = 'P0001'; end if;
    return public.cbt_paper(v_a.id);
  end if;
  select * into v_al from cbt_allowances where test_id = p_test and student_id = v_st;
  v_close := greatest(v_t.closes_at, coalesce(v_al.until, v_t.closes_at));
  if now() < v_t.opens_at then raise exception 'Not open yet' using errcode = 'P0001'; end if;
  if now() > v_close then raise exception 'This test has closed' using errcode = 'P0001'; end if;
  v_order := case when v_t.shuffle then array(select x from unnest(v_t.question_ids) x order by random()) else v_t.question_ids end;
  select coalesce(jsonb_object_agg(q.id::text, case when v_t.shuffle
            then (select jsonb_agg(g order by random()) from generate_series(0, jsonb_array_length(q.options) - 1) g)
            else (select jsonb_agg(g order by g) from generate_series(0, jsonb_array_length(q.options) - 1) g) end), '{}'::jsonb)
    into v_opts from questions q where q.id = any(v_order);
  insert into cbt_attempts (test_id, school_id, student_id, deadline_at, q_order, opt_orders)
  values (p_test, v_t.school_id, v_st, least(now() + make_interval(mins => v_t.duration_min + coalesce(v_al.extra_min, 0)), v_close + make_interval(mins => coalesce(v_al.extra_min, 0))), v_order, v_opts)
  returning id into v_id;
  return public.cbt_paper(v_id);
end $$;

-- Autosave. Answers: {question_id: option_index}. Ignored once time is up.
create or replace function public.cbt_save(p_attempt uuid, p_answers jsonb, p_flags jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_a record; v_clean jsonb;
begin
  select * into v_a from cbt_attempts where id = p_attempt and student_id = public.my_student() for update;
  if v_a.id is null then raise exception 'not allowed' using errcode = '42501'; end if;
  if v_a.submitted_at is not null then return jsonb_build_object('saved', false, 'reason', 'handed_in'); end if;
  if now() > v_a.deadline_at + interval '30 seconds' then
    perform public.cbt_mark(v_a.id);
    return jsonb_build_object('saved', false, 'reason', 'time_up');
  end if;
  select coalesce(jsonb_object_agg(k, to_jsonb((v)::int)), '{}'::jsonb) into v_clean
  from jsonb_each_text(coalesce(p_answers, '{}'::jsonb)) e(k, v)
  where k::uuid = any(v_a.q_order) and v ~ '^[0-9]$';
  update cbt_attempts set answers = v_clean,
    flags = case when jsonb_typeof(p_flags) = 'array' and jsonb_array_length(p_flags) <= 100 then p_flags else flags end
  where id = p_attempt;
  return jsonb_build_object('saved', true, 'deadline_at', v_a.deadline_at, 'now', now());
end $$;

-- Hand in.
create or replace function public.cbt_submit(p_attempt uuid, p_answers jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_a record; v_t record;
begin
  if p_answers is not null then perform public.cbt_save(p_attempt, p_answers, null); end if;
  select * into v_a from cbt_attempts where id = p_attempt and student_id = public.my_student();
  if v_a.id is null then raise exception 'not allowed' using errcode = '42501'; end if;
  if v_a.submitted_at is null then perform public.cbt_mark(p_attempt); end if;
  select * into v_a from cbt_attempts where id = p_attempt;
  select * into v_t from cbt_tests where id = v_a.test_id;
  return jsonb_build_object('submitted_at', v_a.submitted_at, 'practice', v_t.practice,
    'score', case when v_t.show_score or v_t.practice then v_a.score end,
    'total', case when v_t.show_score or v_t.practice then v_a.total end,
    'answered', (select count(*) from jsonb_object_keys(v_a.answers)), 'questions', cardinality(v_a.q_order));
end $$;

-- The right answers: straight away for practice, after the test closes for the rest.
create or replace function public.cbt_review(p_attempt uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when a.submitted_at is not null and (t.practice or (t.show_score and now() > t.closes_at)) then jsonb_build_object(
    'title', t.title, 'score', a.score, 'total', a.total,
    'questions', (select jsonb_agg(jsonb_build_object('body', q.body, 'options', q.options, 'answer', q.answer,
        'chosen', (a.answers->>(q.id::text))::int, 'explanation', q.explanation) order by x.n)
      from unnest(a.q_order) with ordinality x(qid, n) join questions q on q.id = x.qid)) end
  from cbt_attempts a join cbt_tests t on t.id = a.test_id
  where a.id = p_attempt and public.acts_for_student(a.student_id);
$$;

-- Results for the teacher: every student in the classes, plus the questions most got wrong.
create or replace function public.cbt_results(p_test uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_t record;
begin
  select * into v_t from cbt_tests where id = p_test;
  if v_t.id is null or not (v_t.teacher_id = auth.uid() or public.is_school_admin(v_t.school_id) or public.teaches_subject_in(v_t.subject_id, v_t.class_ids)) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  perform public.cbt_finalize_due(p_test);
  return jsonb_build_object(
    'students', coalesce((select jsonb_agg(jsonb_build_object(
        'id', s.id, 'name', s.first_name || ' ' || s.last_name, 'class', public.class_label(c.name, c.arm), 'class_id', c.id,
        'started_at', a.started_at, 'submitted_at', a.submitted_at, 'score', a.score, 'total', a.total,
        'minutes', case when a.submitted_at is not null then ceil(extract(epoch from (a.submitted_at - a.started_at)) / 60) end,
        'timed_out', a.submitted_at is not null and a.submitted_at >= a.deadline_at - interval '1 second',
        'in_progress', a.id is not null and a.submitted_at is null,
        'extra_min', al.extra_min, 'until', al.until)
        order by c.level_order, c.name, c.arm, s.last_name, s.first_name)
      from students s join classes c on c.id = s.class_id
      left join cbt_attempts a on a.test_id = p_test and a.student_id = s.id
      left join cbt_allowances al on al.test_id = p_test and al.student_id = s.id
      where s.class_id = any(v_t.class_ids) and s.status = 'active'), '[]'::jsonb),
    'missed', coalesce((select jsonb_agg(m order by (m->>'wrong')::int desc) from (
        select jsonb_build_object('body', q.body, 'topic', q.topic,
          'wrong', count(*) filter (where coalesce((a.answers->>(q.id::text))::int, -1) <> q.answer),
          'of', count(*)) m
        from questions q join cbt_attempts a on a.test_id = p_test and a.submitted_at is not null and q.id = any(a.q_order)
        where q.id = any(v_t.question_ids)
        group by q.id, q.body, q.topic
        order by count(*) filter (where coalesce((a.answers->>(q.id::text))::int, -1) <> q.answer) desc
        limit 5) z), '[]'::jsonb));
end $$;

-- Teacher lets one student try again (removes their attempt).
create or replace function public.cbt_reset_attempt(p_test uuid, p_student uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_t record;
begin
  select * into v_t from cbt_tests where id = p_test;
  if v_t.id is null or not (v_t.teacher_id = auth.uid() or public.is_school_admin(v_t.school_id)) then raise exception 'not allowed' using errcode = '42501'; end if;
  delete from cbt_attempts where test_id = p_test and student_id = p_student;
end $$;

-- ===========================================================================
-- 4. AI assistant usage (a monthly allowance per teacher)
-- ===========================================================================
create table if not exists public.ai_requests (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (char_length(kind) <= 30),
  created_at timestamptz not null default now()
);
create index if not exists ai_requests_user on public.ai_requests (user_id, created_at desc);
alter table public.ai_requests enable row level security;
drop policy if exists ai_requests_read on public.ai_requests;
create policy ai_requests_read on public.ai_requests for select using (user_id = auth.uid() or public.is_school_admin(school_id));
drop policy if exists ai_requests_insert on public.ai_requests;
create policy ai_requests_insert on public.ai_requests for insert with check (user_id = auth.uid() and public.is_staff(school_id));

-- ===========================================================================
-- 5. My classes: one row per student, for one class (and subject).
-- ===========================================================================
create or replace function public.class_roster(p_class uuid, p_class_subject uuid, p_term uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_class record; v_starts date; v_subject uuid;
begin
  select * into v_class from classes where id = p_class;
  if v_class.id is null or not (public.teaches_class(p_class) or public.is_school_admin(v_class.school_id)) then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_class_subject is not null and not exists (select 1 from class_subjects where id = p_class_subject and class_id = p_class) then raise exception 'not allowed' using errcode = '42501'; end if;
  select starts_on into v_starts from terms where id = p_term and school_id = v_class.school_id;
  select subject_id into v_subject from class_subjects where id = p_class_subject;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', s.id, 'name', s.first_name || ' ' || s.last_name,
      'present', (select count(*) from attendance a where a.student_id = s.id and a.status in ('present', 'late') and (v_starts is null or a.date >= v_starts)),
      'marked', (select count(*) from attendance a where a.student_id = s.id and (v_starts is null or a.date >= v_starts)),
      'absent', (select count(*) from attendance a where a.student_id = s.id and a.status = 'absent' and (v_starts is null or a.date >= v_starts)),
      'hw_set', (select count(*) from homework h where h.class_subject_id = p_class_subject and h.term_id = p_term and h.due_at < now() and h.submit_modes <> array['paper']),
      'hw_in', (select count(*) from homework h join homework_submissions hs on hs.homework_id = h.id and hs.student_id = s.id and hs.status in ('submitted', 'marked')
                 where h.class_subject_id = p_class_subject and h.term_id = p_term and h.due_at < now() and h.submit_modes <> array['paper']),
      'last_test', (select jsonb_build_object('score', a.score, 'total', a.total, 'title', t.title) from cbt_attempts a join cbt_tests t on t.id = a.test_id
                     where a.student_id = s.id and a.submitted_at is not null and not t.practice and (v_subject is null or t.subject_id = v_subject)
                     order by a.submitted_at desc limit 1))
      order by s.last_name, s.first_name)
    from students s where s.class_id = p_class and s.status = 'active'), '[]'::jsonb);
end $$;

-- ===========================================================================
-- 6. Permissions (same as 0014), so 0008 doesn't need to be run again.
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
      -- Server only.
      execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
    elsif f.proname not in ('handle_new_user', 'audit_row', 'check_score_limits', 'sync_period_times', 'sync_invoice_paid', 'application_ref', 'lock_paid_payslips') then
      execute format('grant execute on function %s to authenticated', f.sig);
    end if;
  end loop;
end $$;
grant execute on function public.admissions_open(uuid) to anon;
grant execute on function public.is_school_admin(uuid) to anon;
