-- The application serves public data through server-side repositories. No table
-- in the public schema is a browser/PostgREST data source. Apply the boundary at
-- the end of the migration chain so an empty-database replay cannot inherit
-- Supabase's default anon/authenticated table privileges from early migrations.
do $public_access_hardening$
declare
  table_record record;
  sequence_record record;
begin
  for table_record in
    select schemaname, tablename
    from pg_catalog.pg_tables
    where schemaname = 'public'
    order by tablename
  loop
    execute pg_catalog.format(
      'alter table %I.%I enable row level security',
      table_record.schemaname,
      table_record.tablename
    );
    execute pg_catalog.format(
      'revoke all on table %I.%I from public, anon, authenticated',
      table_record.schemaname,
      table_record.tablename
    );
  end loop;

  for sequence_record in
    select sequence_schema, sequence_name
    from information_schema.sequences
    where sequence_schema = 'public'
    order by sequence_name
  loop
    execute pg_catalog.format(
      'revoke all on sequence %I.%I from public, anon, authenticated',
      sequence_record.sequence_schema,
      sequence_record.sequence_name
    );
  end loop;
end
$public_access_hardening$;

drop policy if exists "Public read categories" on public.categories;
drop policy if exists "Public read partners" on public.partners;

-- These legacy cache and metric helpers are trigger/internal capabilities, not
-- public RPCs. PostgreSQL grants function execution to PUBLIC by default.
revoke all on function public.bump_public_cache_version(text) from public;
revoke all on function public.bump_public_cache_version(text) from anon;
revoke all on function public.bump_public_cache_version(text) from authenticated;
revoke all on function public.bump_partners_public_cache_version() from public;
revoke all on function public.bump_partners_public_cache_version() from anon;
revoke all on function public.bump_partners_public_cache_version() from authenticated;
revoke all on function public.bump_categories_public_cache_version() from public;
revoke all on function public.bump_categories_public_cache_version() from anon;
revoke all on function public.bump_categories_public_cache_version() from authenticated;
revoke all on function public.sync_partner_benefit_cache_version() from public;
revoke all on function public.sync_partner_benefit_cache_version() from anon;
revoke all on function public.sync_partner_benefit_cache_version() from authenticated;
revoke all on function public.apply_partner_metric_event_rollups(uuid, text, text, text, text, timestamp with time zone) from public;
revoke all on function public.apply_partner_metric_event_rollups(uuid, text, text, text, text, timestamp with time zone) from anon;
revoke all on function public.apply_partner_metric_event_rollups(uuid, text, text, text, text, timestamp with time zone) from authenticated;
revoke all on function public.apply_partner_metric_event(uuid, text, text, text, text, timestamp with time zone) from public;
revoke all on function public.apply_partner_metric_event(uuid, text, text, text, text, timestamp with time zone) from anon;
revoke all on function public.apply_partner_metric_event(uuid, text, text, text, text, timestamp with time zone) from authenticated;
revoke all on function public.reconcile_partner_metric_rollups(uuid) from public;
revoke all on function public.reconcile_partner_metric_rollups(uuid) from anon;
revoke all on function public.reconcile_partner_metric_rollups(uuid) from authenticated;
