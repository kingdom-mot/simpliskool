-- Lets the app use the database (Supabase "Data API" permissions).
-- Newer Supabase projects no longer give these automatically, which shows up as
-- "permission denied for table ...". Row-level security still decides which rows
-- each person can see or change; these grants only open the door to the tables.
--
-- Safe to run more than once. Run it now, and again after running any other
-- migration file, so new functions get their permissions too.

grant usage on schema public to anon, authenticated, service_role;

-- Tables: signed-in users go through row-level security; the server key has full access.
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

-- Visitors (not signed in): only what the public school website needs.
-- Row-level security limits these to active schools, published posts and new applications.
grant select on public.schools, public.website_posts to anon;
grant insert on public.admission_applications to anon;
-- The security rules on those tables call this helper, so visitors need to run it too.
grant execute on function public.is_member(uuid) to anon;

-- Functions: the server key can run everything; signed-in users can run the app's
-- functions, except the PIN check, which only the server may call.
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
    elsif f.proname not in ('handle_new_user', 'audit_row') then
      execute format('grant execute on function %s to authenticated', f.sig);
    end if;
  end loop;
end $$;

-- Tables and sequences created later get the same permissions automatically.
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated, service_role;
alter default privileges in schema public grant usage, select on sequences to authenticated, service_role;
alter default privileges in schema public grant execute on functions to service_role;
