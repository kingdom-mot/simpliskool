-- School settings: motto and principal's name (shown on the website and report cards),
-- and a public storage bucket for school logos.

alter table public.schools add column if not exists motto text;
alter table public.schools add column if not exists principal_name text;

alter table public.schools drop constraint if exists schools_text_lengths;
alter table public.schools add constraint schools_text_lengths check (
  char_length(name) between 3 and 120
  and (motto is null or char_length(motto) <= 120)
  and (principal_name is null or char_length(principal_name) <= 120)
  and (about is null or char_length(about) <= 2000)
  and (address is null or char_length(address) <= 300)
);

-- Logos live in Supabase Storage. Anyone can view them (they appear on the public
-- school website); only the server uploads them, after checking the person is the
-- school's owner or admin.
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('school-logos', 'school-logos', true, 1048576, array['image/png', 'image/jpeg', 'image/webp'])
    on conflict (id) do update
      set public = true, file_size_limit = 1048576, allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp'];
  end if;
end $$;
