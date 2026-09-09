-- Bind each admin row to its auth user so an admin keeps their privileges
-- after changing their e-mail address (admins.email alone is not stable).
alter table public.admins add column if not exists user_id uuid;

create unique index if not exists admins_user_id_key on public.admins (user_id) where user_id is not null;

-- Backfill existing admins from auth.users by e-mail.
update public.admins a
   set user_id = u.id
  from auth.users u
 where a.user_id is null
   and lower(u.email) = lower(a.email);

comment on column public.admins.user_id is 'auth.users.id for this admin. Set on first login/profile sync; keeps admin rights stable across e-mail changes.';
