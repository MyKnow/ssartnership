-- Keep public partner caches synchronized when the normalized benefit ledger changes.
-- The benefit ledger was introduced after the original partners cache trigger, so
-- inserting partner_benefits alone previously left stale legacy IDs in cached pages.

create or replace function public.bump_partner_benefits_public_cache_version()
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

drop trigger if exists partner_benefits_bump_public_cache_version on public.partner_benefits;
create trigger partner_benefits_bump_public_cache_version
  after insert or update or delete on public.partner_benefits
  for each row
  execute function public.bump_partner_benefits_public_cache_version();

-- Invalidate pages created before the normalized benefit ledger was deployed.
select public.bump_public_cache_version('partners');
