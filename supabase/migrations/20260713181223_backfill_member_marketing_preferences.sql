-- Keep the immutable consent ledger separate from the member's current
-- marketing delivery preference before the legacy members mirror is removed.
with active_marketing_policy as (
  select id, version
  from public.policy_documents
  where kind = 'marketing'
    and is_active = true
  order by version desc
  limit 1
),
current_marketing_consents as (
  select distinct consent.member_id
  from public.member_policy_consents as consent
  join active_marketing_policy
    on consent.policy_document_id = active_marketing_policy.id
  where consent.kind = 'marketing'
    and consent.version = active_marketing_policy.version
)
insert into public.push_preferences (
  member_id,
  marketing_enabled,
  updated_at
)
select
  member.id,
  current_marketing_consents.member_id is not null,
  now()
from public.members as member
left join current_marketing_consents
  on current_marketing_consents.member_id = member.id
where member.deleted_at is null
-- An existing preference may be an explicit opt-out. Keep it unchanged.
on conflict (member_id) do nothing;
