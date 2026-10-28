-- Fees: fee setup per term and section, invoices with their lines, cash/transfer/POS
-- payments with receipt numbers, and the payments and defaulters overview.
-- Amounts are in kobo (₦1 = 100 kobo). Run 0008_grants.sql again after this file.

-- ---------------------------------------------------------------------------
-- Sections: the same rule as sectionOfClass() in src/lib/nigeria.ts
-- ---------------------------------------------------------------------------
create or replace function public.class_section(p_name text)
returns text language sql immutable as $$
  select case
    when lower(p_name) ~ '^(creche|kg|nursery|pre)' then 'nursery'
    when lower(p_name) ~ '^(primary|basic|pry|grade|year)' then 'primary'
    when lower(p_name) ~ '^(jss|junior)' then 'jss'
    when lower(p_name) ~ '^(ss|sss|senior)' then 'ss'
    else 'other' end;
$$;

-- ---------------------------------------------------------------------------
-- Fee items: each belongs to a term and a section (Nursery, Primary, JSS, SS, Other),
-- optionally only one class level ("SS 3"), and may be optional (school bus):
-- optional items are only billed to the students picked for them.
-- ---------------------------------------------------------------------------
alter table public.fee_items add column if not exists section text;
alter table public.fee_items add column if not exists level text;
alter table public.fee_items add column if not exists optional boolean not null default false;
alter table public.fee_items add column if not exists position int not null default 0;
alter table public.fee_items add column if not exists created_at timestamptz not null default now();
alter table public.fee_items drop constraint if exists fee_items_checks;
alter table public.fee_items add constraint fee_items_checks check (
  (section is null or section in ('nursery', 'primary', 'jss', 'ss', 'other'))
  and char_length(trim(name)) between 1 and 80
  and (level is null or char_length(level) between 1 and 40)
  and amount_kobo <= 100000000000
);
create index if not exists fee_items_term on public.fee_items (term_id, section);

create table if not exists public.fee_item_students (
  fee_item_id uuid not null references public.fee_items (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  school_id uuid not null references public.schools (id) on delete cascade,
  primary key (fee_item_id, student_id)
);

-- Per-term fee settings.
create table if not exists public.fee_terms (
  term_id uuid primary key references public.terms (id) on delete cascade,
  school_id uuid not null references public.schools (id) on delete cascade,
  due_on date,
  allow_part boolean not null default true,
  published_at timestamptz,
  updated_at timestamptz not null default now()
);

-- How parents pay until online payment is switched on (bank account, etc.).
alter table public.schools add column if not exists payment_instructions text;
alter table public.schools drop constraint if exists schools_payment_instructions_len;
alter table public.schools add constraint schools_payment_instructions_len check (payment_instructions is null or char_length(payment_instructions) <= 600);

-- What each invoice is made of (a copy, so later changes to fee items don't rewrite history).
create table if not exists public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  school_id uuid not null references public.schools (id) on delete cascade,
  fee_item_id uuid references public.fee_items (id) on delete set null,
  name text not null,
  amount_kobo bigint not null check (amount_kobo >= 0),
  position int not null default 0
);
create index if not exists invoice_lines_invoice on public.invoice_lines (invoice_id);
alter table public.invoices add column if not exists updated_at timestamptz not null default now();

-- Payments recorded by the school (cash, transfer, POS); Paystack payments come later.
alter table public.payments add column if not exists reference text;
alter table public.payments add column if not exists recorded_by uuid references public.profiles (id) on delete set null;
alter table public.payments add column if not exists voided_at timestamptz;
alter table public.payments add column if not exists void_reason text;
alter table public.payments add column if not exists receipt_emailed_at timestamptz;
alter table public.payments drop constraint if exists payments_method_check;
alter table public.payments add constraint payments_method_check check (method in ('paystack', 'transfer', 'cash', 'pos'));
create unique index if not exists payments_receipt_no on public.payments (school_id, receipt_no) where receipt_no is not null;
create index if not exists payments_invoice on public.payments (invoice_id);

create table if not exists public.receipt_counters (
  school_id uuid primary key references public.schools (id) on delete cascade,
  last_no int not null default 0
);

-- Reminder emails use the notifications log.
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('absence', 'register_reminder', 'fee_reminder', 'fee_invoice'));

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
alter table public.fee_item_students enable row level security;
alter table public.fee_terms enable row level security;
alter table public.invoice_lines enable row level security;
alter table public.receipt_counters enable row level security;

drop policy if exists fee_item_students_read on public.fee_item_students;
create policy fee_item_students_read on public.fee_item_students for select
  using (public.is_finance(school_id) or public.can_view_student(student_id));
drop policy if exists fee_item_students_write on public.fee_item_students;
create policy fee_item_students_write on public.fee_item_students for all
  using (public.is_finance(school_id)) with check (public.is_finance(school_id));

drop policy if exists fee_terms_read on public.fee_terms;
create policy fee_terms_read on public.fee_terms for select using (public.is_member(school_id));
drop policy if exists fee_terms_write on public.fee_terms;
create policy fee_terms_write on public.fee_terms for all
  using (public.is_finance(school_id)) with check (public.is_finance(school_id));

drop policy if exists invoice_lines_read on public.invoice_lines;
create policy invoice_lines_read on public.invoice_lines for select using (
  public.is_finance(school_id) or exists (
    select 1 from public.invoices i where i.id = invoice_lines.invoice_id and public.can_view_student(i.student_id)));
-- No write policy: invoice lines are written only by publish_invoices().
-- receipt_counters: no policies; only the functions below touch it.

-- ---------------------------------------------------------------------------
-- Keep invoices.paid_kobo equal to the successful payments.
-- ---------------------------------------------------------------------------
create or replace function public.sync_invoice_paid()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_invoice uuid := coalesce(new.invoice_id, old.invoice_id);
begin
  update invoices i
     set paid_kobo = coalesce((select sum(p.amount_kobo) from payments p where p.invoice_id = i.id and p.status = 'success'), 0),
         updated_at = now()
   where i.id = v_invoice;
  if tg_op = 'UPDATE' and old.invoice_id is distinct from new.invoice_id then
    update invoices i
       set paid_kobo = coalesce((select sum(p.amount_kobo) from payments p where p.invoice_id = i.id and p.status = 'success'), 0)
     where i.id = old.invoice_id;
  end if;
  return null;
end $$;

drop trigger if exists payments_sync_invoice on public.payments;
create trigger payments_sync_invoice after insert or update or delete on public.payments
for each row execute function public.sync_invoice_paid();

-- ---------------------------------------------------------------------------
-- Copy last term's fees into a new term (when the new term has none yet).
-- ---------------------------------------------------------------------------
create or replace function public.copy_fee_items(p_from uuid, p_to uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_school uuid;
  v_n int := 0;
  r record;
  v_new uuid;
begin
  select school_id into v_school from terms where id = p_to;
  if v_school is null or not public.is_finance(v_school) then raise exception 'not allowed' using errcode = '42501'; end if;
  if not exists (select 1 from terms where id = p_from and school_id = v_school) then raise exception 'not allowed' using errcode = '42501'; end if;
  if exists (select 1 from fee_items where term_id = p_to) then raise exception 'This term already has fees' using errcode = 'P0001'; end if;
  for r in select * from fee_items where term_id = p_from order by position, created_at loop
    insert into fee_items (school_id, term_id, class_id, name, amount_kobo, section, level, optional, position)
    values (v_school, p_to, r.class_id, r.name, r.amount_kobo, r.section, r.level, r.optional, r.position)
    returning id into v_new;
    -- Students still at school keep their optional items (school bus, lunch).
    insert into fee_item_students (fee_item_id, student_id, school_id)
    select v_new, fis.student_id, v_school from fee_item_students fis
    join students s on s.id = fis.student_id and s.status = 'active'
    where fis.fee_item_id = r.id;
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

-- ---------------------------------------------------------------------------
-- Create or update every active student's invoice for a term from the fee items.
-- Payments already made stay on the invoice. Safe to run again after changes.
-- ---------------------------------------------------------------------------
create or replace function public.publish_invoices(p_term uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_school uuid;
  v_inv uuid;
  v_total bigint;
  v_created int := 0;
  v_updated int := 0;
  v_skipped int := 0;
  v_was bigint;
  s record;
begin
  select school_id into v_school from terms where id = p_term;
  if v_school is null or not public.is_finance(v_school) then raise exception 'not allowed' using errcode = '42501'; end if;
  if not exists (select 1 from fee_items where term_id = p_term) then raise exception 'Add fee items first' using errcode = 'P0001'; end if;

  for s in
    select st.id, c.name as class_name
    from students st left join classes c on c.id = st.class_id
    where st.school_id = v_school and st.status = 'active'
  loop
    if s.class_name is null then v_skipped := v_skipped + 1; continue; end if;

    select coalesce(sum(f.amount_kobo), 0) into v_total
    from fee_items f
    where f.term_id = p_term
      and (f.section is null or f.section = public.class_section(s.class_name))
      and (f.level is null or lower(trim(f.level)) = lower(trim(s.class_name)))
      and (not f.optional or exists (select 1 from fee_item_students x where x.fee_item_id = f.id and x.student_id = s.id));

    select id, total_kobo into v_inv, v_was from invoices where student_id = s.id and term_id = p_term;
    if v_inv is null then
      if v_total = 0 then continue; end if;
      insert into invoices (school_id, student_id, term_id, total_kobo) values (v_school, s.id, p_term, v_total) returning id into v_inv;
      v_created := v_created + 1;
    else
      if v_was <> v_total then v_updated := v_updated + 1; end if;
      update invoices set total_kobo = v_total, updated_at = now() where id = v_inv;
      delete from invoice_lines where invoice_id = v_inv;
    end if;

    insert into invoice_lines (invoice_id, school_id, fee_item_id, name, amount_kobo, position)
    select v_inv, v_school, f.id, f.name, f.amount_kobo,
           row_number() over (order by f.optional, f.position, f.created_at)
    from fee_items f
    where f.term_id = p_term
      and (f.section is null or f.section = public.class_section(s.class_name))
      and (f.level is null or lower(trim(f.level)) = lower(trim(s.class_name)))
      and (not f.optional or exists (select 1 from fee_item_students x where x.fee_item_id = f.id and x.student_id = s.id));
  end loop;

  insert into fee_terms (term_id, school_id, published_at) values (p_term, v_school, now())
  on conflict (term_id) do update set published_at = now(), updated_at = now();

  return jsonb_build_object('created', v_created, 'updated', v_updated, 'no_class', v_skipped,
    'invoices', (select count(*) from invoices where term_id = p_term and total_kobo > 0));
end $$;

-- ---------------------------------------------------------------------------
-- Record a cash, transfer or POS payment and give it the next receipt number.
-- ---------------------------------------------------------------------------
create or replace function public.record_payment(p_invoice uuid, p_amount_kobo bigint, p_method text, p_paid_on date, p_reference text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_inv record;
  v_no int;
  v_receipt text;
  v_id uuid;
begin
  select * into v_inv from invoices where id = p_invoice for update;
  if v_inv.id is null or not public.is_finance(v_inv.school_id) then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_method not in ('transfer', 'cash', 'pos') then raise exception 'Choose how the parent paid' using errcode = 'P0001'; end if;
  if p_amount_kobo is null or p_amount_kobo <= 0 then raise exception 'Enter the amount paid' using errcode = 'P0001'; end if;
  if p_amount_kobo > v_inv.total_kobo - v_inv.paid_kobo then raise exception 'More than the balance' using errcode = 'P0001'; end if;
  if p_paid_on is null or p_paid_on > public.lagos_today() then raise exception 'The date paid can''t be in the future' using errcode = 'P0001'; end if;

  insert into receipt_counters (school_id, last_no) values (v_inv.school_id, 1)
  on conflict (school_id) do update set last_no = receipt_counters.last_no + 1
  returning last_no into v_no;
  v_receipt := 'RC' || lpad(v_no::text, 6, '0');

  insert into payments (school_id, invoice_id, amount_kobo, method, status, receipt_no, paid_at, reference, recorded_by)
  values (v_inv.school_id, p_invoice, p_amount_kobo, p_method, 'success', v_receipt,
          (p_paid_on::timestamp + time '12:00') at time zone 'Africa/Lagos',
          nullif(trim(coalesce(p_reference, '')), ''), auth.uid())
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'receipt_no', v_receipt);
end $$;

-- Cancel a payment entered by mistake (owner or admin only). It stays in the list, marked cancelled.
create or replace function public.void_payment(p_payment uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_pay record;
begin
  select * into v_pay from payments where id = p_payment for update;
  if v_pay.id is null or not public.is_school_admin(v_pay.school_id) then raise exception 'not allowed' using errcode = '42501'; end if;
  if v_pay.method = 'paystack' then raise exception 'Online payments can''t be cancelled here' using errcode = 'P0001'; end if;
  if v_pay.voided_at is not null then return; end if;
  if char_length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'Say why the payment is being cancelled' using errcode = 'P0001'; end if;
  update payments set status = 'failed', voided_at = now(), void_reason = left(trim(p_reason), 200) where id = p_payment;
end $$;

-- Bursars can't edit the school row, so payment instructions have their own function.
create or replace function public.set_payment_instructions(p_school uuid, p_text text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_finance(p_school) then raise exception 'not allowed' using errcode = '42501'; end if;
  update schools set payment_instructions = nullif(left(trim(coalesce(p_text, '')), 600), '') where id = p_school;
end $$;

-- ---------------------------------------------------------------------------
-- Payments and defaulters for one term (optionally one class).
-- "Earlier terms" are terms before this one, by session name then term number.
-- ---------------------------------------------------------------------------
create or replace function public.fee_overview(p_school uuid, p_term uuid, p_class uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_key text;
  v_out jsonb;
begin
  if not public.is_finance(p_school) then return null; end if;
  select s.name || '-' || t.term_no into v_key from terms t join academic_sessions s on s.id = t.session_id
   where t.id = p_term and t.school_id = p_school;
  if v_key is null then return null; end if;

  with inv as (
    select i.*, st.first_name, st.last_name, st.admission_no, st.status as st_status, st.class_id,
           public.class_label(c.name, c.arm) as class_name, c.level_order,
           (ses.name || '-' || t.term_no) as tkey
    from invoices i
    join students st on st.id = i.student_id
    left join classes c on c.id = st.class_id
    join terms t on t.id = i.term_id
    join academic_sessions ses on ses.id = t.session_id
    where i.school_id = p_school and (p_class is null or st.class_id = p_class)
  ),
  cur as (select * from inv where term_id = p_term),
  earlier as (select * from inv where tkey < v_key and balance_kobo > 0 and st_status = 'active'),
  debt as (
    select st.id, st.first_name, st.last_name, st.admission_no, public.class_label(c.name, c.arm) as class_name, c.level_order,
           coalesce((select sum(greatest(balance_kobo, 0)) from cur where cur.student_id = st.id), 0) as cur_owed,
           coalesce((select sum(balance_kobo) from earlier e where e.student_id = st.id), 0) as prev_owed,
           (select id from cur where cur.student_id = st.id) as invoice_id,
           (select max(n.created_at) from notifications n where n.student_id = st.id and n.kind = 'fee_reminder' and n.status = 'sent') as last_reminder,
           (select count(*) from guardians g join profiles pr on pr.id = g.user_id
             where g.student_id = st.id and pr.email is not null and pr.email not like '%@students.simpliskool.com') as parents_with_email
    from students st left join classes c on c.id = st.class_id
    where st.school_id = p_school and st.status = 'active' and (p_class is null or st.class_id = p_class)
  )
  select jsonb_build_object(
    'expected', coalesce((select sum(total_kobo) from cur), 0),
    'received', coalesce((select sum(paid_kobo) from cur), 0),
    'outstanding', coalesce((select sum(greatest(balance_kobo, 0)) from cur), 0),
    'invoices', (select count(*) from cur where total_kobo > 0),
    'paid_in_full', (select count(*) from cur where total_kobo > 0 and balance_kobo <= 0),
    'owing', (select count(*) from cur where balance_kobo > 0),
    'earlier', coalesce((select sum(balance_kobo) from earlier), 0),
    'earlier_students', (select count(distinct student_id) from earlier),
    'payments', coalesce((select jsonb_agg(x order by x->>'at' desc, x->>'receipt' desc) from (
        select jsonb_build_object(
          'id', p.id, 'at', coalesce(p.paid_at, p.created_at), 'name', cur.first_name || ' ' || cur.last_name,
          'student_id', cur.student_id, 'class', cur.class_name, 'method', p.method, 'receipt', p.receipt_no,
          'reference', p.reference, 'amount', p.amount_kobo, 'status', p.status,
          'voided', p.voided_at is not null, 'void_reason', p.void_reason,
          'by', nullif(trim(coalesce(pr.full_name, '')), '')) x
        from payments p join cur on cur.id = p.invoice_id
        left join profiles pr on pr.id = p.recorded_by
        where p.status = 'success' or p.voided_at is not null) q), '[]'::jsonb),
    'defaulters', coalesce((select jsonb_agg(jsonb_build_object(
          'id', d.id, 'name', d.first_name || ' ' || d.last_name, 'admission_no', d.admission_no,
          'class', d.class_name, 'cur', d.cur_owed, 'prev', d.prev_owed, 'total', d.cur_owed + d.prev_owed,
          'invoice_id', d.invoice_id, 'last_reminder', d.last_reminder, 'parents_with_email', d.parents_with_email)
        order by d.cur_owed + d.prev_owed desc, d.level_order, d.last_name)
      from debt d where d.cur_owed + d.prev_owed > 0), '[]'::jsonb),
    'invoice_list', coalesce((select jsonb_agg(jsonb_build_object(
          'id', cur.id, 'student_id', cur.student_id, 'name', cur.first_name || ' ' || cur.last_name,
          'admission_no', cur.admission_no, 'class', cur.class_name, 'total', cur.total_kobo, 'paid', cur.paid_kobo,
          'balance', cur.balance_kobo) order by cur.level_order, cur.last_name, cur.first_name)
      from cur where cur.total_kobo > 0), '[]'::jsonb)
  ) into v_out;
  return v_out;
end $$;
