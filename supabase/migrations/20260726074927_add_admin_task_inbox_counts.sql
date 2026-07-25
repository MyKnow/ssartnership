-- Keep the task inbox to one scope-aware read so its first useful state does
-- not wait for independent count requests. Rollback: drop function
-- public.get_admin_task_inbox_counts(uuid, text[], boolean, boolean, boolean, boolean, boolean).

create or replace function public.get_admin_task_inbox_counts(
  input_admin_id uuid,
  input_managed_campus_slugs text[] default null,
  input_include_brand_queues boolean default false,
  input_include_graduate_verifications boolean default false,
  input_include_signup_requests boolean default false,
  input_include_profile_photos boolean default false,
  input_include_notifications boolean default false
)
returns table (
  registration_pending_count bigint,
  change_request_pending_count bigint,
  graduate_verification_pending_count bigint,
  signup_request_pending_count bigint,
  profile_photo_pending_count bigint,
  unread_notification_count bigint
)
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  with scope as (
    select
      input_managed_campus_slugs is null as is_global,
      coalesce(input_managed_campus_slugs, '{}'::text[]) as managed_campus_slugs
  )
  select
    case when input_include_brand_queues then (
      select count(*)::bigint
      from public.partner_registration_requests as request
      left join public.partner_companies as company on company.id = request.company_id
      where request.status in ('pending', 'in_review')
        and (
          scope.is_global
          or (
            company.id is not null
            and company.managed_campus_slugs && scope.managed_campus_slugs
          )
          or (
            company.id is null
            and request.location ~ '(전국|전\s*지점|전체\s*지점|모든\s*지점|전\s*매장|전체\s*매장|모든\s*매장|서울|강남|역삼|역삼역|선릉|테헤란|봉은사|논현|구미|경북|경상북도|대전|유성|둔산|부산|울산|경남|창원|김해|양산|해운대|서면|광주|전남)'
            and public.infer_partner_campus_slugs(request.location) && scope.managed_campus_slugs
          )
        )
    ) else null end,
    case when input_include_brand_queues then (
      select count(*)::bigint
      from public.partner_change_requests as request
      join public.partners as partner on partner.id = request.partner_id
      where request.status = 'pending'
        and (scope.is_global or partner.managed_campus_slugs && scope.managed_campus_slugs)
    ) else null end,
    case when input_include_graduate_verifications then (
      select count(*)::bigint
      from public.graduate_verification_requests
      where status in ('submitted', 'in_review')
    ) else null end,
    case when input_include_signup_requests then (
      select count(*)::bigint
      from public.member_signup_approval_requests
      where status = 'pending'
    ) else null end,
    case when input_include_profile_photos then (
      select count(*)::bigint
      from public.member_profile_images
      where graduate_verification_request_id is null
        and member_id is not null
        and status = 'pending'
    ) else null end,
    case when input_include_notifications then (
      select count(*)::bigint
      from public.admin_notification_recipients
      where admin_id = input_admin_id
        and deleted_at is null
        and read_at is null
    ) else null end
  from scope;
$$;

revoke all on function public.get_admin_task_inbox_counts(uuid, text[], boolean, boolean, boolean, boolean, boolean) from public;
revoke all on function public.get_admin_task_inbox_counts(uuid, text[], boolean, boolean, boolean, boolean, boolean) from anon;
revoke all on function public.get_admin_task_inbox_counts(uuid, text[], boolean, boolean, boolean, boolean, boolean) from authenticated;
grant execute on function public.get_admin_task_inbox_counts(uuid, text[], boolean, boolean, boolean, boolean, boolean) to service_role;
