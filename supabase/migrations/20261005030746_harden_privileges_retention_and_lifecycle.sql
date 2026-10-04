-- RF-02 (#535): privilege defaults, retention/purge, member anonymization
-- scope, project showcase terminal-state guards, partner metric actor filter,
-- public media bucket limits and audit-preserving foreign keys.
--
-- Self-host receivers never apply DDL. The operator applies this file
-- manually after a verified backup; every statement is forward-only and the
-- previous application image keeps working against the resulting schema.

-- Public schema privilege defaults --------------------------------------------
-- The application reaches the database only through the service role. Remove
-- every PUBLIC/anon/authenticated privilege that earlier migrations may have
-- forgotten to revoke, then change the defaults so a future migration that
-- forgets a revoke stays closed. Extension-owned routines keep their ACLs.
do $public_routine_privileges$
declare
  routine record;
begin
  for routine in
    select procedure_row.oid::regprocedure as signature
    from pg_catalog.pg_proc procedure_row
    join pg_catalog.pg_namespace namespace_row
      on namespace_row.oid = procedure_row.pronamespace
    where namespace_row.nspname = 'public'
      and not exists (
        select 1
        from pg_catalog.pg_depend dependency
        where dependency.classid = 'pg_catalog.pg_proc'::pg_catalog.regclass
          and dependency.objid = procedure_row.oid
          and dependency.deptype = 'e'
      )
    order by procedure_row.oid
  loop
    execute pg_catalog.format(
      'revoke all on routine %s from public, anon, authenticated',
      routine.signature
    );
    execute pg_catalog.format(
      'grant execute on routine %s to service_role',
      routine.signature
    );
  end loop;
end
$public_routine_privileges$;

do $public_relation_privileges$
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
$public_relation_privileges$;

-- Supabase grants anon/authenticated on every new public object by default.
-- Per-schema revokes reverse those grants; PUBLIC EXECUTE on functions is a
-- global default, so it is revoked per creating role. Only roles the migration
-- runner may act for are changed.
do $public_default_privileges$
declare
  owner_role text;
begin
  foreach owner_role in array array['postgres', 'supabase_admin'] loop
    if exists (select 1 from pg_catalog.pg_roles where rolname = owner_role)
      and pg_catalog.pg_has_role(current_user, owner_role, 'MEMBER') then
      execute pg_catalog.format(
        'alter default privileges for role %I revoke execute on functions from public',
        owner_role
      );
      execute pg_catalog.format(
        'alter default privileges for role %I in schema public revoke all on functions from anon, authenticated',
        owner_role
      );
      execute pg_catalog.format(
        'alter default privileges for role %I in schema public revoke all on tables from anon, authenticated',
        owner_role
      );
      execute pg_catalog.format(
        'alter default privileges for role %I in schema public revoke all on sequences from anon, authenticated',
        owner_role
      );
      execute pg_catalog.format(
        'alter default privileges for role %I in schema public grant execute on functions to service_role',
        owner_role
      );
    end if;
  end loop;
end
$public_default_privileges$;

-- Fail the migration instead of leaving a browser-reachable object behind.
do $verify_public_exposure$
declare
  exposed text;
begin
  select pg_catalog.string_agg(procedure_row.oid::regprocedure::text, ', ')
  into exposed
  from pg_catalog.pg_proc procedure_row
  join pg_catalog.pg_namespace namespace_row
    on namespace_row.oid = procedure_row.pronamespace
  where namespace_row.nspname = 'public'
    and not exists (
      select 1
      from pg_catalog.pg_depend dependency
      where dependency.classid = 'pg_catalog.pg_proc'::pg_catalog.regclass
        and dependency.objid = procedure_row.oid
        and dependency.deptype = 'e'
    )
    and (
      pg_catalog.has_function_privilege('anon', procedure_row.oid, 'EXECUTE')
      or pg_catalog.has_function_privilege('authenticated', procedure_row.oid, 'EXECUTE')
    );
  if exposed is not null then
    raise exception 'public_routine_exposed:%', exposed;
  end if;

  select pg_catalog.string_agg(pg_catalog.format('%I.%I', schemaname, tablename), ', ')
  into exposed
  from pg_catalog.pg_tables
  where schemaname = 'public'
    and (
      not rowsecurity
      or pg_catalog.has_table_privilege(
        'anon',
        pg_catalog.format('%I.%I', schemaname, tablename),
        'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER'
      )
      or pg_catalog.has_table_privilege(
        'authenticated',
        pg_catalog.format('%I.%I', schemaname, tablename),
        'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER'
      )
    );
  if exposed is not null then
    raise exception 'public_table_exposed:%', exposed;
  end if;
end
$verify_public_exposure$;
