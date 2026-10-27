-- Admin setup: sessions and terms, staff list.

-- Only one current session and one current term per school.
-- (Clear any duplicates first so the indexes can be created.)
update public.academic_sessions s set is_current = false
where is_current and exists (
  select 1 from public.academic_sessions o
  where o.school_id = s.school_id and o.is_current and o.id <> s.id and o.name > s.name);
update public.terms t set is_current = false
where is_current and exists (
  select 1 from public.terms o
  where o.school_id = t.school_id and o.is_current and o.id <> t.id
    and (o.session_id, o.term_no) > (t.session_id, t.term_no));
create unique index if not exists academic_sessions_one_current on public.academic_sessions (school_id) where is_current;
create unique index if not exists terms_one_current on public.terms (school_id) where is_current;

-- Make a term (and its session) the current one for the whole school.
create or replace function public.set_current_term(p_term uuid)
returns void language plpgsql security definer set search_path = public as $$
declare t terms%rowtype;
begin
  select * into t from terms where id = p_term;
  if not found then raise exception 'Term not found'; end if;
  if not public.is_school_admin(t.school_id) then
    raise exception 'You do not have permission to change the current term';
  end if;
  update terms set is_current = false where school_id = t.school_id and is_current and id <> t.id;
  update academic_sessions set is_current = false where school_id = t.school_id and is_current and id <> t.session_id;
  update academic_sessions set is_current = true where id = t.session_id;
  update terms set is_current = true where id = t.id;
  insert into audit_log (school_id, actor_id, action, table_name, record_id, details)
  values (t.school_id, auth.uid(), 'SET_CURRENT_TERM', 'terms', t.id, null);
end $$;
revoke all on function public.set_current_term(uuid) from public, anon;
grant execute on function public.set_current_term(uuid) to authenticated;

-- Create a session with its three terms in one go.
-- p_terms: [{"term_no":1,"starts_on":"2026-09-14","ends_on":"2026-12-11"}, ...]
create or replace function public.create_session(p_school uuid, p_name text, p_terms jsonb, p_current_term smallint default null)
returns uuid language plpgsql security invoker set search_path = public as $$
declare
  v_session uuid;
  v_term uuid;
  t jsonb;
  v_start date;
  v_end date;
begin
  if not public.is_school_admin(p_school) then
    raise exception 'You do not have permission to add sessions';
  end if;
  select min((x->>'starts_on')::date), max((x->>'ends_on')::date) into v_start, v_end
  from jsonb_array_elements(p_terms) x;

  insert into academic_sessions (school_id, name, starts_on, ends_on, is_current)
  values (p_school, trim(p_name), v_start, v_end, false)
  returning id into v_session;

  for t in select * from jsonb_array_elements(p_terms) loop
    insert into terms (school_id, session_id, term_no, starts_on, ends_on, is_current)
    values (p_school, v_session, (t->>'term_no')::smallint, nullif(t->>'starts_on', '')::date, nullif(t->>'ends_on', '')::date, false)
    returning id into v_term;
    if p_current_term is not null and (t->>'term_no')::smallint = p_current_term then
      perform public.set_current_term(v_term);
    end if;
  end loop;
  return v_session;
end $$;
revoke all on function public.create_session(uuid, text, jsonb, smallint) from public, anon;
grant execute on function public.create_session(uuid, text, jsonb, smallint) to authenticated;

-- Staff with their roles, whether they have signed in yet, and what they teach.
create or replace function public.staff_list(p_school uuid)
returns table (user_id uuid, full_name text, email text, phone text, roles text[], joined boolean,
               class_teacher_of text[], teaches text[])
language sql stable security definer set search_path = public as $$
  select p.id, p.full_name, p.email, p.phone,
         array_agg(distinct m.role::text order by m.role::text),
         bool_or(u.last_sign_in_at is not null),
         coalesce((select array_agg(public.class_label(c.name, c.arm) order by c.level_order, c.name, c.arm)
                   from classes c where c.school_id = p_school and c.class_teacher_id = p.id), '{}'),
         coalesce((select array_agg(distinct s.name order by s.name)
                   from class_subjects cs join subjects s on s.id = cs.subject_id
                   where cs.school_id = p_school and cs.teacher_id = p.id), '{}')
  from memberships m
  join profiles p on p.id = m.user_id
  join auth.users u on u.id = m.user_id
  where m.school_id = p_school
    and m.role in ('owner', 'admin', 'principal', 'bursar', 'teacher')
    and public.is_staff(p_school)
  group by p.id, p.full_name, p.email, p.phone
  order by min(array_position(array['owner','admin','principal','bursar','teacher'], m.role::text)), p.full_name;
$$;
revoke all on function public.staff_list(uuid) from public, anon;
grant execute on function public.staff_list(uuid) to authenticated;

-- Next free admission number for a prefix, e.g. BS/2026/ -> BS/2026/043.
create or replace function public.next_admission_no(p_school uuid, p_prefix text)
returns text language sql stable security invoker set search_path = public as $$
  select p_prefix || lpad((coalesce(max(nullif(regexp_replace(substr(admission_no, length(p_prefix) + 1), '\D', '', 'g'), '')::int), 0) + 1)::text, 3, '0')
  from students
  where school_id = p_school and admission_no like p_prefix || '%';
$$;
grant execute on function public.next_admission_no(uuid, text) to authenticated;

-- Which students in a class already have a PIN (for printing PIN slips class by class).
create or replace function public.class_pin_status(p_class uuid)
returns table (student_id uuid, has_pin boolean, set_at timestamptz)
language sql stable security definer set search_path = public as $$
  select s.id, p.student_id is not null, p.set_at
  from students s left join student_pins p on p.student_id = s.id
  where s.class_id = p_class and s.status = 'active'
    and (public.is_school_admin(s.school_id) or (public.is_staff(s.school_id) and public.teaches_class(s.class_id)));
$$;
revoke all on function public.class_pin_status(uuid) from public, anon;
grant execute on function public.class_pin_status(uuid) to authenticated;
