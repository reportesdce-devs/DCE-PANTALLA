alter table public.admin_users
  add column if not exists username text;

create unique index if not exists admin_users_username_lower_idx
  on public.admin_users (lower(username))
  where username is not null;

alter table public.admin_users
  drop constraint if exists admin_users_username_format;

alter table public.admin_users
  add constraint admin_users_username_format
  check (username is null or username ~ '^[a-zA-Z0-9._-]{3,40}$');
