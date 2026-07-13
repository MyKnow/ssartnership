-- Keep the immutable consent ledger separate from the member's current
-- marketing delivery preference before the legacy members mirror is removed.
with active_marketing_policy as (
  select version
  from public.policy_documents
  where kind = 'marketing'
    and is_active = true
  order by version desc
  limit 1
)
insert into public.push_preferences (
  member_id,
  marketing_enabled,
  updated_at
)
select
  member.id,
  coalesce(member.marketing_policy_version = active_marketing_policy.version, false),
  now()
from public.members as member
left join active_marketing_policy on true
where member.deleted_at is null
on conflict (member_id) do update
set marketing_enabled = excluded.marketing_enabled,
    updated_at = excluded.updated_at
where public.push_preferences.marketing_enabled
  is distinct from excluded.marketing_enabled;
