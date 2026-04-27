-- Version keys for public partnership caches.
-- Rollback, if needed:
--   drop trigger if exists partners_bump_public_cache_version on public.partners;
--   drop trigger if exists categories_bump_public_cache_version on public.categories;
--   drop trigger if exists partners_set_partnership_updated_at on public.partners;
--   drop trigger if exists categories_set_partnership_updated_at on public.categories;
--   drop function if exists public.bump_partners_public_cache_version();
--   drop function if exists public.bump_categories_public_cache_version();
--   drop function if exists public.bump_public_cache_version(text);
--   drop function if exists public.set_partnership_updated_at();
--   drop table if exists public.public_cache_versions;
--   drop index if exists public.partners_updated_at_idx;
--   drop index if exists public.categories_updated_at_idx;
--   alter table public.partners drop column if exists updated_at;
--   alter table public.categories drop column if exists updated_at;

create table if not exists public.public_cache_versions (
  scope text primary key,
  version bigint not null default 1,
  updated_at timestamp with time zone not null default now()
);

insert into public.public_cache_versions (scope, version, updated_at)
values
  ('partners', 1, now()),
  ('categories', 1, now())
on conflict (scope) do nothing;

alter table public.partners
  add column if not exists updated_at timestamp with time zone default now();

alter table public.categories
  add column if not exists updated_at timestamp with time zone default now();

update public.partners
set updated_at = coalesce(updated_at, created_at, now())
where updated_at is null;

update public.categories
set updated_at = coalesce(updated_at, created_at, now())
where updated_at is null;

create index if not exists partners_updated_at_idx
  on public.partners (updated_at desc);

create index if not exists categories_updated_at_idx
  on public.categories (updated_at desc);

create or replace function public.set_partnership_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.bump_public_cache_version(cache_scope text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.public_cache_versions (scope, version, updated_at)
  values (cache_scope, 1, now())
  on conflict (scope) do update
    set version = public.public_cache_versions.version + 1,
        updated_at = excluded.updated_at;
end;
$$;

create or replace function public.bump_partners_public_cache_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.bump_public_cache_version('partners');
  return coalesce(new, old);
end;
$$;

create or replace function public.bump_categories_public_cache_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.bump_public_cache_version('categories');
  perform public.bump_public_cache_version('partners');
  return coalesce(new, old);
end;
$$;

drop trigger if exists partners_set_partnership_updated_at on public.partners;
create trigger partners_set_partnership_updated_at
  before update on public.partners
  for each row
  execute function public.set_partnership_updated_at();

drop trigger if exists categories_set_partnership_updated_at on public.categories;
create trigger categories_set_partnership_updated_at
  before update on public.categories
  for each row
  execute function public.set_partnership_updated_at();

drop trigger if exists partners_bump_public_cache_version on public.partners;
create trigger partners_bump_public_cache_version
  after insert or update or delete on public.partners
  for each row
  execute function public.bump_partners_public_cache_version();

drop trigger if exists categories_bump_public_cache_version on public.categories;
create trigger categories_bump_public_cache_version
  after insert or update or delete on public.categories
  for each row
  execute function public.bump_categories_public_cache_version();

alter table public.public_cache_versions enable row level security;
revoke all on table public.public_cache_versions from anon;
revoke all on table public.public_cache_versions from authenticated;
