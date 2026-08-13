-- Keep third-party extension objects outside the API-exposed public schema.
-- The extension is relocatable; moving it preserves the OIDs used by the four
-- existing trigram indexes. The catalog assertion makes that invariant explicit.

create schema if not exists extensions;

do $$
declare
  current_extension_schema text;
begin
  select namespace.nspname
  into current_extension_schema
  from pg_catalog.pg_extension as extension
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = extension.extnamespace
  where extension.extname = 'pg_trgm';

  if current_extension_schema is null then
    raise exception 'pg_trgm_extension_missing';
  end if;

  if current_extension_schema <> 'extensions' then
    execute 'alter extension pg_trgm set schema extensions';
  end if;
end;
$$;

do $$
declare
  invalid_index_names text[];
begin
  if not exists (
    select 1
    from pg_catalog.pg_extension as extension
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = extension.extnamespace
    where extension.extname = 'pg_trgm'
      and namespace.nspname = 'extensions'
  ) then
    raise exception 'pg_trgm_extension_schema_invalid';
  end if;

  select pg_catalog.array_agg(expected.index_name order by expected.index_name)
  into invalid_index_names
  from (
    values
      ('members_admin_display_name_trgm_idx'),
      ('members_admin_manual_login_id_trgm_idx'),
      ('mm_user_directory_admin_username_trgm_idx'),
      ('mm_user_directory_admin_user_id_trgm_idx')
  ) as expected(index_name)
  left join pg_catalog.pg_namespace as index_schema
    on index_schema.nspname = 'public'
  left join pg_catalog.pg_class as index_relation
    on index_relation.relnamespace = index_schema.oid
    and index_relation.relname = expected.index_name
    and index_relation.relkind = 'i'
  left join pg_catalog.pg_index as index_metadata
    on index_metadata.indexrelid = index_relation.oid
  left join pg_catalog.pg_am as index_method
    on index_method.oid = index_relation.relam
  where index_relation.oid is null
    or index_metadata.indisvalid is not true
    or index_metadata.indisready is not true
    or index_method.amname <> 'gin'
    or not exists (
      select 1
      from pg_catalog.unnest(index_metadata.indclass::oid[]) as index_opclass(opclass_oid)
      join pg_catalog.pg_opclass as opclass
        on opclass.oid = index_opclass.opclass_oid
      join pg_catalog.pg_namespace as opclass_schema
        on opclass_schema.oid = opclass.opcnamespace
      where opclass.opcname = 'gin_trgm_ops'
        and opclass_schema.nspname = 'extensions'
    );

  if invalid_index_names is not null then
    raise exception 'pg_trgm_index_contract_invalid:%',
      pg_catalog.array_to_string(invalid_index_names, ',');
  end if;
end;
$$;
