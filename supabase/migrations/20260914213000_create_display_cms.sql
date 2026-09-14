create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  created_at timestamptz not null default now()
);

create unique index if not exists admin_users_email_lower_idx
  on public.admin_users (lower(email));

create or replace function public.is_display_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = auth.uid()
  );
$$;

revoke all on function public.is_display_admin() from public;
grant execute on function public.is_display_admin() to authenticated;

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  summary text,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text,
  audience text not null default 'todos'
    check (audience in ('todos', 'ingenieria', 'preparatoria')),
  status text not null default 'draft'
    check (status in ('draft', 'scheduled', 'published', 'archived')),
  is_featured boolean not null default false,
  cover_url text,
  cta_label text,
  cta_url text,
  display_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists events_public_timeline_idx
  on public.events (status, starts_at, display_order);

create table if not exists public.event_media (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  media_type text not null check (media_type in ('image', 'video')),
  file_path text not null,
  public_url text not null,
  caption text,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists event_media_event_order_idx
  on public.event_media (event_id, display_order, created_at);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  priority text not null default 'normal'
    check (priority in ('normal', 'important', 'urgent')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists announcements_active_idx
  on public.announcements (is_active, starts_at, ends_at, display_order);

create table if not exists public.careers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  short_name text,
  description text,
  icon text,
  accent text not null default '#ff4f1f',
  cta_url text,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.promotional_content (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  eyebrow text,
  image_url text,
  cta_label text,
  cta_url text,
  audience text not null default 'preparatoria'
    check (audience in ('todos', 'ingenieria', 'preparatoria')),
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.display_settings (
  id smallint primary key default 1 check (id = 1),
  rotation_seconds integer not null default 10 check (rotation_seconds between 5 and 120),
  refresh_seconds integer not null default 60 check (refresh_seconds between 15 and 3600),
  show_weather boolean not null default true,
  weather_locations jsonb not null default '["Tampico", "Altamira", "Ciudad Madero"]'::jsonb,
  footer_message text not null default 'La ingeniería convierte ideas en oportunidades.',
  recruitment_title text not null default 'Tu futuro también se diseña',
  recruitment_body text not null default 'Conoce nuestras ingenierías y transforma tus ideas en soluciones.',
  recruitment_cta text not null default 'Conoce la DCE',
  recruitment_url text,
  updated_at timestamptz not null default now()
);

drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at
before update on public.events
for each row execute function public.set_updated_at();

drop trigger if exists announcements_set_updated_at on public.announcements;
create trigger announcements_set_updated_at
before update on public.announcements
for each row execute function public.set_updated_at();

drop trigger if exists careers_set_updated_at on public.careers;
create trigger careers_set_updated_at
before update on public.careers
for each row execute function public.set_updated_at();

drop trigger if exists promotional_content_set_updated_at on public.promotional_content;
create trigger promotional_content_set_updated_at
before update on public.promotional_content
for each row execute function public.set_updated_at();

drop trigger if exists display_settings_set_updated_at on public.display_settings;
create trigger display_settings_set_updated_at
before update on public.display_settings
for each row execute function public.set_updated_at();

alter table public.admin_users enable row level security;
alter table public.events enable row level security;
alter table public.event_media enable row level security;
alter table public.announcements enable row level security;
alter table public.careers enable row level security;
alter table public.promotional_content enable row level security;
alter table public.display_settings enable row level security;

drop policy if exists "Admins can view their membership" on public.admin_users;
create policy "Admins can view their membership"
on public.admin_users for select
to authenticated
using (user_id = auth.uid() or public.is_display_admin());

drop policy if exists "Public can view published events" on public.events;
create policy "Public can view published events"
on public.events for select
to anon, authenticated
using (status in ('published', 'archived'));

drop policy if exists "Admins manage events" on public.events;
create policy "Admins manage events"
on public.events for all
to authenticated
using (public.is_display_admin())
with check (public.is_display_admin());

drop policy if exists "Public can view media for published events" on public.event_media;
create policy "Public can view media for published events"
on public.event_media for select
to anon, authenticated
using (
  exists (
    select 1 from public.events
    where events.id = event_media.event_id
      and events.status in ('published', 'archived')
  )
);

drop policy if exists "Admins manage event media" on public.event_media;
create policy "Admins manage event media"
on public.event_media for all
to authenticated
using (public.is_display_admin())
with check (public.is_display_admin());

drop policy if exists "Public can view active announcements" on public.announcements;
create policy "Public can view active announcements"
on public.announcements for select
to anon, authenticated
using (
  is_active
  and starts_at <= now()
  and (ends_at is null or ends_at >= now())
);

drop policy if exists "Admins manage announcements" on public.announcements;
create policy "Admins manage announcements"
on public.announcements for all
to authenticated
using (public.is_display_admin())
with check (public.is_display_admin());

drop policy if exists "Public can view active careers" on public.careers;
create policy "Public can view active careers"
on public.careers for select
to anon, authenticated
using (is_active);

drop policy if exists "Admins manage careers" on public.careers;
create policy "Admins manage careers"
on public.careers for all
to authenticated
using (public.is_display_admin())
with check (public.is_display_admin());

drop policy if exists "Public can view active promotions" on public.promotional_content;
create policy "Public can view active promotions"
on public.promotional_content for select
to anon, authenticated
using (is_active);

drop policy if exists "Admins manage promotions" on public.promotional_content;
create policy "Admins manage promotions"
on public.promotional_content for all
to authenticated
using (public.is_display_admin())
with check (public.is_display_admin());

drop policy if exists "Public can view display settings" on public.display_settings;
create policy "Public can view display settings"
on public.display_settings for select
to anon, authenticated
using (true);

drop policy if exists "Admins manage display settings" on public.display_settings;
create policy "Admins manage display settings"
on public.display_settings for all
to authenticated
using (public.is_display_admin())
with check (public.is_display_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'event-media',
  'event-media',
  true,
  52428800,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can view event media files" on storage.objects;
create policy "Public can view event media files"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'event-media');

drop policy if exists "Admins can upload event media files" on storage.objects;
create policy "Admins can upload event media files"
on storage.objects for insert
to authenticated
with check (bucket_id = 'event-media' and public.is_display_admin());

drop policy if exists "Admins can update event media files" on storage.objects;
create policy "Admins can update event media files"
on storage.objects for update
to authenticated
using (bucket_id = 'event-media' and public.is_display_admin())
with check (bucket_id = 'event-media' and public.is_display_admin());

drop policy if exists "Admins can delete event media files" on storage.objects;
create policy "Admins can delete event media files"
on storage.objects for delete
to authenticated
using (bucket_id = 'event-media' and public.is_display_admin());

insert into public.display_settings (id)
values (1)
on conflict (id) do nothing;

insert into public.careers (name, short_name, description, icon, accent, display_order)
values
  ('Ingeniería en Sistemas y Negocios Digitales', 'Sistemas y Negocios Digitales', 'Diseña productos, servicios y negocios impulsados por tecnología.', '⌘', '#ff4f1f', 1),
  ('Ingeniería Industrial', 'Industrial', 'Optimiza procesos, operaciones y organizaciones con visión estratégica.', '⚙', '#e7a000', 2),
  ('Ingeniería Mecatrónica', 'Mecatrónica', 'Integra mecánica, electrónica, control y automatización.', '◇', '#7b43e8', 3),
  ('Ingeniería Química', 'Química', 'Transforma materiales y procesos para construir soluciones sostenibles.', '⚗', '#14a663', 4)
on conflict (name) do update set
  short_name = excluded.short_name,
  description = excluded.description,
  icon = excluded.icon,
  accent = excluded.accent,
  display_order = excluded.display_order;

insert into public.events (
  title, slug, summary, description, starts_at, ends_at, location,
  audience, status, is_featured, display_order
)
values
  ('Semana de Ingeniería', 'semana-de-ingenieria-2026', 'Ideas que transforman', 'Conferencias, talleres, networking y tecnología.', '2026-09-03 09:00:00-06', '2026-09-04 20:00:00-06', 'Auditorio David Gómez Fuentes', 'todos', 'archived', false, 1),
  ('Conferencia: IA en la Industria', 'ia-en-la-industria-2026', 'Retos y oportunidades de la inteligencia artificial aplicada.', null, '2026-09-16 11:00:00-06', '2026-09-16 13:00:00-06', 'Auditorio David Gómez Fuentes', 'todos', 'published', true, 2),
  ('Feria de Prácticas Profesionales', 'feria-practicas-2026', 'Conecta con empresas y descubre oportunidades profesionales.', null, '2026-09-23 10:00:00-06', '2026-09-23 16:00:00-06', 'Explanada Central', 'ingenieria', 'published', false, 3)
on conflict (slug) do nothing;
