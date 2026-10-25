-- Adds the Principal / Head teacher role.
-- Run this file ON ITS OWN first, then run 0003. (Postgres needs the new enum value
-- saved before other statements can use it.)
alter type public.app_role add value if not exists 'principal' after 'admin';
