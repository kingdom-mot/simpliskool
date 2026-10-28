-- Timetable, announcements, each school's own mark split, and approving results
-- before release. This file sets its own permissions at the end, so there is no need
-- to run 0008_grants.sql again after it.

-- ===========================================================================
-- 1. Each school's mark split (for example CA 1 20 + CA 2 20 + Exam 60, or
--    Test 10 + Assignment 10 + Mid-term 20 + Exam 60). Always adds up to 100.
-- ===========================================================================
alter table public.schools add column if not exists assessment jsonb;
alter table public.scores add column if not exists ca3 numeric(5,2) check (ca3 >= 0);

-- total now includes ca3 (a generated column has to be recreated to change it).
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'scores'
                 and column_name = 'total' and generation_expression ilike '%ca3%') then
    alter table public.scores drop column total;
    alter table public.scores add column total numeric(6,2)
      generated always as (coalesce(ca1, 0) + coalesce(ca2, 0) + coalesce(ca3, 0) + coalesce(exam, 0)) stored;
  end if;
end $$;
alter table public.scores drop constraint if exists scores_limits;
alter table public.scores drop constraint if exists scores_max_100;
alter table public.scores add constraint scores_max_100 check (
  (ca1 is null or ca1 <= 100) and (ca2 is null or ca2 <= 100) and (ca3 is null or ca3 <= 100) and (exam is null or exam <= 100));

-- The school's parts, in order: [{"key":"ca1","label":"CA 1","max":20}, ...].
create or replace function public.assessment_parts(p_school uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((select assessment from schools where id = p_school),
    '[{"key":"ca1","label":"CA 1","max":20},{"key":"ca2","label":"CA 2","max":20},{"key":"exam","label":"Exam","max":60}]'::jsonb);
$$;

create or replace function public.part_max(p_parts jsonb, p_key text)
returns numeric language sql immutable as $$
  select (e->>'max')::numeric from jsonb_array_elements(p_parts) e where e->>'key' = p_key;
$$;

-- Every score must fit the school's split.
create or replace function public.check_score_limits()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_parts jsonb := public.assessment_parts(new.school_id); k text; v numeric; m numeric;
begin
  foreach k in array array['ca1', 'ca2', 'ca3', 'exam'] loop
    v := case k when 'ca1' then new.ca1 when 'ca2' then new.ca2 when 'ca3' then new.ca3 else new.exam end;
    if v is null then continue; end if;
    m := public.part_max(v_parts, k);
    if m is null then raise exception 'This school does not use %', k using errcode = 'P0001'; end if;
    if v > m then raise exception 'Score out of range' using errcode = 'P0001'; end if;
  end loop;
  return new;
end $$;
drop trigger if exists scores_limits on public.scores;
create trigger scores_limits before insert or update on public.scores for each row execute function public.check_score_limits();

-- Change the split (owner or admin). Refused if current scores wouldn't fit.
create or replace function public.set_assessment(p_school uuid, p_parts jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare e jsonb; v_sum numeric := 0; v_keys text[] := '{}'; v_bad int;
begin
  if not public.is_owner_or_admin(p_school) then raise exception 'not allowed' using errcode = '42501'; end if;
  if jsonb_typeof(p_parts) <> 'array' or jsonb_array_length(p_parts) not between 1 and 4 then raise exception 'Use 1 to 4 parts' using errcode = 'P0001'; end if;
  for e in select * from jsonb_array_elements(p_parts) loop
    if e->>'key' not in ('ca1', 'ca2', 'ca3', 'exam') or e->>'key' = any(v_keys) then raise exception 'Bad parts' using errcode = 'P0001'; end if;
    if char_length(trim(coalesce(e->>'label', ''))) not between 1 and 20 then raise exception 'Give each part a short name' using errcode = 'P0001'; end if;
    if (e->>'max')::numeric is null or (e->>'max')::numeric <= 0 or (e->>'max')::numeric > 100 then raise exception 'Bad maximum' using errcode = 'P0001'; end if;
    v_keys := v_keys || (e->>'key');
    v_sum := v_sum + (e->>'max')::numeric;
  end loop;
  if v_sum <> 100 then raise exception 'The parts must add up to 100' using errcode = 'P0001'; end if;
  select count(*) into v_bad from scores s join terms t on t.id = s.term_id and t.is_current
  where s.school_id = p_school and (
    (s.ca1 is not null and (public.part_max(p_parts, 'ca1') is null or s.ca1 > public.part_max(p_parts, 'ca1')))
    or (s.ca2 is not null and (public.part_max(p_parts, 'ca2') is null or s.ca2 > public.part_max(p_parts, 'ca2')))
    or (s.ca3 is not null and (public.part_max(p_parts, 'ca3') is null or s.ca3 > public.part_max(p_parts, 'ca3')))
    or (s.exam is not null and (public.part_max(p_parts, 'exam') is null or s.exam > public.part_max(p_parts, 'exam'))));
  if v_bad > 0 then raise exception 'Scores already entered don''t fit (% scores)', v_bad using errcode = 'P0001'; end if;
  update schools set assessment = p_parts where id = p_school;
end $$;

-- ===========================================================================
-- 2. Approving results before release
-- ===========================================================================
create table if not exists public.result_approvals (
  class_id uuid not null references public.classes (id) on delete cascade,
  term_id uuid not null references public.terms (id) on delete cascade,
  school_id uuid not null references public.schools (id) on delete cascade,
  approved_at timestamptz not null default now(),
  approved_by uuid references public.profiles (id) on delete set null,
  primary key (class_id, term_id)
);
alter table public.result_approvals enable row level security;
drop policy if exists result_approvals_read on public.result_approvals;
create policy result_approvals_read on public.result_approvals for select using (public.is_staff(school_id));

create or replace function public.approve_results(p_class uuid, p_term uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_school uuid;
begin
  select school_id into v_school from classes where id = p_class;
  if v_school is null or not public.is_school_admin(v_school) then raise exception 'not allowed' using errcode = '42501'; end if;
  if not exists (select 1 from terms where id = p_term and school_id = v_school) then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_approve then
    insert into result_approvals (class_id, term_id, school_id, approved_by) values (p_class, p_term, v_school, auth.uid())
    on conflict (class_id, term_id) do update set approved_at = now(), approved_by = auth.uid();
  else
    delete from result_approvals where class_id = p_class and term_id = p_term;
  end if;
end $$;

-- Saving scores now follows the school's split, and clears an approval if anything changed.
drop function if exists public.save_scores(uuid, uuid, jsonb, boolean);
create or replace function public.save_scores(p_class_subject uuid, p_term uuid, p_rows jsonb, p_submit boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_cs record;
  v_parts jsonb;
  r jsonb;
  v_student uuid;
  v_ca1 numeric; v_ca2 numeric; v_ca3 numeric; v_exam numeric;
  v_saved int := 0;
  v_locked int := 0;
  v_changed int := 0;
  v_n int;
begin
  select cs.* into v_cs from class_subjects cs where cs.id = p_class_subject;
  if v_cs.id is null or not (public.is_school_admin(v_cs.school_id) or public.teaches_class_subject(p_class_subject)) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if not exists (select 1 from terms where id = p_term and school_id = v_cs.school_id) then raise exception 'not allowed' using errcode = '42501'; end if;
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'Bad scores' using errcode = 'P0001'; end if;
  v_parts := public.assessment_parts(v_cs.school_id);

  for r in select * from jsonb_array_elements(p_rows) loop
    v_student := (r->>'student_id')::uuid;
    if not exists (select 1 from students s where s.id = v_student and s.class_id = v_cs.class_id and s.status = 'active') then continue; end if;
    if public.result_released(v_student, p_term) then v_locked := v_locked + 1; continue; end if;
    v_ca1 := case when public.part_max(v_parts, 'ca1') is null then null else nullif(r->>'ca1', '')::numeric end;
    v_ca2 := case when public.part_max(v_parts, 'ca2') is null then null else nullif(r->>'ca2', '')::numeric end;
    v_ca3 := case when public.part_max(v_parts, 'ca3') is null then null else nullif(r->>'ca3', '')::numeric end;
    v_exam := case when public.part_max(v_parts, 'exam') is null then null else nullif(r->>'exam', '')::numeric end;
    if v_ca1 < 0 or v_ca2 < 0 or v_ca3 < 0 or v_exam < 0
       or v_ca1 > public.part_max(v_parts, 'ca1') or v_ca2 > public.part_max(v_parts, 'ca2')
       or v_ca3 > public.part_max(v_parts, 'ca3') or v_exam > public.part_max(v_parts, 'exam') then
      raise exception 'Score out of range' using errcode = 'P0001';
    end if;
    if v_ca1 is null and v_ca2 is null and v_ca3 is null and v_exam is null then
      delete from scores where student_id = v_student and class_subject_id = p_class_subject and term_id = p_term;
    else
      insert into scores (school_id, student_id, class_subject_id, term_id, ca1, ca2, ca3, exam, updated_by, updated_at)
      values (v_cs.school_id, v_student, p_class_subject, p_term, v_ca1, v_ca2, v_ca3, v_exam, auth.uid(), now())
      on conflict (student_id, class_subject_id, term_id) do update
        set ca1 = excluded.ca1, ca2 = excluded.ca2, ca3 = excluded.ca3, exam = excluded.exam, updated_by = excluded.updated_by, updated_at = now()
        where (scores.ca1, scores.ca2, scores.ca3, scores.exam) is distinct from (excluded.ca1, excluded.ca2, excluded.ca3, excluded.exam);
    end if;
    get diagnostics v_n = row_count;
    v_changed := v_changed + v_n;
    v_saved := v_saved + 1;
  end loop;

  if v_changed > 0 then
    delete from result_approvals where class_id = v_cs.class_id and term_id = p_term;
  end if;
  if p_submit then
    insert into score_sheets (class_subject_id, term_id, school_id, submitted_at, submitted_by)
    values (p_class_subject, p_term, v_cs.school_id, now(), auth.uid())
    on conflict (class_subject_id, term_id) do update set submitted_at = now(), submitted_by = auth.uid();
  end if;
  return jsonb_build_object('saved', v_saved, 'locked', v_locked);
end $$;

-- Release now needs approval first.
create or replace function public.release_results(p_class uuid, p_term uuid, p_release boolean)
returns int language plpgsql security definer set search_path = public as $$
declare v_school uuid; v_n int;
begin
  select school_id into v_school from classes where id = p_class;
  if v_school is null or not public.is_school_admin(v_school) then raise exception 'not allowed' using errcode = '42501'; end if;
  if not exists (select 1 from terms where id = p_term and school_id = v_school) then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_release then
    if not exists (select 1 from result_approvals where class_id = p_class and term_id = p_term) then
      raise exception 'Approve first' using errcode = 'P0001';
    end if;
    insert into report_cards (school_id, student_id, term_id, class_id, released_at, released_by)
    select v_school, s.id, p_term, p_class, now(), auth.uid() from students s
    where s.class_id = p_class and s.status = 'active'
      and exists (select 1 from scores x join class_subjects cs on cs.id = x.class_subject_id
                  where x.student_id = s.id and x.term_id = p_term and cs.class_id = p_class)
    on conflict (student_id, term_id) do update set released_at = now(), released_by = auth.uid(), class_id = p_class;
    get diagnostics v_n = row_count;
  else
    update report_cards set released_at = null where term_id = p_term and class_id = p_class and released_at is not null;
    get diagnostics v_n = row_count;
  end if;
  return v_n;
end $$;

-- student_result also returns ca3 and the school's split.
create or replace function public.student_result(p_student uuid, p_term uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_st record;
  v_class uuid;
  v_from date; v_to date;
  v_out jsonb;
begin
  select s.*, c.name as class_name, c.arm as class_arm into v_st
  from students s left join classes c on c.id = s.class_id where s.id = p_student;
  if v_st.id is null then return null; end if;
  if not exists (select 1 from terms where id = p_term and school_id = v_st.school_id) then return null; end if;
  select coalesce(rp.class_id, v_st.class_id) into v_class from (select 1) d
    left join report_cards rp on rp.student_id = p_student and rp.term_id = p_term;
  if not (
    public.is_school_admin(v_st.school_id)
    or (public.is_staff(v_st.school_id) and v_class is not null and public.teaches_class(v_class))
    or (public.can_view_student(p_student) and public.result_released(p_student, p_term))
  ) then return null; end if;
  select from_d, to_d into v_from, v_to from public.term_range(p_term);

  with studs as (
    select s.id from students s where s.class_id = v_class and s.status = 'active'
    union select p_student
  ),
  sc as (
    select x.*, sb.name as subject from scores x
    join class_subjects cs on cs.id = x.class_subject_id and cs.class_id = v_class
    join subjects sb on sb.id = cs.subject_id
    where x.term_id = p_term and x.student_id in (select id from studs)
  ),
  avgs as (select student_id, round(avg(total), 1) as average from sc group by student_id),
  ranked as (select a.*, rank() over (order by a.average desc) as position from avgs a),
  subj_rank as (select sc.*, rank() over (partition by sc.class_subject_id order by sc.total desc) as pos,
                       round(avg(sc.total) over (partition by sc.class_subject_id), 1) as class_avg,
                       max(sc.total) over (partition by sc.class_subject_id) as highest
                from sc)
  select jsonb_build_object(
    'student', jsonb_build_object('id', v_st.id, 'name', v_st.first_name || ' ' || v_st.last_name, 'first_name', v_st.first_name,
                                  'admission_no', v_st.admission_no, 'class', public.class_label(v_st.class_name, v_st.class_arm), 'photo_url', v_st.photo_url),
    'term', (select jsonb_build_object('term_no', t.term_no, 'session', ses.name, 'ends_on', t.ends_on)
             from terms t join academic_sessions ses on ses.id = t.session_id where t.id = p_term),
    'school', (select jsonb_build_object('name', sch.name, 'address', sch.address, 'phone', sch.phone, 'email', sch.email,
                                          'logo_url', sch.logo_url, 'primary_color', sch.primary_color, 'secondary_color', sch.secondary_color)
               from schools sch where sch.id = v_st.school_id),
    'parts', public.assessment_parts(v_st.school_id),
    'subjects', coalesce((select jsonb_agg(jsonb_build_object(
        'name', r.subject, 'ca1', r.ca1, 'ca2', r.ca2, 'ca3', r.ca3, 'exam', r.exam, 'total', r.total,
        'grade', (select g.grade from public.grade_for(v_st.school_id, r.total) g),
        'remark', (select g.remark from public.grade_for(v_st.school_id, r.total) g),
        'position', r.pos, 'class_average', r.class_avg, 'highest', r.highest) order by r.subject)
      from subj_rank r where r.student_id = p_student), '[]'::jsonb),
    'average', (select average from ranked where student_id = p_student),
    'position', (select position from ranked where student_id = p_student),
    'class_size', (select count(*) from ranked),
    'days', (select count(*) from attendance a where a.student_id = p_student and a.date between v_from and v_to),
    'present', (select count(*) from attendance a where a.student_id = p_student and a.date between v_from and v_to and a.status in ('present', 'late')),
    'comment', (select class_teacher_comment from result_comments where student_id = p_student and term_id = p_term),
    'principal_comment', (select principal_comment from result_comments where student_id = p_student and term_id = p_term),
    'ratings', (select ratings from result_comments where student_id = p_student and term_id = p_term),
    'class_teacher', (select nullif(trim(coalesce(p.full_name, '')), '') from classes c join profiles p on p.id = c.class_teacher_id where c.id = v_class),
    'scale', coalesce((select jsonb_agg(jsonb_build_object('grade', g.grade, 'min', g.min_score, 'max', g.max_score, 'remark', g.remark) order by g.min_score desc)
                       from grading_scales g where g.school_id = v_st.school_id), '[]'::jsonb),
    'released_at', (select released_at from report_cards where student_id = p_student and term_id = p_term)
  ) into v_out;
  return v_out;
end $$;

-- class_results: include ca3, the split and the approval.
create or replace function public.class_results(p_class uuid, p_term uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_school uuid;
  v_from date; v_to date;
  v_parts jsonb;
  v_out jsonb;
begin
  select school_id into v_school from classes where id = p_class;
  if v_school is null or not (public.is_school_admin(v_school) or (public.is_staff(v_school) and public.teaches_class(p_class))) then
    return null;
  end if;
  if not exists (select 1 from terms where id = p_term and school_id = v_school) then return null; end if;
  select from_d, to_d into v_from, v_to from public.term_range(p_term);
  v_parts := public.assessment_parts(v_school);

  with subj as (
    select cs.id, sb.name, nullif(trim(coalesce(p.full_name, '')), '') as teacher, p.email as teacher_email, cs.teacher_id,
           sh.submitted_at
    from class_subjects cs join subjects sb on sb.id = cs.subject_id
    left join profiles p on p.id = cs.teacher_id
    left join score_sheets sh on sh.class_subject_id = cs.id and sh.term_id = p_term
    where cs.class_id = p_class
  ),
  studs as (
    select s.id, s.first_name, s.last_name, s.admission_no from students s where s.class_id = p_class and s.status = 'active'
  ),
  sc as (
    select x.* from scores x join subj on subj.id = x.class_subject_id
    where x.term_id = p_term and x.student_id in (select id from studs)
  ),
  avgs as (
    select st.id, round(avg(sc.total), 1) as average, count(sc.id) as subjects_scored
    from studs st left join sc on sc.student_id = st.id group by st.id
  ),
  ranked as (
    select a.*, case when a.average is null then null else rank() over (order by a.average desc nulls last) end as position from avgs a
  )
  select jsonb_build_object(
    'class_size', (select count(*) from studs),
    'parts', v_parts,
    'approved_at', (select approved_at from result_approvals where class_id = p_class and term_id = p_term),
    'subjects', coalesce((select jsonb_agg(jsonb_build_object(
        'id', subj.id, 'name', subj.name, 'teacher', subj.teacher, 'teacher_email', subj.teacher_email,
        'submitted_at', subj.submitted_at,
        'scored', (select count(*) from sc where sc.class_subject_id = subj.id),
        'complete', (select count(*) from sc where sc.class_subject_id = subj.id
                      and (public.part_max(v_parts, 'ca1') is null or sc.ca1 is not null)
                      and (public.part_max(v_parts, 'ca2') is null or sc.ca2 is not null)
                      and (public.part_max(v_parts, 'ca3') is null or sc.ca3 is not null)
                      and (public.part_max(v_parts, 'exam') is null or sc.exam is not null)))
        order by subj.name) from subj), '[]'::jsonb),
    'students', coalesce((select jsonb_agg(jsonb_build_object(
        'id', st.id, 'name', st.first_name || ' ' || st.last_name, 'first_name', st.first_name, 'admission_no', st.admission_no,
        'scores', coalesce((select jsonb_object_agg(sc.class_subject_id, jsonb_build_object('ca1', sc.ca1, 'ca2', sc.ca2, 'ca3', sc.ca3, 'exam', sc.exam, 'total', sc.total))
                            from sc where sc.student_id = st.id), '{}'::jsonb),
        'average', rk.average, 'position', rk.position, 'subjects_scored', rk.subjects_scored,
        'days', (select count(*) from attendance a where a.student_id = st.id and a.date between v_from and v_to),
        'present', (select count(*) from attendance a where a.student_id = st.id and a.date between v_from and v_to and a.status in ('present', 'late')),
        'comment', rc.class_teacher_comment, 'principal_comment', rc.principal_comment, 'ratings', rc.ratings,
        'released_at', rp.released_at)
        order by rk.position nulls last, st.last_name, st.first_name)
      from studs st join ranked rk on rk.id = st.id
      left join result_comments rc on rc.student_id = st.id and rc.term_id = p_term
      left join report_cards rp on rp.student_id = st.id and rp.term_id = p_term), '[]'::jsonb)
  ) into v_out;
  return v_out;
end $$;

-- ===========================================================================
-- 3. Timetable: the school's bell times (periods and breaks), then each class's
--    week. Lessons are stored in timetable_periods, which the dashboards already read.
-- ===========================================================================
create table if not exists public.school_periods (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 30),
  kind text not null default 'lesson' check (kind in ('lesson', 'break')),
  starts_at time not null,
  ends_at time not null,
  check (starts_at < ends_at)
);
create index if not exists school_periods_school on public.school_periods (school_id, starts_at);
alter table public.school_periods enable row level security;
drop policy if exists school_periods_read on public.school_periods;
create policy school_periods_read on public.school_periods for select using (public.is_member(school_id));
drop policy if exists school_periods_write on public.school_periods;
create policy school_periods_write on public.school_periods for all using (public.is_school_admin(school_id)) with check (public.is_school_admin(school_id));

alter table public.timetable_periods add column if not exists period_id uuid references public.school_periods (id) on delete cascade;
alter table public.timetable_periods add column if not exists room text check (room is null or char_length(room) <= 40);
create unique index if not exists timetable_slot_once on public.timetable_periods (class_id, day_of_week, period_id) where period_id is not null;

-- Keep lesson times in step when the bell times change.
create or replace function public.sync_period_times()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update timetable_periods set starts_at = new.starts_at, ends_at = new.ends_at where period_id = new.id;
  if new.kind = 'break' then delete from timetable_periods where period_id = new.id; end if;
  return new;
end $$;
drop trigger if exists school_periods_sync on public.school_periods;
create trigger school_periods_sync after update on public.school_periods for each row execute function public.sync_period_times();

-- A standard Nigerian school day: 8:00 start, 40-minute lessons, short break, lunch.
create or replace function public.use_standard_periods(p_school uuid)
returns int language plpgsql security definer set search_path = public as $$
begin
  if not public.is_school_admin(p_school) then raise exception 'not allowed' using errcode = '42501'; end if;
  if exists (select 1 from school_periods where school_id = p_school) then raise exception 'Periods already set' using errcode = 'P0001'; end if;
  insert into school_periods (school_id, label, kind, starts_at, ends_at) values
    (p_school, 'Period 1', 'lesson', '08:00', '08:40'),
    (p_school, 'Period 2', 'lesson', '08:40', '09:20'),
    (p_school, 'Period 3', 'lesson', '09:20', '10:00'),
    (p_school, 'Break', 'break', '10:00', '10:20'),
    (p_school, 'Period 4', 'lesson', '10:20', '11:00'),
    (p_school, 'Period 5', 'lesson', '11:00', '11:40'),
    (p_school, 'Period 6', 'lesson', '11:40', '12:20'),
    (p_school, 'Lunch', 'break', '12:20', '13:00'),
    (p_school, 'Period 7', 'lesson', '13:00', '13:40'),
    (p_school, 'Period 8', 'lesson', '13:40', '14:20');
  return 10;
end $$;

-- Put a subject in a class's period (or clear it). Refuses a teacher clash.
create or replace function public.save_timetable_slot(p_class uuid, p_day smallint, p_period uuid, p_class_subject uuid, p_room text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_school uuid; v_per record; v_teacher uuid; v_clash record;
begin
  select school_id into v_school from classes where id = p_class;
  if v_school is null or not public.is_school_admin(v_school) then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_day not between 1 and 6 then raise exception 'Bad day' using errcode = 'P0001'; end if;
  select * into v_per from school_periods where id = p_period and school_id = v_school;
  if v_per.id is null then raise exception 'not allowed' using errcode = '42501'; end if;
  if v_per.kind = 'break' then raise exception 'Breaks can''t have lessons' using errcode = 'P0001'; end if;

  if p_class_subject is null then
    delete from timetable_periods where class_id = p_class and day_of_week = p_day and period_id = p_period;
    return;
  end if;
  select teacher_id into v_teacher from class_subjects where id = p_class_subject and class_id = p_class;
  if not found then raise exception 'not allowed' using errcode = '42501'; end if;

  if v_teacher is not null then
    select public.class_label(c.name, c.arm) as cls, nullif(trim(coalesce(pr.full_name, '')), '') as who into v_clash
    from timetable_periods tp
    join class_subjects cs on cs.id = tp.class_subject_id
    join classes c on c.id = tp.class_id
    left join profiles pr on pr.id = cs.teacher_id
    where tp.school_id = v_school and tp.day_of_week = p_day and tp.class_id <> p_class
      and cs.teacher_id = v_teacher and tp.starts_at < v_per.ends_at and tp.ends_at > v_per.starts_at
    limit 1;
    if found then raise exception 'Clash: % is teaching % at this time', coalesce(v_clash.who, 'This teacher'), v_clash.cls using errcode = 'P0001'; end if;
  end if;

  insert into timetable_periods (school_id, class_id, class_subject_id, day_of_week, starts_at, ends_at, period_id, room)
  values (v_school, p_class, p_class_subject, p_day, v_per.starts_at, v_per.ends_at, p_period, nullif(trim(coalesce(p_room, '')), ''))
  on conflict (class_id, day_of_week, period_id) where period_id is not null do update
    set class_subject_id = excluded.class_subject_id, room = excluded.room, starts_at = excluded.starts_at, ends_at = excluded.ends_at;
end $$;

-- Teachers who are free in a period (for the builder's hint).
create or replace function public.free_teachers(p_school uuid, p_day smallint, p_period uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when not public.is_school_admin(p_school) then '[]'::jsonb else coalesce((
    select jsonb_agg(distinct nullif(trim(coalesce(p.full_name, '')), '')) from memberships m join profiles p on p.id = m.user_id
    join school_periods sp on sp.id = p_period
    where m.school_id = p_school and m.role = 'teacher'
      and not exists (select 1 from timetable_periods tp join class_subjects cs on cs.id = tp.class_subject_id
                      where tp.school_id = p_school and tp.day_of_week = p_day and cs.teacher_id = m.user_id
                        and tp.starts_at < sp.ends_at and tp.ends_at > sp.starts_at)), '[]'::jsonb) end;
$$;

-- ===========================================================================
-- 4. Announcements: audience (whole school, parents, staff or chosen classes),
--    events with RSVP, read receipts, email.
-- ===========================================================================
alter table public.announcements add column if not exists class_ids uuid[];
alter table public.announcements add column if not exists kind text not null default 'notice';
alter table public.announcements add column if not exists event_at timestamptz;
alter table public.announcements add column if not exists emailed int not null default 0;
alter table public.announcements add column if not exists reach int not null default 0;
alter table public.announcements drop constraint if exists announcements_checks;
alter table public.announcements add constraint announcements_checks check (
  kind in ('notice', 'event') and char_length(trim(title)) between 3 and 120 and char_length(body) between 1 and 3000
  and (audience <> 'class' or coalesce(array_length(class_ids, 1), 0) > 0));
create index if not exists announcements_school on public.announcements (school_id, created_at desc);

-- Who an announcement is for.
create or replace function public.announcement_users(p_school uuid, p_audience public.announcement_audience, p_classes uuid[])
returns table (user_id uuid) language sql stable security definer set search_path = public as $$
  select m.user_id from memberships m
  where m.school_id = p_school and (
    (p_audience = 'school')
    or (p_audience = 'staff' and m.role in ('owner', 'admin', 'principal', 'bursar', 'teacher'))
    or (p_audience = 'parents' and m.role = 'parent'))
  union
  select g.user_id from guardians g join students s on s.id = g.student_id
  where p_audience = 'class' and s.school_id = p_school and s.status = 'active' and s.class_id = any(p_classes)
  union
  select s.user_id from students s
  where p_audience = 'class' and s.school_id = p_school and s.status = 'active' and s.class_id = any(p_classes) and s.user_id is not null;
$$;

create or replace function public.can_see_announcement(p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from announcements a where a.id = p_id and (
    public.is_staff(a.school_id)
    or auth.uid() in (select user_id from public.announcement_users(a.school_id, a.audience, a.class_ids))));
$$;

drop policy if exists announcements_read on public.announcements;
create policy announcements_read on public.announcements for select using (public.can_see_announcement(id));
drop policy if exists announcements_write on public.announcements;
create policy announcements_write on public.announcements for all using (public.is_school_admin(school_id)) with check (public.is_school_admin(school_id));

create table if not exists public.announcement_reads (
  announcement_id uuid not null references public.announcements (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (announcement_id, user_id)
);
create table if not exists public.announcement_rsvps (
  announcement_id uuid not null references public.announcements (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  going boolean not null,
  updated_at timestamptz not null default now(),
  primary key (announcement_id, user_id)
);
alter table public.announcement_reads enable row level security;
alter table public.announcement_rsvps enable row level security;
drop policy if exists announcement_reads_own on public.announcement_reads;
create policy announcement_reads_own on public.announcement_reads for select using (user_id = auth.uid());
drop policy if exists announcement_rsvps_own on public.announcement_rsvps;
create policy announcement_rsvps_own on public.announcement_rsvps for select using (user_id = auth.uid());
-- Both are written through the functions below.

create or replace function public.mark_announcements_read(p_ids uuid[])
returns void language sql security definer set search_path = public as $$
  insert into announcement_reads (announcement_id, user_id)
  select a.id, auth.uid() from announcements a where a.id = any(p_ids) and auth.uid() is not null and public.can_see_announcement(a.id)
  on conflict do nothing;
$$;

create or replace function public.set_rsvp(p_id uuid, p_going boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.can_see_announcement(p_id)
     or not exists (select 1 from announcements where id = p_id and kind = 'event') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  insert into announcement_rsvps (announcement_id, user_id, going) values (p_id, auth.uid(), p_going)
  on conflict (announcement_id, user_id) do update set going = excluded.going, updated_at = now();
end $$;

-- How many people an audience reaches (for "Send to 551 parents").
create or replace function public.announcement_reach(p_school uuid, p_audience public.announcement_audience, p_classes uuid[])
returns int language sql stable security definer set search_path = public as $$
  select case when not public.is_school_admin(p_school) then 0
    else (select count(distinct user_id)::int from public.announcement_users(p_school, p_audience, p_classes)) end;
$$;

-- Sent announcements with read and RSVP counts (admins).
create or replace function public.announcement_history(p_school uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when not public.is_school_admin(p_school) then '[]'::jsonb else coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', a.id, 'title', a.title, 'audience', a.audience, 'kind', a.kind, 'event_at', a.event_at, 'at', a.created_at,
      'class_names', (select jsonb_agg(public.class_label(c.name, c.arm) order by c.level_order, c.name, c.arm) from classes c where c.id = any(a.class_ids)),
      'reach', a.reach, 'emailed', a.emailed,
      'read', (select count(*) from announcement_reads r where r.announcement_id = a.id),
      'going', (select count(*) from announcement_rsvps r where r.announcement_id = a.id and r.going),
      'not_going', (select count(*) from announcement_rsvps r where r.announcement_id = a.id and not r.going))
      order by a.created_at desc)
    from (select * from announcements where school_id = p_school order by created_at desc limit 50) a), '[]'::jsonb) end;
$$;

-- ===========================================================================
-- 5. Permissions (same as 0008), so 0008 doesn't need to be run again.
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
    if f.proname = 'verify_student_pin' then
      execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
    elsif f.proname = 'announcement_users' then
      -- Lists who an announcement reaches: for the server only.
      execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
    elsif f.proname not in ('handle_new_user', 'audit_row', 'check_score_limits', 'sync_period_times', 'sync_invoice_paid') then
      execute format('grant execute on function %s to authenticated', f.sig);
    end if;
  end loop;
end $$;
