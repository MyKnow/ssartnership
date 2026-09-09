create or replace function public.get_admin_member_list_page(
  input_search_pattern text default null,
  input_generation integer default null,
  input_campus text default null,
  input_password_status text default 'all',
  input_mattermost_lifecycle text default 'all',
  input_service_policy_id uuid default null,
  input_privacy_policy_id uuid default null,
  input_marketing_policy_id uuid default null,
  input_service_consent text default 'all',
  input_privacy_consent text default 'all',
  input_marketing_consent text default 'all',
  input_push_enabled text default 'all',
  input_announcement_enabled text default 'all',
  input_new_partner_enabled text default 'all',
  input_expiring_partner_enabled text default 'all',
  input_review_enabled text default 'all',
  input_mm_enabled text default 'all',
  input_marketing_enabled text default 'all',
  input_sort text default 'recent',
  input_offset integer default 0,
  input_page_size integer default 20,
  input_trend_limit integer default 5000
)
returns table (
  member_ids uuid[],
  total_count bigint,
  trend_created_ats timestamp with time zone[]
)
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  with filtered_members as materialized (
    select
      members.id,
      members.display_name,
      members.created_at,
      members.updated_at
    from public.members as members
    left join public.mm_user_directory as directory
      on directory.id = members.mattermost_account_id
    left join public.push_preferences as preferences
      on preferences.member_id = members.id
    left join public.member_policy_consents as service_consent
      on service_consent.member_id = members.id
     and service_consent.policy_document_id = input_service_policy_id
    left join public.member_policy_consents as privacy_consent
      on privacy_consent.member_id = members.id
     and privacy_consent.policy_document_id = input_privacy_policy_id
    left join public.member_policy_consents as marketing_consent
      on marketing_consent.member_id = members.id
     and marketing_consent.policy_document_id = input_marketing_policy_id
    where members.deleted_at is null
      and (
        input_search_pattern is null
        or members.display_name ilike input_search_pattern
        or members.manual_login_id ilike input_search_pattern
        or members.email_normalized ilike input_search_pattern
        or directory.mm_username ilike input_search_pattern
        or directory.mm_user_id ilike input_search_pattern
      )
      and (input_generation is null or members.generation = input_generation)
      and (input_campus is null or members.campus = input_campus)
      and case input_password_status
        when 'all' then true
        when 'mustChangePassword' then members.must_change_password
        when 'normal' then not members.must_change_password
        else false
      end
      and case input_mattermost_lifecycle
        when 'all' then true
        when 'disabled' then members.mattermost_login_disabled_at is not null
        when 'graduated' then members.mattermost_login_disabled_reason = 'generation_completed'
        when 'departed' then members.mattermost_login_disabled_reason = 'member_departed'
        else false
      end
      and case input_service_consent
        when 'all' then true
        when 'agreed' then service_consent.member_id is not null
        when 'pending' then service_consent.member_id is null
        else false
      end
      and case input_privacy_consent
        when 'all' then true
        when 'agreed' then privacy_consent.member_id is not null
        when 'pending' then privacy_consent.member_id is null
        else false
      end
      and case
        when input_marketing_consent = 'all' then true
        when input_marketing_policy_id is null then false
        when input_marketing_consent = 'agreed' then
          marketing_consent.member_id is not null
          and coalesce(preferences.marketing_enabled, false)
        when input_marketing_consent = 'pending' then not (
          marketing_consent.member_id is not null
          and coalesce(preferences.marketing_enabled, false)
        )
        else false
      end
      and case input_push_enabled
        when 'all' then true
        when 'enabled' then coalesce(preferences.enabled, false)
        when 'disabled' then not coalesce(preferences.enabled, false)
        else false
      end
      and case input_announcement_enabled
        when 'all' then true
        when 'enabled' then coalesce(preferences.announcement_enabled, true)
        when 'disabled' then not coalesce(preferences.announcement_enabled, true)
        else false
      end
      and case input_new_partner_enabled
        when 'all' then true
        when 'enabled' then coalesce(preferences.new_partner_enabled, true)
        when 'disabled' then not coalesce(preferences.new_partner_enabled, true)
        else false
      end
      and case input_expiring_partner_enabled
        when 'all' then true
        when 'enabled' then coalesce(preferences.expiring_partner_enabled, true)
        when 'disabled' then not coalesce(preferences.expiring_partner_enabled, true)
        else false
      end
      and case input_review_enabled
        when 'all' then true
        when 'enabled' then coalesce(preferences.review_enabled, true)
        when 'disabled' then not coalesce(preferences.review_enabled, true)
        else false
      end
      and case input_mm_enabled
        when 'all' then true
        when 'enabled' then coalesce(preferences.mm_enabled, true)
        when 'disabled' then not coalesce(preferences.mm_enabled, true)
        else false
      end
      and case input_marketing_enabled
        when 'all' then true
        when 'enabled' then coalesce(preferences.marketing_enabled, false)
        when 'disabled' then not coalesce(preferences.marketing_enabled, false)
        else false
      end
  )
  select
    array(
      select page_member.id
      from filtered_members as page_member
      order by
        case when input_sort = 'name' then page_member.display_name end asc nulls last,
        case when input_sort = 'updated' then page_member.updated_at end desc nulls first,
        case
          when coalesce(input_sort, 'recent') not in ('name', 'updated')
            then page_member.created_at
        end desc nulls first,
        page_member.id asc
      limit least(
        greatest(coalesce(input_page_size, 20), 1),
        100
      )
      offset greatest(coalesce(input_offset, 0), 0)
    ) as member_ids,
    (
      select pg_catalog.count(*)::bigint
      from filtered_members
    ) as total_count,
    array(
      select trend_member.created_at
      from filtered_members as trend_member
      order by trend_member.created_at desc nulls first, trend_member.id asc
      limit least(
        greatest(coalesce(input_trend_limit, 5000), 1),
        5000
      )
    ) as trend_created_ats;
$$;

revoke all on function public.get_admin_member_list_page(text, integer, text, text, text, uuid, uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, integer, integer, integer) from public;
revoke all on function public.get_admin_member_list_page(text, integer, text, text, text, uuid, uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, integer, integer, integer) from anon;
revoke all on function public.get_admin_member_list_page(text, integer, text, text, text, uuid, uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, integer, integer, integer) from authenticated;
grant execute on function public.get_admin_member_list_page(text, integer, text, text, text, uuid, uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, integer, integer, integer) to service_role;
