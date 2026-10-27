-- Dashboard summaries, one round trip per portal home.
-- All four functions run as the signed-in user (security invoker), so row-level security
-- still decides what each person can count. "Today" is the date in Lagos.

create or replace function public.lagos_today()
returns date language sql stable as $$
  select (now() at time zone 'Africa/Lagos')::date;
$$;

-- "JSS 2" + "A" -> "JSS 2A"; "Primary 4" + "Gold" -> "Primary 4 Gold".
create or replace function public.class_label(p_name text, p_arm text)
returns text language sql immutable as $$
  select trim(coalesce(p_name, '') || case when length(coalesce(p_arm, '')) <= 2 then '' else ' ' end || coalesce(p_arm, ''));
$$;

-- The school's current term, or null.
create or replace function public.current_term(p_school uuid)
returns table (id uuid, term_no smallint, session_name text, starts_on date, ends_on date)
language sql stable security invoker set search_path = public as $$
  select t.id, t.term_no, s.name, t.starts_on, t.ends_on
  from terms t join academic_sessions s on s.id = t.session_id
  where t.school_id = p_school and t.is_current
  order by s.starts_on desc nulls last
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- Owner, admin, principal and bursar
-- ---------------------------------------------------------------------------
create or replace function public.admin_dashboard(p_school uuid)
returns jsonb language plpgsql stable security invoker set search_path = public as $$
declare
  v_today date := public.lagos_today();
  v_monday date := v_today - (extract(isodow from v_today)::int - 1);
  v_term record;
  v_out jsonb;
begin
  if not public.has_role(p_school, array['owner', 'admin', 'principal', 'bursar']::public.app_role[]) then
    return null;
  end if;
  select * into v_term from public.current_term(p_school);

  select jsonb_build_object(
    'today', v_today,
    'term', case when v_term.id is null then null else jsonb_build_object(
      'term_no', v_term.term_no, 'session', v_term.session_name,
      'week', case when v_term.starts_on is null then null
                   else greatest(1, ((v_today - v_term.starts_on) / 7) + 1) end) end,
    'students', (select count(*) from students where school_id = p_school and status = 'active'),
    'new_students', (select count(*) from students where school_id = p_school and status = 'active'
                       and v_term.starts_on is not null and created_at >= v_term.starts_on),
    'classes', (select count(*) from classes where school_id = p_school),
    'classes_marked', (select count(distinct class_id) from attendance where school_id = p_school and date = v_today),
    'unmarked_classes', coalesce((select jsonb_agg(public.class_label(c.name, c.arm) order by c.level_order, c.name, c.arm)
                          from classes c
                          where c.school_id = p_school
                            and exists (select 1 from students s where s.class_id = c.id and s.status = 'active')
                            and not exists (select 1 from attendance a where a.class_id = c.id and a.date = v_today)), '[]'::jsonb),
    'present', (select count(*) from attendance where school_id = p_school and date = v_today and status in ('present', 'late')),
    'marked', (select count(*) from attendance where school_id = p_school and date = v_today),
    'week', (select jsonb_agg(jsonb_build_object(
                'date', d::date,
                'present', (select count(*) from attendance a where a.school_id = p_school and a.date = d::date and a.status in ('present', 'late')),
                'marked', (select count(*) from attendance a where a.school_id = p_school and a.date = d::date)) order by d)
             from generate_series(v_monday, v_monday + 4, interval '1 day') d),
    'fees', (select jsonb_build_object('total', coalesce(sum(total_kobo), 0), 'paid', coalesce(sum(paid_kobo), 0),
                                       'owing', count(*) filter (where balance_kobo > 0),
                                       'owing_half', count(*) filter (where total_kobo > 0 and paid_kobo * 2 < total_kobo))
             from invoices where school_id = p_school and term_id = v_term.id),
    'fee_by_class', coalesce((select jsonb_agg(x order by x->>'order', x->>'name')
             from (select jsonb_build_object('name', public.class_label(c.name, c.arm), 'order', lpad(c.level_order::text, 6, '0'),
                                             'total', sum(i.total_kobo), 'paid', sum(i.paid_kobo)) x
                   from invoices i join students s on s.id = i.student_id join classes c on c.id = s.class_id
                   where i.school_id = p_school and i.term_id = v_term.id
                   group by c.id, c.name, c.arm, c.level_order) q), '[]'::jsonb),
    'subject_classes', (select count(*) from class_subjects where school_id = p_school),
    'subject_classes_scored', (select count(distinct sc.class_subject_id) from scores sc
                                where sc.school_id = p_school and sc.term_id = v_term.id),
    'new_applications', (select count(*) from admission_applications where school_id = p_school and status = 'new'),
    'setup', jsonb_build_object(
      'session', exists (select 1 from terms where school_id = p_school and is_current),
      'classes', exists (select 1 from classes where school_id = p_school),
      'subjects', exists (select 1 from subjects where school_id = p_school),
      'fees', exists (select 1 from fee_items where school_id = p_school),
      'staff', exists (select 1 from memberships where school_id = p_school and role in ('teacher', 'bursar', 'principal', 'admin')),
      'students', exists (select 1 from students where school_id = p_school)),
    'payments', coalesce((select jsonb_agg(p order by p->>'at' desc) from (
        select jsonb_build_object('name', s.first_name || ' ' || s.last_name,
                                  'class', public.class_label(c.name, c.arm),
                                  'method', pay.method, 'amount', pay.amount_kobo, 'at', coalesce(pay.paid_at, pay.created_at)) p
        from payments pay join invoices i on i.id = pay.invoice_id join students s on s.id = i.student_id
        left join classes c on c.id = s.class_id
        where pay.school_id = p_school and pay.status = 'success'
        order by coalesce(pay.paid_at, pay.created_at) desc limit 4) q), '[]'::jsonb),
    'announcements', coalesce((select jsonb_agg(a order by a->>'at' desc) from (
        select jsonb_build_object('title', title, 'audience', audience, 'at', created_at) a
        from announcements where school_id = p_school order by created_at desc limit 3) q), '[]'::jsonb)
  ) into v_out;
  return v_out;
end;
$$;

-- ---------------------------------------------------------------------------
-- Teachers
-- ---------------------------------------------------------------------------
create or replace function public.teacher_dashboard(p_school uuid)
returns jsonb language plpgsql stable security invoker set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_today date := public.lagos_today();
  v_dow int := extract(isodow from public.lagos_today())::int;
  v_term record;
  v_out jsonb;
begin
  if not public.has_role(p_school, array['teacher']::public.app_role[]) then
    return null;
  end if;
  select * into v_term from public.current_term(p_school);

  select jsonb_build_object(
    'today', v_today,
    'term', case when v_term.id is null then null else jsonb_build_object(
      'term_no', v_term.term_no, 'session', v_term.session_name,
      'week', case when v_term.starts_on is null then null
                   else greatest(1, ((v_today - v_term.starts_on) / 7) + 1) end) end,
    'lessons', coalesce((select jsonb_agg(l order by l->>'starts') from (
        select jsonb_build_object('starts', to_char(tp.starts_at, 'HH24:MI'), 'ends', to_char(tp.ends_at, 'HH24:MI'),
                                  'subject', coalesce(sub.name, tp.label, 'Lesson'),
                                  'class', public.class_label(c.name, c.arm)) l
        from timetable_periods tp
        join classes c on c.id = tp.class_id
        left join class_subjects cs on cs.id = tp.class_subject_id
        left join subjects sub on sub.id = cs.subject_id
        where tp.school_id = p_school and tp.day_of_week = v_dow
          and (cs.teacher_id = v_me or (tp.class_subject_id is null and c.class_teacher_id = v_me))) q), '[]'::jsonb),
    'form_classes', coalesce((select jsonb_agg(f order by f->>'name') from (
        select jsonb_build_object('id', c.id, 'name', public.class_label(c.name, c.arm),
          'students', (select count(*) from students s where s.class_id = c.id and s.status = 'active'),
          'marked', (select count(*) from attendance a where a.class_id = c.id and a.date = v_today),
          'present', (select count(*) from attendance a where a.class_id = c.id and a.date = v_today and a.status = 'present'),
          'absent', (select count(*) from attendance a where a.class_id = c.id and a.date = v_today and a.status = 'absent'),
          'late', (select count(*) from attendance a where a.class_id = c.id and a.date = v_today and a.status = 'late')) f
        from classes c where c.school_id = p_school and c.class_teacher_id = v_me) q), '[]'::jsonb),
    'scores', coalesce((select jsonb_agg(s order by s->>'class', s->>'subject') from (
        select jsonb_build_object('subject', sub.name, 'class', public.class_label(c.name, c.arm),
          'students', (select count(*) from students st where st.class_id = c.id and st.status = 'active'),
          'entered', (select count(*) from scores sc where sc.class_subject_id = cs.id and sc.term_id = v_term.id
                        and (sc.ca1 is not null or sc.ca2 is not null or sc.exam is not null))) s
        from class_subjects cs join classes c on c.id = cs.class_id join subjects sub on sub.id = cs.subject_id
        where cs.school_id = p_school and cs.teacher_id = v_me) q), '[]'::jsonb),
    'announcements', coalesce((select jsonb_agg(a order by a->>'at' desc) from (
        select jsonb_build_object('title', title, 'at', created_at) a
        from announcements where school_id = p_school and audience in ('school', 'staff')
        order by created_at desc limit 2) q), '[]'::jsonb)
  ) into v_out;
  return v_out;
end;
$$;

-- ---------------------------------------------------------------------------
-- Parents
-- ---------------------------------------------------------------------------
create or replace function public.parent_dashboard(p_school uuid)
returns jsonb language plpgsql stable security invoker set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_today date := public.lagos_today();
  v_term record;
  v_out jsonb;
begin
  if not public.has_role(p_school, array['parent']::public.app_role[]) then
    return null;
  end if;
  select * into v_term from public.current_term(p_school);

  select jsonb_build_object(
    'today', v_today,
    'term', case when v_term.id is null then null else jsonb_build_object('term_no', v_term.term_no, 'session', v_term.session_name) end,
    'children', coalesce((select jsonb_agg(k order by k->>'first_name') from (
        select jsonb_build_object(
          'id', s.id, 'first_name', s.first_name, 'last_name', s.last_name,
          'class', public.class_label(c.name, c.arm),
          'today', (select a.status from attendance a where a.student_id = s.id and a.date = v_today),
          'fee_total', (select i.total_kobo from invoices i where i.student_id = s.id and i.term_id = v_term.id),
          'fee_paid', (select i.paid_kobo from invoices i where i.student_id = s.id and i.term_id = v_term.id),
          'att_days', (select count(*) from attendance a where a.student_id = s.id
                         and (v_term.starts_on is null or a.date >= v_term.starts_on)),
          'att_present', (select count(*) from attendance a where a.student_id = s.id and a.status in ('present', 'late')
                         and (v_term.starts_on is null or a.date >= v_term.starts_on)),
          'average', (select round(avg(sc.total), 1) from scores sc where sc.student_id = s.id and sc.term_id = v_term.id)) k
        from guardians g join students s on s.id = g.student_id left join classes c on c.id = s.class_id
        where g.school_id = p_school and g.user_id = v_me) q), '[]'::jsonb),
    'announcements', coalesce((select jsonb_agg(a order by a->>'at' desc) from (
        select jsonb_build_object('title', title, 'body', left(body, 160), 'at', created_at) a
        from announcements where school_id = p_school and audience in ('school', 'parents')
        order by created_at desc limit 2) q), '[]'::jsonb)
  ) into v_out;
  return v_out;
end;
$$;

-- ---------------------------------------------------------------------------
-- Students
-- ---------------------------------------------------------------------------
create or replace function public.student_dashboard(p_school uuid)
returns jsonb language plpgsql stable security invoker set search_path = public as $$
declare
  v_today date := public.lagos_today();
  v_dow int := extract(isodow from public.lagos_today())::int;
  v_term record;
  v_me record;
  v_out jsonb;
begin
  select s.id, s.first_name, s.last_name, s.class_id, public.class_label(c.name, c.arm) as class_name
    into v_me
  from students s left join classes c on c.id = s.class_id
  where s.school_id = p_school and s.user_id = auth.uid()
  limit 1;
  if v_me.id is null then
    return null;
  end if;
  select * into v_term from public.current_term(p_school);

  select jsonb_build_object(
    'today', v_today,
    'first_name', v_me.first_name, 'last_name', v_me.last_name, 'class', v_me.class_name,
    'lessons', coalesce((select jsonb_agg(l order by l->>'starts') from (
        select jsonb_build_object('starts', to_char(tp.starts_at, 'HH24:MI'), 'ends', to_char(tp.ends_at, 'HH24:MI'),
                                  'subject', coalesce(sub.name, tp.label, 'Lesson')) l
        from timetable_periods tp
        left join class_subjects cs on cs.id = tp.class_subject_id
        left join subjects sub on sub.id = cs.subject_id
        where tp.class_id = v_me.class_id and tp.day_of_week = v_dow) q), '[]'::jsonb),
    'average', (select round(avg(sc.total), 1) from scores sc where sc.student_id = v_me.id and sc.term_id = v_term.id),
    'att_days', (select count(*) from attendance a where a.student_id = v_me.id and (v_term.starts_on is null or a.date >= v_term.starts_on)),
    'att_present', (select count(*) from attendance a where a.student_id = v_me.id and a.status in ('present', 'late')
                      and (v_term.starts_on is null or a.date >= v_term.starts_on)),
    'announcements', coalesce((select jsonb_agg(a order by a->>'at' desc) from (
        select jsonb_build_object('title', title, 'at', created_at) a
        from announcements where school_id = p_school
          and (audience = 'school' or (audience = 'class' and class_id = v_me.class_id))
        order by created_at desc limit 2) q), '[]'::jsonb)
  ) into v_out;
  return v_out;
end;
$$;

revoke all on function public.admin_dashboard(uuid), public.teacher_dashboard(uuid),
  public.parent_dashboard(uuid), public.student_dashboard(uuid), public.current_term(uuid) from public, anon;
grant execute on function public.admin_dashboard(uuid), public.teacher_dashboard(uuid),
  public.parent_dashboard(uuid), public.student_dashboard(uuid), public.current_term(uuid), public.lagos_today(), public.class_label(text, text) to authenticated;
