-- Scores and results: score entry by subject teachers, class broadsheet with averages
-- and positions, class teacher and principal comments, and report card release.
-- Scores are CA 1 (out of 20) + CA 2 (out of 20) + Exam (out of 60) = 100.
-- Run 0008_grants.sql again after this file.

alter table public.scores drop constraint if exists scores_limits;
alter table public.scores add constraint scores_limits check (
  (ca1 is null or ca1 <= 20) and (ca2 is null or ca2 <= 20) and (exam is null or exam <= 60));
create index if not exists scores_term_cs on public.scores (term_id, class_subject_id);

-- A subject teacher marks a class's scores as finished for the term.
create table if not exists public.score_sheets (
  class_subject_id uuid not null references public.class_subjects (id) on delete cascade,
  term_id uuid not null references public.terms (id) on delete cascade,
  school_id uuid not null references public.schools (id) on delete cascade,
  submitted_at timestamptz,
  submitted_by uuid references public.profiles (id) on delete set null,
  primary key (class_subject_id, term_id)
);
alter table public.score_sheets enable row level security;
drop policy if exists score_sheets_read on public.score_sheets;
create policy score_sheets_read on public.score_sheets for select using (public.is_staff(school_id));
-- Written only by save_scores().

alter table public.result_comments add column if not exists ratings jsonb;
alter table public.result_comments add column if not exists updated_at timestamptz not null default now();
alter table public.result_comments drop constraint if exists result_comments_len;
alter table public.result_comments add constraint result_comments_len check (
  (class_teacher_comment is null or char_length(class_teacher_comment) <= 600)
  and (principal_comment is null or char_length(principal_comment) <= 600));
-- Comments are written through the functions below (class teacher or admin), not by any staff member.
drop policy if exists comments_write on public.result_comments;
drop policy if exists comments_admin_write on public.result_comments;
create policy comments_admin_write on public.result_comments for all
  using (public.is_school_admin(school_id)) with check (public.is_school_admin(school_id));

alter table public.report_cards add column if not exists class_id uuid references public.classes (id) on delete set null;
alter table public.report_cards add column if not exists released_by uuid references public.profiles (id) on delete set null;

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('absence', 'register_reminder', 'fee_reminder', 'fee_invoice', 'report_card', 'score_reminder'));

-- ---------------------------------------------------------------------------
-- Grade for a total, from the school's grading scale (A 70+, B 60+, ... by default).
-- ---------------------------------------------------------------------------
create or replace function public.grade_for(p_school uuid, p_total numeric)
returns table (grade text, remark text) language sql stable security definer set search_path = public as $$
  select g.grade, g.remark from grading_scales g
  where g.school_id = p_school and p_total is not null and p_total >= g.min_score
  order by g.min_score desc limit 1;
$$;

-- Term dates for attendance counts (whole term if dates aren't set).
create or replace function public.term_range(p_term uuid)
returns table (from_d date, to_d date) language sql stable security definer set search_path = public as $$
  select coalesce(t.starts_on, '1900-01-01'::date), coalesce(t.ends_on, '2999-12-31'::date) from terms t where t.id = p_term;
$$;

-- ---------------------------------------------------------------------------
-- Save a subject's scores for a class (and optionally mark them finished).
-- p_rows: [{"student_id": "...", "ca1": 15, "ca2": null, "exam": 48}, ...]
-- Rows for students whose report card is already released are left alone.
-- ---------------------------------------------------------------------------
create or replace function public.save_scores(p_class_subject uuid, p_term uuid, p_rows jsonb, p_submit boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_cs record;
  r jsonb;
  v_student uuid;
  v_ca1 numeric; v_ca2 numeric; v_exam numeric;
  v_saved int := 0;
  v_locked int := 0;
begin
  select cs.* into v_cs from class_subjects cs where cs.id = p_class_subject;
  if v_cs.id is null or not (public.is_school_admin(v_cs.school_id) or public.teaches_class_subject(p_class_subject)) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if not exists (select 1 from terms where id = p_term and school_id = v_cs.school_id) then raise exception 'not allowed' using errcode = '42501'; end if;
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'Bad scores' using errcode = 'P0001'; end if;

  for r in select * from jsonb_array_elements(p_rows) loop
    v_student := (r->>'student_id')::uuid;
    if not exists (select 1 from students s where s.id = v_student and s.class_id = v_cs.class_id and s.status = 'active') then continue; end if;
    if public.result_released(v_student, p_term) then v_locked := v_locked + 1; continue; end if;
    v_ca1 := nullif(r->>'ca1', '')::numeric;
    v_ca2 := nullif(r->>'ca2', '')::numeric;
    v_exam := nullif(r->>'exam', '')::numeric;
    if v_ca1 < 0 or v_ca1 > 20 or v_ca2 < 0 or v_ca2 > 20 or v_exam < 0 or v_exam > 60 then
      raise exception 'Score out of range' using errcode = 'P0001';
    end if;
    if v_ca1 is null and v_ca2 is null and v_exam is null then
      delete from scores where student_id = v_student and class_subject_id = p_class_subject and term_id = p_term;
    else
      insert into scores (school_id, student_id, class_subject_id, term_id, ca1, ca2, exam, updated_by, updated_at)
      values (v_cs.school_id, v_student, p_class_subject, p_term, v_ca1, v_ca2, v_exam, auth.uid(), now())
      on conflict (student_id, class_subject_id, term_id) do update
        set ca1 = excluded.ca1, ca2 = excluded.ca2, exam = excluded.exam, updated_by = excluded.updated_by, updated_at = now()
        where (scores.ca1, scores.ca2, scores.exam) is distinct from (excluded.ca1, excluded.ca2, excluded.exam);
    end if;
    v_saved := v_saved + 1;
  end loop;

  if p_submit then
    insert into score_sheets (class_subject_id, term_id, school_id, submitted_at, submitted_by)
    values (p_class_subject, p_term, v_cs.school_id, now(), auth.uid())
    on conflict (class_subject_id, term_id) do update set submitted_at = now(), submitted_by = auth.uid();
  end if;
  return jsonb_build_object('saved', v_saved, 'locked', v_locked);
end $$;

-- ---------------------------------------------------------------------------
-- Comments
-- ---------------------------------------------------------------------------
create or replace function public.save_class_comment(p_student uuid, p_term uuid, p_comment text, p_ratings jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_st record; k text; v jsonb;
begin
  select s.id, s.school_id, s.class_id into v_st from students s where s.id = p_student;
  if v_st.id is null or not (
    public.is_school_admin(v_st.school_id)
    or exists (select 1 from classes c where c.id = v_st.class_id and c.class_teacher_id = auth.uid())
  ) then raise exception 'not allowed' using errcode = '42501'; end if;
  if not exists (select 1 from terms where id = p_term and school_id = v_st.school_id) then raise exception 'not allowed' using errcode = '42501'; end if;
  if public.result_released(p_student, p_term) and not public.is_school_admin(v_st.school_id) then
    raise exception 'Already released' using errcode = 'P0001';
  end if;
  if p_ratings is not null then
    if jsonb_typeof(p_ratings) <> 'object' or (select count(*) from jsonb_object_keys(p_ratings)) > 12 then raise exception 'Bad ratings' using errcode = 'P0001'; end if;
    for k, v in select * from jsonb_each(p_ratings) loop
      if char_length(k) > 40 or jsonb_typeof(v) <> 'number' or (v::text)::numeric not in (1, 2, 3, 4, 5) then raise exception 'Bad ratings' using errcode = 'P0001'; end if;
    end loop;
  end if;
  insert into result_comments (school_id, student_id, term_id, class_teacher_comment, ratings, updated_at)
  values (v_st.school_id, p_student, p_term, nullif(left(trim(coalesce(p_comment, '')), 600), ''), p_ratings, now())
  on conflict (student_id, term_id) do update
    set class_teacher_comment = excluded.class_teacher_comment, ratings = excluded.ratings, updated_at = now();
end $$;

create or replace function public.save_principal_comment(p_student uuid, p_term uuid, p_comment text)
returns void language plpgsql security definer set search_path = public as $$
declare v_school uuid;
begin
  select school_id into v_school from students where id = p_student;
  if v_school is null or not public.is_school_admin(v_school) then raise exception 'not allowed' using errcode = '42501'; end if;
  if not exists (select 1 from terms where id = p_term and school_id = v_school) then raise exception 'not allowed' using errcode = '42501'; end if;
  insert into result_comments (school_id, student_id, term_id, principal_comment, approved_at, approved_by, updated_at)
  values (v_school, p_student, p_term, nullif(left(trim(coalesce(p_comment, '')), 600), ''), now(), auth.uid(), now())
  on conflict (student_id, term_id) do update
    set principal_comment = excluded.principal_comment, approved_at = now(), approved_by = auth.uid(), updated_at = now();
end $$;

-- ---------------------------------------------------------------------------
-- A class's results for a term: subjects, every student's scores, average and position.
-- For admins (owner, admin, principal) and the class's teachers.
-- ---------------------------------------------------------------------------
create or replace function public.class_results(p_class uuid, p_term uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_school uuid;
  v_from date; v_to date;
  v_out jsonb;
begin
  select school_id into v_school from classes where id = p_class;
  if v_school is null or not (public.is_school_admin(v_school) or (public.is_staff(v_school) and public.teaches_class(p_class))) then
    return null;
  end if;
  if not exists (select 1 from terms where id = p_term and school_id = v_school) then return null; end if;
  select from_d, to_d into v_from, v_to from public.term_range(p_term);

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
    'subjects', coalesce((select jsonb_agg(jsonb_build_object(
        'id', subj.id, 'name', subj.name, 'teacher', subj.teacher, 'teacher_email', subj.teacher_email,
        'submitted_at', subj.submitted_at,
        'scored', (select count(*) from sc where sc.class_subject_id = subj.id),
        'complete', (select count(*) from sc where sc.class_subject_id = subj.id and sc.ca1 is not null and sc.ca2 is not null and sc.exam is not null))
        order by subj.name) from subj), '[]'::jsonb),
    'students', coalesce((select jsonb_agg(jsonb_build_object(
        'id', st.id, 'name', st.first_name || ' ' || st.last_name, 'first_name', st.first_name, 'admission_no', st.admission_no,
        'scores', coalesce((select jsonb_object_agg(sc.class_subject_id, jsonb_build_object('ca1', sc.ca1, 'ca2', sc.ca2, 'exam', sc.exam, 'total', sc.total))
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

-- ---------------------------------------------------------------------------
-- One student's report card. Families see it once released; admins and the
-- class's teachers can preview it before.
-- ---------------------------------------------------------------------------
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
  -- The class at release time if released, else the current class.
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
    'subjects', coalesce((select jsonb_agg(jsonb_build_object(
        'name', r.subject, 'ca1', r.ca1, 'ca2', r.ca2, 'exam', r.exam, 'total', r.total,
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

-- Released terms for a student (newest first), for the parent and student term pickers.
create or replace function public.released_terms(p_student uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when not public.can_view_student(p_student) then '[]'::jsonb else coalesce((
    select jsonb_agg(jsonb_build_object('id', t.id, 'term_no', t.term_no, 'session', ses.name, 'average', x.average)
                     order by ses.name desc, t.term_no desc)
    from report_cards rp join terms t on t.id = rp.term_id join academic_sessions ses on ses.id = t.session_id
    left join lateral (select round(avg(sc.total), 1) as average from scores sc where sc.student_id = p_student and sc.term_id = t.id) x on true
    where rp.student_id = p_student and rp.released_at is not null), '[]'::jsonb) end;
$$;

-- ---------------------------------------------------------------------------
-- Release (or take back) a class's report cards for a term.
-- ---------------------------------------------------------------------------
create or replace function public.release_results(p_class uuid, p_term uuid, p_release boolean)
returns int language plpgsql security definer set search_path = public as $$
declare v_school uuid; v_n int;
begin
  select school_id into v_school from classes where id = p_class;
  if v_school is null or not public.is_school_admin(v_school) then raise exception 'not allowed' using errcode = '42501'; end if;
  if not exists (select 1 from terms where id = p_term and school_id = v_school) then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_release then
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
