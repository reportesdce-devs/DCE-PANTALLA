update public.events
set is_featured = true,
    display_order = 1
where slug = 'semana-de-ingenieria-2026';

update public.events
set display_order = 3
where slug = 'ia-en-la-industria-2026';

update public.events
set display_order = 4
where slug = 'feria-practicas-2026';

insert into public.events (
  title, slug, summary, starts_at, ends_at, location,
  audience, status, is_featured, display_order
)
values (
  'Hackathon de Innovaci' || chr(243) || 'n',
  'hackathon-innovacion-2026',
  'Soluciones para un mejor futuro',
  '2026-09-10 09:00:00-06',
  '2026-09-10 19:00:00-06',
  'Laboratorios DCE',
  'todos',
  'published',
  false,
  2
)
on conflict (slug) do update set
  title = excluded.title,
  summary = excluded.summary,
  starts_at = excluded.starts_at,
  ends_at = excluded.ends_at,
  location = excluded.location,
  audience = excluded.audience,
  status = excluded.status,
  display_order = excluded.display_order;
