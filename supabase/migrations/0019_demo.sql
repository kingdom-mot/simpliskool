-- Demo schools for pitches and client demos: Bright Future Academy, Lekki and
-- Ajah (a two-branch group), filled with realistic made-up data. The app calls
-- demo_reset() every night (and from the back office) to wipe and rebuild them.
-- Dates are worked out from the day it runs, so the demo always looks current.
-- Safe to run more than once. Run after 0018.
-- Paste this file on its own into an empty SQL editor tab.

alter table public.schools add column if not exists is_demo boolean not null default false;

-- Fills one demo school. Server only (called by demo_reset).
create or replace function public.demo_fill(
  p_school uuid, p_classes text[], p_teachers uuid[], p_parents uuid[], p_per_class int, p_prefix text,
  p_principal uuid, p_bursar uuid, p_persona_parent uuid, p_persona_student uuid)
returns void language plpgsql security definer set search_path = public, extensions as $fn$
declare
  v_today date := (now() at time zone 'Africa/Lagos')::date;
  v_start date;
  v_prev_sess uuid; v_cur_sess uuid; v_prev uuid; v_cur uuid;
  v_week int;
  v_cls record; v_cs record; v_st record; v_inv record;
  v_class uuid; v_i int; v_j int; v_n int := 0; v_par int := 0;
  v_first text; v_last text; v_gender text; v_pid uuid; v_sid uuid;
  v_ability numeric; v_total bigint; v_pay bigint; v_paid bigint; v_method text; v_ref text; v_receipt int := 0;
  v_day date; v_roll numeric; v_tidx int;
  v_boys text[] := array['Tunde','Chinedu','Emeka','Ibrahim','Seun','Kelechi','Damilola','Obinna','Femi','Uche','Ayo','Musa','Tobi','Ikenna','Kunle','David','Samuel','Daniel','Joshua','Victor','Michael','Emmanuel','Gbenga','Segun','Chukwudi','Bolu','Yusuf','Tolu','Ifeanyi','Sola'];
  v_girls text[] := array['Ada','Chiamaka','Funmi','Aisha','Ngozi','Temi','Zainab','Kemi','Ifeoma','Bisi','Nkechi','Halima','Tola','Amaka','Folake','Grace','Esther','Deborah','Precious','Blessing','Favour','Mercy','Joy','Ruth','Rukayat','Yetunde','Oluchi','Adaeze','Morenike','Sade'];
  v_lasts text[] := array['Adeyemi','Okafor','Bello','Eze','Olaniyan','Nwosu','Abubakar','Okonkwo','Balogun','Ogunleye','Ibrahim','Adebayo','Chukwu','Afolabi','Onyekachi','Lawal','Obi','Oyelaran','Nnamdi','Akinola'];
  v_subjects jsonb := jsonb_build_object(
    'nursery', array['Numeracy','Literacy','Rhymes and Songs','Health Habits','Creative Arts'],
    'primary', array['Mathematics','English Language','Basic Science','Social Studies','Christian Religious Studies','Yoruba','Computer Studies','Cultural and Creative Arts'],
    'jss', array['Mathematics','English Language','Basic Science','Basic Technology','Business Studies','Civic Education','Christian Religious Studies','French','Computer Studies'],
    'ss', array['Mathematics','English Language','Physics','Chemistry','Biology','Economics','Government','Literature in English','Civic Education']);
  v_fees jsonb := jsonb_build_object('nursery', 18000000, 'primary', 22000000, 'jss', 28000000, 'ss', 32000000);
  v_sec text; v_subj text; v_tids uuid[];
begin
  perform setseed(0.37);
  v_start := v_today - 56;
  v_week := least(16, greatest(1, ((v_today - v_start) / 7) + 1));

  update schools set assessment = '[{"key":"ca1","max":10,"label":"First test"},{"key":"ca2","max":10,"label":"Second test"},{"key":"ca3","max":20,"label":"Mid-term test"},{"key":"exam","max":60,"label":"Exam"}]'::jsonb
  where id = p_school;
  insert into grading_scales (school_id, grade, min_score, max_score, remark) values
    (p_school, 'A', 70, 100, 'Excellent'), (p_school, 'B', 60, 69.99, 'Very good'), (p_school, 'C', 50, 59.99, 'Good'),
    (p_school, 'D', 45, 49.99, 'Fair'), (p_school, 'E', 40, 44.99, 'Pass'), (p_school, 'F', 0, 39.99, 'Fail');

  -- Sessions and terms: last term finished (results released), this term at week 8 or so.
  insert into academic_sessions (school_id, name, starts_on, ends_on, is_current)
  values (p_school, '2025/2026', v_start - 365, v_start - 30, false) returning id into v_prev_sess;
  insert into academic_sessions (school_id, name, starts_on, ends_on, is_current)
  values (p_school, '2026/2027', v_start, v_start + 300, true) returning id into v_cur_sess;
  insert into terms (school_id, session_id, term_no, starts_on, ends_on, is_current)
  values (p_school, v_prev_sess, 3, v_start - 130, v_start - 40, false) returning id into v_prev;
  insert into terms (school_id, session_id, term_no, starts_on, ends_on, is_current)
  values (p_school, v_cur_sess, 1, v_start, v_start + 88, true) returning id into v_cur;

  -- Bell times.
  insert into school_periods (school_id, label, kind, starts_at, ends_at) values
    (p_school, 'Period 1', 'lesson', '08:00', '08:40'), (p_school, 'Period 2', 'lesson', '08:40', '09:20'),
    (p_school, 'Period 3', 'lesson', '09:20', '10:00'), (p_school, 'Short break', 'break', '10:00', '10:20'),
    (p_school, 'Period 4', 'lesson', '10:20', '11:00'), (p_school, 'Period 5', 'lesson', '11:00', '11:40'),
    (p_school, 'Period 6', 'lesson', '11:40', '12:20'), (p_school, 'Lunch', 'break', '12:20', '13:00'),
    (p_school, 'Period 7', 'lesson', '13:00', '13:40'), (p_school, 'Period 8', 'lesson', '13:40', '14:20');

  -- Subjects.
  for v_sec in select jsonb_object_keys(v_subjects) loop
    for v_subj in select jsonb_array_elements_text(v_subjects -> v_sec) loop
      insert into subjects (school_id, name) values (p_school, v_subj) on conflict do nothing;
    end loop;
  end loop;

  -- Classes, class teachers and who teaches what.
  for v_i in 1 .. array_length(p_classes, 1) loop
    v_sec := case when p_classes[v_i] like 'Nursery%' then 'nursery' when p_classes[v_i] like 'Primary%' then 'primary' when p_classes[v_i] like 'JSS%' then 'jss' else 'ss' end;
    -- Secondary classes get subject teachers; nursery and primary classes have one teacher for everything.
    v_tidx := case when v_sec in ('jss', 'ss') then ((v_i) % least(5, array_length(p_teachers, 1))) + 1
                   else (case when array_length(p_teachers, 1) > 5 then 6 + ((v_i - 1) % (array_length(p_teachers, 1) - 5)) else ((v_i - 1) % array_length(p_teachers, 1)) + 1 end) end;
    if p_classes[v_i] = 'JSS 2' then v_tidx := 1; end if;
    insert into classes (school_id, name, arm, level_order, class_teacher_id)
    values (p_school, p_classes[v_i], 'A', v_i, p_teachers[v_tidx]) returning id into v_class;
    v_j := 0;
    for v_subj in select jsonb_array_elements_text(v_subjects -> v_sec) loop
      insert into class_subjects (school_id, class_id, subject_id, teacher_id)
      select p_school, v_class, s.id,
             case when v_sec in ('jss', 'ss') then p_teachers[(v_j % least(5, array_length(p_teachers, 1))) + 1] else p_teachers[v_tidx] end
      from subjects s where s.school_id = p_school and s.name = v_subj;
      v_j := v_j + 1;
    end loop;
  end loop;

  -- Students and parents. The persona family (one child in JSS 2, one in Primary 4) comes first.
  for v_cls in select id, name, level_order from classes where school_id = p_school order by level_order loop
    for v_i in 1 .. p_per_class loop
      v_n := v_n + 1;
      v_pid := null;
      if p_persona_student is not null and v_cls.name = 'JSS 2' and v_i = 1 then
        v_first := 'Tolu'; v_last := 'Okafor'; v_gender := 'male'; v_pid := p_persona_parent;
      elsif p_persona_parent is not null and v_cls.name = 'Primary 4' and v_i = 1 then
        v_first := 'Chiamaka'; v_last := 'Okafor'; v_gender := 'female'; v_pid := p_persona_parent;
      else
        v_gender := case when random() < 0.5 then 'male' else 'female' end;
        v_first := case when v_gender = 'male' then v_boys[1 + floor(random() * array_length(v_boys, 1))::int] else v_girls[1 + floor(random() * array_length(v_girls, 1))::int] end;
        -- About three in four families have joined the parent app.
        if random() < 0.76 and array_length(p_parents, 1) > 1 then
          v_par := v_par + 1;
          v_pid := p_parents[2 + ((v_par - 1) % (array_length(p_parents, 1) - 1))];
          select split_part(full_name, ' ', 3) into v_last from profiles where id = v_pid;
          if coalesce(v_last, '') = '' then v_last := v_lasts[1 + floor(random() * array_length(v_lasts, 1))::int]; end if;
        else
          v_last := v_lasts[1 + floor(random() * array_length(v_lasts, 1))::int];
        end if;
      end if;
      insert into students (school_id, admission_no, first_name, last_name, gender, class_id, status, signin_method, admitted_on, state_of_origin, date_of_birth, user_id, created_at)
      values (p_school, p_prefix || '/' || lpad(v_n::text, 4, '0'), v_first, v_last, v_gender, v_cls.id, 'active',
              case when v_cls.level_order <= 4 then 'pin' else 'own' end, v_start - (365 * (1 + floor(random() * 4)))::int,
              (array['Lagos','Ogun','Oyo','Enugu','Anambra','Imo','Kwara','Edo','Delta','Kano'])[1 + floor(random() * 10)::int],
              v_today - (365 * (3 + v_cls.level_order) + floor(random() * 300))::int,
              case when v_cls.name = 'JSS 2' and v_i = 1 then p_persona_student else null end,
              -- A few joined this term; the rest have been here a while.
              (case when random() < 0.08 then v_start + 3 else v_start - 400 end)::timestamp at time zone 'Africa/Lagos')
      returning id into v_sid;
      insert into enrolments (school_id, student_id, class_id, session_id) values (p_school, v_sid, v_cls.id, v_cur_sess);
      if v_pid is not null then
        insert into guardians (school_id, student_id, user_id, relationship)
        values (p_school, v_sid, v_pid, case when random() < 0.6 then 'mother' else 'father' end) on conflict do nothing;
      end if;
    end loop;
  end loop;
  insert into memberships (school_id, user_id, role)
  select distinct p_school, g.user_id, 'parent'::app_role from guardians g where g.school_id = p_school
  on conflict do nothing;
  if p_persona_student is not null then
    insert into memberships (school_id, user_id, role) values (p_school, p_persona_student, 'student') on conflict do nothing;
  end if;

  -- Timetable for every class: lessons spread over the week.
  for v_cls in select id from classes where school_id = p_school loop
    v_j := 0;
    for v_i in 1 .. 5 loop
      for v_st in select id, starts_at, ends_at, row_number() over (order by starts_at) as rn from school_periods where school_id = p_school and kind = 'lesson' order by starts_at loop
        select id into v_class from class_subjects where class_id = v_cls.id order by id offset ((v_j) % (select count(*) from class_subjects where class_id = v_cls.id)) limit 1;
        insert into timetable_periods (school_id, class_id, class_subject_id, day_of_week, starts_at, ends_at, period_id)
        values (p_school, v_cls.id, v_class, v_i, v_st.starts_at, v_st.ends_at, v_st.id) on conflict do nothing;
        v_j := v_j + 1;
      end loop;
      v_j := v_j + 3;
    end loop;
  end loop;

  -- Scores: last term complete, this term's tests so far.
  for v_st in select s.id, s.class_id from students s where s.school_id = p_school loop
    v_ability := 0.42 + random() * 0.5;
    -- The demo family's children do well (they're the ones shown in pitches).
    if v_st.id = (select id from students where user_id = p_persona_student and school_id = p_school) then v_ability := 0.86; end if;
    if p_persona_parent is not null and exists (select 1 from guardians g where g.student_id = v_st.id and g.user_id = p_persona_parent) and v_ability < 0.8 then v_ability := 0.8; end if;
    for v_cs in select id from class_subjects where class_id = v_st.class_id loop
      insert into scores (school_id, student_id, class_subject_id, term_id, ca1, ca2, ca3, exam)
      values (p_school, v_st.id, v_cs.id, v_prev,
              round(least(10, greatest(2, 10 * (v_ability + (random() - 0.5) * 0.3)))),
              round(least(10, greatest(2, 10 * (v_ability + (random() - 0.5) * 0.3)))),
              round(least(20, greatest(4, 20 * (v_ability + (random() - 0.5) * 0.3)))),
              round(least(60, greatest(12, 60 * (v_ability + (random() - 0.5) * 0.25)))));
      insert into scores (school_id, student_id, class_subject_id, term_id, ca1, ca2, ca3)
      values (p_school, v_st.id, v_cs.id, v_cur,
              round(least(10, greatest(2, 10 * (v_ability + (random() - 0.5) * 0.3)))),
              round(least(10, greatest(2, 10 * (v_ability + (random() - 0.5) * 0.3)))),
              case when random() < 0.55 then round(least(20, greatest(4, 20 * (v_ability + (random() - 0.5) * 0.3)))) else null end);
    end loop;
    insert into result_comments (school_id, student_id, term_id, class_teacher_comment, principal_comment, approved_at, approved_by, ratings)
    values (p_school, v_st.id, v_prev,
            case when v_ability > 0.8 then 'An outstanding term. Keep up the hard work and keep helping your classmates.'
                 when v_ability > 0.62 then 'A good term with steady progress. More reading at home will make a big difference.'
                 else 'Has made an effort this term. Needs to practise more and ask for help when stuck.' end,
            case when v_ability > 0.8 then 'Excellent result. We are proud of you.' when v_ability > 0.62 then 'Good work. Aim higher next term.' else 'You can do better. We will support you.' end,
            v_start - 45, p_principal,
            jsonb_build_object('Punctuality', 3 + floor(random() * 3)::int, 'Attentiveness', 3 + floor(random() * 3)::int, 'Neatness', 3 + floor(random() * 3)::int, 'Politeness', 4 + floor(random() * 2)::int, 'Teamwork', 3 + floor(random() * 3)::int));
    insert into report_cards (school_id, student_id, term_id, class_id, released_at, released_by)
    values (p_school, v_st.id, v_prev, v_st.class_id, v_start - 44, p_principal);
  end loop;
  insert into result_approvals (class_id, term_id, school_id, approved_at, approved_by)
  select id, v_prev, p_school, v_start - 45, p_principal from classes where school_id = p_school;
  insert into score_sheets (class_subject_id, term_id, school_id, submitted_at, submitted_by)
  select cs.id, v_prev, p_school, v_start - 50, cs.teacher_id from class_subjects cs where cs.school_id = p_school;

  -- Fees: last term nearly all paid, this term a realistic mix.
  for v_i in 1 .. 2 loop
    insert into fee_terms (term_id, school_id, due_on, allow_part, published_at)
    values (case when v_i = 1 then v_prev else v_cur end, p_school, case when v_i = 1 then v_start - 110 else v_start + 21 end, true, case when v_i = 1 then v_start - 140 else v_start - 10 end);
    for v_sec in select unnest(array['nursery', 'primary', 'jss', 'ss']) loop
      insert into fee_items (school_id, term_id, name, amount_kobo, section, position)
      values (p_school, case when v_i = 1 then v_prev else v_cur end, 'Tuition', (v_fees ->> v_sec)::bigint, v_sec, 1),
             (p_school, case when v_i = 1 then v_prev else v_cur end, 'Development levy', 1500000, v_sec, 2),
             (p_school, case when v_i = 1 then v_prev else v_cur end, case when v_sec in ('jss', 'ss') then 'ICT and laboratory' else 'Books and materials' end, case when v_sec in ('jss', 'ss') then 2000000 else 1200000 end, v_sec, 3);
    end loop;
  end loop;
  for v_st in select s.id, c.name as cname, exists (select 1 from guardians g where g.student_id = s.id and g.user_id = p_persona_parent) as persona
             from students s join classes c on c.id = s.class_id where s.school_id = p_school loop
    v_sec := case when v_st.cname like 'Nursery%' then 'nursery' when v_st.cname like 'Primary%' then 'primary' when v_st.cname like 'JSS%' then 'jss' else 'ss' end;
    for v_i in 1 .. 2 loop
      select coalesce(sum(amount_kobo), 0) into v_total from fee_items where school_id = p_school and term_id = case when v_i = 1 then v_prev else v_cur end and section = v_sec;
      insert into invoices (school_id, student_id, term_id, total_kobo)
      values (p_school, v_st.id, case when v_i = 1 then v_prev else v_cur end, v_total) returning id into v_class;
      insert into invoice_lines (invoice_id, school_id, fee_item_id, name, amount_kobo, position)
      select v_class, p_school, f.id, f.name, f.amount_kobo, f.position from fee_items f
      where f.school_id = p_school and f.term_id = case when v_i = 1 then v_prev else v_cur end and f.section = v_sec;
      v_roll := case when v_st.persona then (case when v_i = 1 then 0 else 0.6 end) else random() end;
      v_pay := case when v_i = 1 then (case when v_roll < 0.94 then v_total else (v_total * 0.6)::bigint end)
                    else (case when v_roll < 0.52 then v_total when v_roll < 0.8 then ((v_total * (0.4 + random() * 0.3)) / 100000)::bigint * 100000 else 0 end) end;
      v_paid := 0;
      while v_paid < v_pay loop
        v_receipt := v_receipt + 1;
        v_roll := random();
        v_method := case when v_roll < 0.46 then 'paystack' when v_roll < 0.76 then 'transfer' when v_roll < 0.9 then 'cash' else 'pos' end;
        v_total := least(v_pay - v_paid, case when random() < 0.7 then v_pay - v_paid else ((v_pay - v_paid) / 200000)::bigint * 100000 + 100000 end);
        v_day := case when v_i = 1 then v_start - 120 + floor(random() * 60)::int else v_start - 8 + floor(random() * least(60, v_today - v_start + 8))::int end;
        v_ref := upper(p_prefix) || '-' || substr(md5(v_class::text || v_receipt::text), 1, 8);
        insert into payments (school_id, invoice_id, amount_kobo, method, paystack_reference, status, receipt_no, paid_at, created_at, reference, recorded_by, channel, fees_kobo)
        values (p_school, v_class, v_total, v_method,
                case when v_method = 'paystack' then v_ref else null end, 'success', 'RC' || lpad(v_receipt::text, 6, '0'),
                (v_day + time '09:00' + (random() * interval '9 hours')) at time zone 'Africa/Lagos',
                (v_day + time '09:00' + (random() * interval '9 hours')) at time zone 'Africa/Lagos',
                case when v_method = 'transfer' then 'TRF' || substr(md5(v_ref), 1, 10) when v_method = 'pos' then 'POS' || substr(md5(v_ref), 1, 6) else null end,
                case when v_method = 'paystack' then null else p_bursar end,
                case when v_method = 'paystack' then (array['card', 'bank_transfer', 'ussd'])[1 + floor(random() * 3)::int] else null end,
                case when v_method = 'paystack' then least(200000, (v_total * 0.015)::bigint + case when v_total >= 250000 then 10000 else 0 end) else null end);
        v_paid := v_paid + v_total;
      end loop;
    end loop;
  end loop;
  insert into receipt_counters (school_id, last_no) values (p_school, v_receipt) on conflict (school_id) do update set last_no = excluded.last_no;

  -- Attendance for the last three weeks of school days (today partly marked).
  -- (Today always has registers, even at weekends, so the dashboards look alive in a demo.)
  for v_day in select d::date from generate_series(v_start, v_today, interval '1 day') d where extract(isodow from d) < 6 or d::date = v_today loop
    insert into attendance (school_id, student_id, class_id, date, status, recorded_by)
    select p_school, s.id, s.class_id, v_day,
           (case when r < 0.05 then 'absent' when r < 0.09 then 'late' else 'present' end)::attendance_status, c.class_teacher_id
    from (select s.*, random() as r from students s where s.school_id = p_school) s
    join classes c on c.id = s.class_id
    where v_day < v_today or c.level_order % 5 <> 0;
    insert into staff_attendance (school_id, user_id, date, clock_in, clock_out, status, marked_by)
    select p_school, m.user_id, v_day,
           (v_day + time '07:20' + (random() * interval '55 minutes')) at time zone 'Africa/Lagos',
           case when v_day < v_today then (v_day + time '15:00' + (random() * interval '60 minutes')) at time zone 'Africa/Lagos' else null end,
           'present', p_principal
    from (select distinct user_id from memberships where school_id = p_school and role in ('teacher', 'principal', 'bursar')) m
    where random() < 0.95;
  end loop;

  -- Lesson notes for secondary classes: earlier weeks approved, this week waiting for the principal.
  for v_cs in select cs.id, cs.teacher_id, s.name as subj, c.name as cname from class_subjects cs join subjects s on s.id = cs.subject_id join classes c on c.id = cs.class_id
              where cs.school_id = p_school and (c.name like 'JSS%' or c.name like 'SS%' or c.name in ('Primary 5', 'Primary 6')) loop
    for v_i in 1 .. v_week loop
      insert into lesson_notes (school_id, class_subject_id, term_id, week, teacher_id, topic, lesson_date, duration_min, objectives, materials, content, evaluation, status, score, review_comment, reviewed_by, reviewed_at, submitted_at, shared_at)
      values (p_school, v_cs.id, v_cur, v_i, v_cs.teacher_id,
              v_cs.subj || ': ' || (array['Introduction and revision','Key terms and ideas','Worked examples','Practical activity','Problem solving','Applications in daily life','Group work and discussion','Class test and corrections','Extension topics','Mid-term revision','Project work','Review'])[1 + ((v_i - 1) % 12)],
              v_start + (v_i - 1) * 7 + 1, 40,
              'By the end of the lesson, students should be able to explain the main ideas, work through two examples on their own and use the new words correctly.',
              'Textbook, whiteboard, flash cards and the class workbook.',
              'Step 1: Recap last week with three quick questions.' || chr(10) || 'Step 2: Teach the new idea with a local example (market prices in naira, distances in Lagos).' || chr(10) || 'Step 3: Pairs work through the examples on the board.' || chr(10) || 'Step 4: Students try two questions on their own while the teacher moves round the class.',
              'Five short questions in the last ten minutes; collect workbooks for marking.',
              case when v_i < v_week then 'approved' when random() < 0.7 then 'submitted' else 'draft' end,
              case when v_i < v_week then 7 + floor(random() * 4)::int else null end,
              case when v_i < v_week and random() < 0.3 then 'Good use of local examples. Add one more question for the stronger students.' else null end,
              case when v_i < v_week then p_principal else null end,
              case when v_i < v_week then (v_start + (v_i - 1) * 7 - 1)::timestamp at time zone 'Africa/Lagos' else null end,
              (v_start + (v_i - 1) * 7 - 2)::timestamp at time zone 'Africa/Lagos',
              null);
    end loop;
  end loop;

  -- Homework: a few pieces per secondary class, some marked.
  for v_cs in select cs.id, cs.teacher_id, cs.class_id, s.name as subj from class_subjects cs join subjects s on s.id = cs.subject_id join classes c on c.id = cs.class_id
              where cs.school_id = p_school and (c.name like 'JSS%' or c.name like 'SS%') and s.name in ('Mathematics', 'English Language', 'Basic Science', 'Physics', 'Economics') loop
    for v_i in 1 .. 2 loop
      insert into homework (school_id, class_subject_id, term_id, teacher_id, kind, title, instructions, max_marks, due_at, submit_modes, allow_late, attachments, ca_part, created_at)
      values (p_school, v_cs.id, v_cur, v_cs.teacher_id, 'homework',
              case when v_i = 1 then v_cs.subj || ': exercise 4B, questions 1 to 10' else v_cs.subj || ': short essay on this week''s topic' end,
              case when v_i = 1 then 'Show all your working. Write your answers neatly in your exercise book, then take a clear photo.' else 'Write about one page in your own words. Use at least two examples from everyday life.' end,
              10, case when v_i = 1 then (v_today - 4 + time '18:00') at time zone 'Africa/Lagos' else (v_today + 3 + time '18:00') at time zone 'Africa/Lagos' end,
              array['photo', 'text'], true, '[]'::jsonb, 'ca2', (v_today - 9 + v_i * 3)::timestamp at time zone 'Africa/Lagos')
      returning id into v_class;
      if v_i = 1 then
        insert into homework_submissions (homework_id, school_id, student_id, answer, status, submitted_at, submitted_by, score, feedback, marked_at, marked_by)
        select v_class, p_school, s.id, 'My working is in my exercise book. Answers: 1) 12  2) 7.5  3) 40 ...',
               case when random() < 0.7 then 'marked' else 'submitted' end,
               (v_today - 5)::timestamp at time zone 'Africa/Lagos', coalesce(s.user_id, v_cs.teacher_id),
               6 + floor(random() * 5)::int, 'Good working. Check question 3 again.', (v_today - 3)::timestamp at time zone 'Africa/Lagos', v_cs.teacher_id
        from students s where s.class_id = v_cs.class_id and random() < 0.85;
        update homework_submissions set score = null, feedback = null, marked_at = null, marked_by = null where homework_id = v_class and status = 'submitted';
      end if;
    end loop;
  end loop;

  -- Question bank and an open CBT test for JSS 2 Mathematics.
  select s.id into v_sid from subjects s where s.school_id = p_school and s.name = 'Mathematics';
  insert into questions (school_id, subject_id, level, topic, difficulty, body, options, answer, explanation, source, checked, created_by)
  select p_school, v_sid, 'JSS 2', q.topic, q.diff, q.body, q.opts::jsonb, q.ans, q.expl, 'manual', true, p_teachers[1]
  from (values
    ('Fractions', 'easy', 'What is 3/4 of 120?', '["80","90","100","60"]', 1, '120 ÷ 4 = 30, and 30 × 3 = 90.'),
    ('Percentages', 'easy', 'A shirt costs ₦8,000. It is reduced by 25%. What is the new price?', '["₦6,000","₦6,500","₦2,000","₦7,750"]', 0, '25% of ₦8,000 is ₦2,000, so the new price is ₦6,000.'),
    ('Algebra', 'medium', 'Solve for x: 3x + 5 = 20', '["3","5","15","25/3"]', 1, '3x = 15, so x = 5.'),
    ('Algebra', 'medium', 'Simplify 4a + 3b − a + 2b', '["3a + 5b","5a + 5b","3a + b","4a + 6b"]', 0, 'Collect like terms: 4a − a = 3a and 3b + 2b = 5b.'),
    ('Geometry', 'easy', 'How many degrees are there in a right angle?', '["45","90","180","360"]', 1, 'A right angle is a quarter turn: 90 degrees.'),
    ('Geometry', 'medium', 'The angles of a triangle are 50° and 60°. What is the third angle?', '["70°","80°","90°","110°"]', 0, 'Angles in a triangle add up to 180°: 180 − 50 − 60 = 70.'),
    ('Number', 'easy', 'Write 0.75 as a percentage.', '["7.5%","75%","0.75%","750%"]', 1, 'Multiply by 100: 0.75 × 100 = 75%.'),
    ('Number', 'medium', 'What is the LCM of 6 and 8?', '["12","24","48","14"]', 1, 'Multiples of 8: 8, 16, 24. 24 is also a multiple of 6.'),
    ('Ratio', 'medium', 'Share ₦12,000 between Ada and Emeka in the ratio 1 : 3. How much does Emeka get?', '["₦3,000","₦4,000","₦8,000","₦9,000"]', 3, '4 parts make ₦12,000, so 1 part is ₦3,000 and Emeka gets 3 parts.'),
    ('Statistics', 'hard', 'The mean of 4, 7, 9 and x is 7. What is x?', '["6","7","8","9"]', 2, '4 numbers with mean 7 add up to 28; 4 + 7 + 9 = 20, so x = 8.')
  ) as q(topic, diff, body, opts, ans, expl);
  insert into cbt_tests (school_id, subject_id, term_id, level, title, teacher_id, class_ids, practice, duration_min, opens_at, closes_at, question_ids, marks_each, shuffle, show_score, ca_part)
  select p_school, v_sid, v_cur, 'JSS 2', 'Mathematics: mid-term test', p_teachers[1], array[c.id], false, 30,
         now() - interval '1 day', now() + interval '6 days',
         (select array_agg(id order by created_at) from questions where school_id = p_school and level = 'JSS 2'), 2, true, true, 'ca3'
  from classes c where c.school_id = p_school and c.name = 'JSS 2';
  insert into cbt_tests (school_id, subject_id, term_id, level, title, teacher_id, class_ids, practice, duration_min, opens_at, closes_at, question_ids, marks_each, shuffle, show_score, ca_part)
  select p_school, v_sid, v_cur, 'JSS 2', 'Practice: fractions and percentages', p_teachers[1], array[c.id], true, 15,
         now() - interval '10 days', now() + interval '20 days',
         (select array_agg(id order by created_at) from (select id, created_at from questions where school_id = p_school and level = 'JSS 2' order by created_at limit 4) q), 1, true, true, 'ca1'
  from classes c where c.school_id = p_school and c.name = 'JSS 2';

  -- Announcements.
  insert into announcements (school_id, title, body, audience, created_by, created_at, kind, event_at, reach, emailed, dispatched_at)
  values
    (p_school, 'Inter-house sports day', 'Our inter-house sports day holds on the school field. Students should come in their house colours. Parents are welcome from 9am. Please let us know if you are coming.', 'school', p_principal, now() - interval '3 days', 'event', (v_today + 9 + time '09:00') at time zone 'Africa/Lagos', 0, 0, now() - interval '3 days'),
    (p_school, 'PTA meeting this Saturday', 'The termly PTA meeting holds in the school hall at 10am. We will discuss the new school bus routes and the end-of-term party.', 'parents', p_principal, now() - interval '6 days', 'event', (v_today + 2 + time '10:00') at time zone 'Africa/Lagos', 0, 0, now() - interval '6 days'),
    (p_school, 'Mid-term break', 'Mid-term break starts on Thursday. School resumes on Monday at 7:30am. Enjoy the break and keep reading!', 'school', p_principal, now() - interval '12 days', 'notice', null, 0, 0, now() - interval '12 days'),
    (p_school, 'Staff briefing moved to 2pm', 'Tomorrow''s staff briefing is at 2pm in the staff room. Please bring your lesson note files.', 'staff', p_principal, now() - interval '1 day', 'notice', null, 0, 0, now() - interval '1 day');
  update announcements a set reach = (select count(*) from memberships m where m.school_id = a.school_id and (a.audience = 'school' or (a.audience = 'parents' and m.role = 'parent') or (a.audience = 'staff' and m.role in ('teacher','principal','bursar','admin','owner')))) where a.school_id = p_school;
  insert into announcement_reads (announcement_id, user_id, read_at)
  select a.id, m.user_id, a.created_at + interval '2 hours' from announcements a join memberships m on m.school_id = a.school_id
  where a.school_id = p_school and random() < 0.62 and (a.audience = 'school' or (a.audience = 'parents' and m.role = 'parent') or (a.audience = 'staff' and m.role in ('teacher','principal','bursar')))
  on conflict do nothing;
  insert into announcement_rsvps (announcement_id, user_id, going)
  select a.id, r.user_id, random() < 0.8 from announcements a join announcement_reads r on r.announcement_id = a.id where a.school_id = p_school and a.kind = 'event' and random() < 0.5
  on conflict do nothing;

  -- Admissions from the school website.
  insert into admission_applications (school_id, child_name, date_of_birth, class_applied, parent_name, parent_phone, parent_email, gender, previous_school, notes, created_at)
  values
    (p_school, 'Daniel Ajayi', v_today - 365 * 10, 'JSS 1', 'Mrs Bukola Ajayi', '08031234501', 'bukola.ajayi@example.com', 'male', 'Sunshine Primary School', 'Interested in the science club.', now() - interval '2 days'),
    (p_school, 'Hauwa Garba', v_today - 365 * 4, 'Nursery 2', 'Mr Ahmed Garba', '08031234502', null, 'female', null, null, now() - interval '5 days'),
    (p_school, 'Chioma Nwankwo', v_today - 365 * 12, 'JSS 2', 'Mr Peter Nwankwo', '08031234503', 'p.nwankwo@example.com', 'female', 'Corona School', 'Moving from Abuja in January.', now() - interval '9 days'),
    (p_school, 'Femi Adewale', v_today - 365 * 7, 'Primary 3', 'Mrs Lola Adewale', '08031234504', 'lola.adewale@example.com', 'male', 'Little Steps', null, now() - interval '14 days'),
    (p_school, 'Zara Bello', v_today - 365 * 15, 'SS 1', 'Dr Hassan Bello', '08031234505', 'hbello@example.com', 'female', 'Queens College', 'Wants the science class.', now() - interval '20 days'),
    (p_school, 'Michael Etim', v_today - 365 * 6, 'Primary 1', 'Mrs Grace Etim', '08031234506', null, 'male', null, null, now() - interval '25 days');
  update admission_applications set status = 'assessment', assessment_at = (v_today + 4 + time '10:00') at time zone 'Africa/Lagos' where school_id = p_school and child_name in ('Chioma Nwankwo', 'Femi Adewale');
  update admission_applications set status = 'offer' where school_id = p_school and child_name = 'Zara Bello';
  update admission_applications set status = 'declined', admin_notes = 'No space in Primary 1 this term; added to next term''s list.' where school_id = p_school and child_name = 'Michael Etim';

  -- Payroll: last month approved, this month waiting for approval.
  insert into pay_structures (school_id, name, basic_kobo, allowances, deductions) values
    (p_school, 'Teacher (graduate)', 12000000, '[{"name":"Housing","kobo":3000000},{"name":"Transport","kobo":1500000}]', '[]'),
    (p_school, 'Senior teacher', 16000000, '[{"name":"Housing","kobo":4000000},{"name":"Transport","kobo":2000000},{"name":"Responsibility","kobo":1500000}]', '[]'),
    (p_school, 'Head of school', 28000000, '[{"name":"Housing","kobo":7000000},{"name":"Transport","kobo":3000000}]', '[]');
  insert into payroll_settings (school_id, pension_on, pension_staff_pct, pension_employer_pct, paye_on, tax_state)
  values (p_school, true, 8, 10, true, 'Lagos') on conflict (school_id) do nothing;
  insert into staff_pay (school_id, user_id, structure_id, job_title, bank_name, account_no, account_name)
  select p_school, m.user_id,
         (select id from pay_structures where school_id = p_school and name = case when m.role = 'principal' then 'Head of school' when m.senior then 'Senior teacher' else 'Teacher (graduate)' end limit 1),
         case when m.role = 'principal' then 'Principal' when m.role = 'bursar' then 'Bursar' else 'Teacher' end,
         (array['GTBank','Access Bank','Zenith Bank','First Bank','UBA'])[1 + floor(random() * 5)::int], lpad((floor(random() * 9999999999))::bigint::text, 10, '0'), upper(p.full_name)
  from (select x.*, random() < 0.3 as senior from (select distinct on (user_id) user_id, role from memberships where school_id = p_school and role in ('teacher', 'principal', 'bursar') order by user_id, role) x) m
  join profiles p on p.id = m.user_id
  on conflict do nothing;
  for v_i in 1 .. 2 loop
    insert into payroll_runs (school_id, month, status, created_at)
    values (p_school, (date_trunc('month', v_today) - case when v_i = 1 then interval '1 month' else interval '0' end)::date, 'draft', now() - interval '5 days') returning id into v_class;
    insert into payslips (run_id, school_id, user_id, name, job_title, basic_kobo, allowances, deductions, gross_kobo, pension_kobo, employer_pension_kobo, paye_kobo, net_kobo, bank_name, account_no, account_name)
    select v_class, p_school, sp.user_id, p.full_name, sp.job_title, ps.basic_kobo, ps.allowances, '[]'::jsonb,
           ps.basic_kobo + (select coalesce(sum((x ->> 'kobo')::bigint), 0) from jsonb_array_elements(ps.allowances) x),
           round(ps.basic_kobo * 0.08), round(ps.basic_kobo * 0.10), round((ps.basic_kobo + (select coalesce(sum((x ->> 'kobo')::bigint), 0) from jsonb_array_elements(ps.allowances) x)) * 0.06),
           ps.basic_kobo + (select coalesce(sum((x ->> 'kobo')::bigint), 0) from jsonb_array_elements(ps.allowances) x) - round(ps.basic_kobo * 0.08) - round((ps.basic_kobo + (select coalesce(sum((x ->> 'kobo')::bigint), 0) from jsonb_array_elements(ps.allowances) x)) * 0.06),
           sp.bank_name, sp.account_no, sp.account_name
    from staff_pay sp join pay_structures ps on ps.id = sp.structure_id join profiles p on p.id = sp.user_id
    where sp.school_id = p_school;
    if v_i = 1 then update payroll_runs set status = 'approved', approved_by = p_principal, approved_at = now() - interval '4 days' where id = v_class; end if;
  end loop;

  -- School website news.
  insert into website_posts (school_id, kind, title, body, published_at) values
    (p_school, 'news', 'Our students win the Lagos State maths quiz', 'Three of our JSS 2 students won first place at the Lagos State inter-school mathematics quiz. Congratulations to the team and their teachers!', now() - interval '8 days'),
    (p_school, 'news', 'New science laboratory opens', 'Our new science laboratory is now open for JSS and SS students, with equipment for physics, chemistry and biology practicals.', now() - interval '30 days'),
    (p_school, 'news', 'Admissions open for next term', 'Admissions are open for Nursery to SS 1. Apply online on this website or visit the school office.', now() - interval '40 days');

  -- A parent's absence report for tomorrow.
  if p_persona_parent is not null then
    insert into absence_reports (school_id, student_id, from_date, to_date, reason, note, reported_by)
    select p_school, s.id, v_today + 1, v_today + 1, 'unwell', 'Dental appointment in the morning. He will come in after break.', p_persona_parent
    from students s where s.school_id = p_school and s.user_id = p_persona_student;
  end if;
end $fn$;

-- Wipes and rebuilds the demo group. Server only. p holds the demo people's ids:
-- owner, principal, principal2, bursar, finance, student, teachers[], teachers2[], parents[], parents2[].
create or replace function public.demo_reset(p jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $fn$
declare
  v_owner uuid := (p ->> 'owner')::uuid;
  v_t uuid[] := array(select x::uuid from jsonb_array_elements_text(p -> 'teachers') x);
  v_t2 uuid[] := array(select x::uuid from jsonb_array_elements_text(p -> 'teachers2') x);
  v_par uuid[] := array(select x::uuid from jsonb_array_elements_text(p -> 'parents') x);
  v_par2 uuid[] := array(select x::uuid from jsonb_array_elements_text(p -> 'parents2') x);
  v_group uuid; v_lekki uuid; v_ajah uuid; v_u uuid;
begin
  -- Approved payroll can't be deleted, so step it back first.
  update payroll_runs set status = 'draft' where school_id in (select id from schools where is_demo);
  -- Rows with an activity log go first, while their school still exists.
  delete from payments where school_id in (select id from schools where is_demo);
  delete from scores where school_id in (select id from schools where is_demo);
  delete from staff_attendance where school_id in (select id from schools where is_demo);
  delete from payroll_runs where school_id in (select id from schools where is_demo);
  delete from school_payouts where school_id in (select id from schools where is_demo);
  delete from schools where is_demo;
  delete from school_groups g where g.created_by = v_owner and not exists (select 1 from schools s where s.group_id = g.id);

  insert into school_groups (name, created_by) values ('Bright Future Schools', v_owner) returning id into v_group;
  insert into schools (name, slug, group_id, address, phone, email, about, motto, principal_name, primary_color, secondary_color, plan, is_demo, capacity, website, staff_late_after, payments_approved_at, check_status)
  values ('Bright Future Academy, Lekki', 'demo', v_group, '14 Admiralty Way, Lekki Phase 1, Lagos', '0803 555 0101', 'hello@brightfuture.example.com',
          'Bright Future Academy is a nursery, primary and secondary school in Lekki, Lagos. We help every child grow in confidence, character and learning, with small classes, caring teachers and strong links with parents.',
          'Knowledge, Character, Service', 'Mr Babatunde Adeyemi', '#1D4ED8', '#9A3412', 'group', true, 180,
          jsonb_build_object('headline', 'Where every child shines', 'intro', 'Nursery, primary and secondary school in Lekki, Lagos. Small classes, caring teachers and parents kept in the loop.', 'admissions_open', true, 'admission_classes', jsonb_build_array('Nursery 1','Nursery 2','Primary 1','JSS 1','SS 1'), 'pages', jsonb_build_object('gallery', false), 'highlights', jsonb_build_array(jsonb_build_object('title','Strong results','text','Our students passed WAEC with 94% credits in English and Mathematics last year.'), jsonb_build_object('title','Science and technology','text','New laboratories, a computer room and a coding club from Primary 4.'), jsonb_build_object('title','Parents kept in the loop','text','Attendance, results, fees and school news on your phone with Simpliskool.'))), '07:45', now(), 'approved')
  returning id into v_lekki;
  insert into schools (name, slug, group_id, address, phone, email, about, motto, principal_name, primary_color, secondary_color, plan, is_demo, capacity, staff_late_after, payments_approved_at, check_status)
  values ('Bright Future Academy, Ajah', 'demo-ajah', v_group, '3 Addo Road, Ajah, Lagos', '0803 555 0202', 'ajah@brightfuture.example.com',
          'Our Ajah branch offers nursery and primary education with the same warm, high standards as Lekki.',
          'Knowledge, Character, Service', 'Mrs Funke Alabi', '#1D4ED8', '#9A3412', 'group', true, 80, '07:45', now(), 'approved')
  returning id into v_ajah;
  update schools set sms_credit = 2400 where id in (v_lekki, v_ajah);

  -- Who works where.
  insert into memberships (school_id, user_id, role) values
    (v_lekki, v_owner, 'owner'), (v_ajah, v_owner, 'owner'),
    (v_lekki, (p ->> 'principal')::uuid, 'principal'), (v_ajah, (p ->> 'principal2')::uuid, 'principal'),
    (v_lekki, (p ->> 'bursar')::uuid, 'bursar'), (v_ajah, (p ->> 'bursar')::uuid, 'bursar');
  foreach v_u in array v_t loop insert into memberships (school_id, user_id, role) values (v_lekki, v_u, 'teacher'); end loop;
  foreach v_u in array v_t2 loop insert into memberships (school_id, user_id, role) values (v_ajah, v_u, 'teacher'); end loop;
  insert into group_members (group_id, user_id, role) values (v_group, v_owner, 'proprietor') on conflict do nothing;
  if p ->> 'finance' is not null then
    insert into group_members (group_id, user_id, role, invited_by) values (v_group, (p ->> 'finance')::uuid, 'finance', v_owner) on conflict do nothing;
  end if;

  perform public.demo_fill(v_lekki, array['Nursery 1','Nursery 2','Primary 1','Primary 2','Primary 3','Primary 4','Primary 5','Primary 6','JSS 1','JSS 2','JSS 3','SS 1','SS 2','SS 3'],
                           v_t, v_par, 9, 'BFA', (p ->> 'principal')::uuid, (p ->> 'bursar')::uuid, v_par[1], (p ->> 'student')::uuid);
  perform public.demo_fill(v_ajah, array['Nursery 1','Nursery 2','Primary 1','Primary 2','Primary 3','Primary 4','Primary 5','Primary 6'],
                           v_t2, v_par2, 6, 'BFAJ', (p ->> 'principal2')::uuid, (p ->> 'bursar')::uuid, null, null);

  -- A support request the owner opened, already answered.
  insert into support_tickets (school_id, opened_by, subject, priority, status, last_from, created_at, updated_at)
  values (v_lekki, v_owner, 'How do I add a second bursar?', 'normal', 'open', 'team', now() - interval '2 days', now() - interval '1 day');
  insert into support_messages (ticket_id, author_id, author_name, from_team, body, created_at)
  select t.id, v_owner, 'Mrs Adaeze Okonkwo', false, 'Our new bursar starts on Monday. How do I give her access but keep the old one for two weeks?', now() - interval '2 days'
  from support_tickets t where t.school_id = v_lekki;
  insert into support_messages (ticket_id, author_name, from_team, body, created_at)
  select t.id, 'Simpliskool support', true, 'Go to Settings → Admins and roles, enter her phone number and choose Bursar. Both bursars can work side by side; remove the old one whenever you are ready.', now() - interval '1 day'
  from support_tickets t where t.school_id = v_lekki;

  return jsonb_build_object('group', v_group, 'lekki', v_lekki, 'ajah', v_ajah,
    'students', (select count(*) from students where school_id in (v_lekki, v_ajah)));
end $fn$;

-- The back office leaves the demo schools out of its figures.
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
  left join school_payouts p on p.school_id = s.id
  where not coalesce(s.is_demo, false);
$fn$;

-- ===========================================================================
-- Permissions (same as 0018), so 0008 doesn't need to be run again.
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
                            'guard_school_columns', 'school_defaults', 'payout_changed', 'audit_locked') then
      execute format('grant execute on function %s to authenticated', f.sig);
    end if;
  end loop;
end $grants$;
grant execute on function public.admissions_open(uuid) to anon;
grant execute on function public.is_school_admin(uuid) to anon;
revoke update, delete, truncate on public.platform_audit from authenticated, anon, service_role;
