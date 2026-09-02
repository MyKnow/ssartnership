create index if not exists admin_audit_logs_properties_path_ops_idx
  on public.admin_audit_logs using gin (properties jsonb_path_ops);

create or replace function public.get_admin_partner_audit_logs(
  input_partner_id uuid,
  input_company_target_id uuid,
  input_company_property_id uuid
)
returns table (
  id uuid,
  actor_id text,
  action text,
  target_type text,
  target_id text,
  properties jsonb,
  created_at timestamp with time zone
)
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  select
    audit_logs.id,
    audit_logs.actor_id,
    audit_logs.action,
    audit_logs.target_type,
    audit_logs.target_id,
    audit_logs.properties,
    audit_logs.created_at
  from public.admin_audit_logs as audit_logs
  where input_partner_id is not null
    and audit_logs.action in (
      'partner_create',
      'partner_update',
      'partner_change_request_approve',
      'partner_change_request_reject',
      'partner_portal_immediate_update',
      'partner_portal_change_request_submit',
      'partner_portal_change_request_cancel',
      'partner_company_create',
      'partner_company_update',
      'partner_company_delete'
    )
    and audit_logs.target_type in (
      'partner',
      'partner_company',
      'partner_change_request'
    )
    and (
      audit_logs.target_id = input_partner_id::text
      or (
        input_company_target_id is not null
        and audit_logs.target_id = input_company_target_id::text
      )
      or audit_logs.properties @> pg_catalog.jsonb_build_object(
        'partnerId',
        input_partner_id::text
      )
      or (
        input_company_property_id is not null
        and audit_logs.properties @> pg_catalog.jsonb_build_object(
          'companyId',
          input_company_property_id::text
        )
      )
    )
  order by audit_logs.created_at desc, audit_logs.id desc
  limit 200;
$$;

revoke all on function public.get_admin_partner_audit_logs(uuid, uuid, uuid) from public;
revoke all on function public.get_admin_partner_audit_logs(uuid, uuid, uuid) from anon;
revoke all on function public.get_admin_partner_audit_logs(uuid, uuid, uuid) from authenticated;
grant execute on function public.get_admin_partner_audit_logs(uuid, uuid, uuid) to service_role;
