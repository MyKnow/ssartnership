alter table public.promotion_slides
  add column if not exists requires_login boolean not null default false,
  add column if not exists allowed_years integer[] not null default '{}'::integer[],
  add column if not exists allowed_campuses text[] not null default '{}'::text[];

update public.promotion_slides
set
  requires_login = coalesce(requires_login, false),
  allowed_years = coalesce(allowed_years, '{}'::integer[]),
  allowed_campuses = coalesce(allowed_campuses, '{}'::text[]);
