-- Simpliskool 0003: Principal permissions and student sign-in with admission number + PIN.
-- Run after 0002_principal_role.sql has been run on its own.

-- ---------------------------------------------------------------------------
-- Principal / Head teacher
-- Academic leader: everything a school admin can do except school settings,
-- billing and money. Owners and admins keep settings; finance stays with
-- owner, admin and bursar.
-- ---------------------------------------------------------------------------
create or replace function public.is_staff(p_school uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(p_school, array['owner','admin','principal','bursar','teacher']::public.app_role[]);
$$;

create or replace function public.is_school_admin(p_school uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(p_school, array['owner','admin','principal']::public.app_role[]);
$$;

create or replace function public.is_owner_or_admin(p_school uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(p_school, array['owner','admin']::public.app_role[]);
$$;

create or replace function public.staff_can_see_user(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships mine join memberships theirs on theirs.school_id = mine.school_id
    where mine.user_id = auth.uid() and theirs.user_id = p_user
      and mine.role in ('owner','admin','principal','bursar','teacher')
  );
$$;

-- School settings: owners and admins only (not principals).
drop policy if exists schools_admin_update on public.schools;
create policy schools_admin_update on public.schools for update
  using (public.is_owner_or_admin(id)) with check (public.is_owner_or_admin(id));

-- Only owners and admins can give someone the owner, admin or principal role.
drop policy if exists memberships_admin_write on public.memberships;
create policy memberships_admin_write on public.memberships for all
  using (public.is_school_admin(school_id) and (role not in ('owner','admin','principal') or public.is_owner_or_admin(school_id)))
  with check (public.is_school_admin(school_id) and (role not in ('owner','admin','principal') or public.is_owner_or_admin(school_id)));

-- ---------------------------------------------------------------------------
-- Student sign-in: admission number + PIN
-- ---------------------------------------------------------------------------
alter table public.students
  add column if not exists signin_method text not null default 'pin'
  check (signin_method in ('pin', 'own'));

-- PINs live in their own table with RLS on and no policies: nobody can read
-- them through the API. Only the security-definer functions below touch it.
create table if not exists public.student_pins (
  student_id uuid primary key references public.students (id) on delete cascade,
  school_id uuid not null references public.schools (id) on delete cascade,
  pin_hash text not null,
  set_at timestamptz not null default now(),
  set_by uuid references public.profiles (id) on delete set null,
  failed_count int not null default 0,
  locked_until timestamptz
);
alter table public.student_pins enable row level security;

-- Issue a new 4-digit PIN. Allowed for school admins and principals, and for
-- teachers who teach the student's class. Returns the PIN once; only its hash is stored.
create or replace function public.reset_student_pin(p_student uuid)
returns table (pin text, student_id uuid, school_id uuid, user_id uuid, admission_no text, full_name text)
language plpgsql security definer set search_path = public, extensions as $$
#variable_conflict use_column
declare
  s students%rowtype;
  v_pin text;
  weak text[] := array['0000','1111','2222','3333','4444','5555','6666','7777','8888','9999','1234','4321','1212','2580','0123','9876','1122','6969','2000','2026','2027'];
begin
  select * into s from students where id = p_student;
  if not found then raise exception 'Student not found'; end if;
  if not (public.is_school_admin(s.school_id) or (public.is_staff(s.school_id) and public.teaches_class(s.class_id))) then
    raise exception 'You do not have permission to reset this PIN';
  end if;

  loop
    v_pin := lpad(((get_byte(gen_random_bytes(2), 0) * 256 + get_byte(gen_random_bytes(2), 1)) % 10000)::text, 4, '0');
    exit when not (v_pin = any (weak));
  end loop;

  insert into student_pins (student_id, school_id, pin_hash, set_at, set_by, failed_count, locked_until)
  values (s.id, s.school_id, crypt(v_pin, gen_salt('bf', 8)), now(), auth.uid(), 0, null)
  on conflict on constraint student_pins_pkey do update
    set pin_hash = excluded.pin_hash, set_at = now(), set_by = auth.uid(), failed_count = 0, locked_until = null;

  update students set signin_method = 'pin' where id = s.id;

  insert into audit_log (school_id, actor_id, action, table_name, record_id, details)
  values (s.school_id, auth.uid(), 'RESET_PIN', 'student_pins', s.id, null);

  return query select v_pin, s.id, s.school_id, s.user_id, s.admission_no, trim(s.first_name || ' ' || s.last_name);
end $$;

revoke all on function public.reset_student_pin(uuid) from public, anon;
grant execute on function public.reset_student_pin(uuid) to authenticated;

-- Check a PIN. Called only by the server with the service role key.
-- 5 wrong PINs lock the account for 15 minutes.
create or replace function public.verify_student_pin(p_school_slug text, p_admission_no text, p_pin text)
returns table (status text, student_id uuid, school_id uuid, user_id uuid, locked_until timestamptz)
language plpgsql security definer set search_path = public, extensions as $$
#variable_conflict use_column
declare
  s students%rowtype;
  p student_pins%rowtype;
begin
  select st.* into s
  from students st join schools sc on sc.id = st.school_id
  where sc.slug = lower(trim(p_school_slug)) and sc.status = 'active'
    and upper(st.admission_no) = upper(trim(p_admission_no)) and st.status = 'active'
  limit 1;
  if not found then
    return query select 'invalid'::text, null::uuid, null::uuid, null::uuid, null::timestamptz; return;
  end if;

  select * into p from student_pins where student_pins.student_id = s.id for update;
  if not found or s.signin_method <> 'pin' then
    return query select 'invalid'::text, null::uuid, null::uuid, null::uuid, null::timestamptz; return;
  end if;

  if p.locked_until is not null and p.locked_until > now() then
    return query select 'locked'::text, null::uuid, null::uuid, null::uuid, p.locked_until; return;
  end if;

  if p.pin_hash = crypt(p_pin, p.pin_hash) then
    update student_pins set failed_count = 0, locked_until = null where student_pins.student_id = s.id;
    return query select 'ok'::text, s.id, s.school_id, s.user_id, null::timestamptz; return;
  end if;

  if p.failed_count + 1 >= 5 then
    update student_pins set failed_count = 0, locked_until = now() + interval '15 minutes' where student_pins.student_id = s.id;
    insert into audit_log (school_id, actor_id, action, table_name, record_id, details)
    values (s.school_id, null, 'PIN_LOCKED', 'student_pins', s.id, null);
    return query select 'locked'::text, null::uuid, null::uuid, null::uuid, now() + interval '15 minutes'; return;
  end if;

  update student_pins set failed_count = failed_count + 1 where student_pins.student_id = s.id;
  return query select 'invalid'::text, null::uuid, null::uuid, null::uuid, null::timestamptz;
end $$;

revoke all on function public.verify_student_pin(text, text, text) from public, anon, authenticated;
grant execute on function public.verify_student_pin(text, text, text) to service_role;

-- When a PIN was last set (for the admin "How this student signs in" card). No hash returned.
create or replace function public.student_pin_status(p_student uuid)
returns table (has_pin boolean, set_at timestamptz, failed_count int, locked_until timestamptz)
language sql stable security definer set search_path = public as $$
  select p.student_id is not null, p.set_at, coalesce(p.failed_count, 0), p.locked_until
  from students s left join student_pins p on p.student_id = s.id
  where s.id = p_student and public.is_staff(s.school_id);
$$;
grant execute on function public.student_pin_status(uuid) to authenticated;
