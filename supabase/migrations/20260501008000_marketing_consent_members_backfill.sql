with active_marketing_policy as (
  select id, version
  from policy_documents
  where kind = 'marketing'
    and is_active = true
  order by version desc
  limit 1
),
consented_members as (
  select distinct
    m.id as member_id,
    mpc.agreed_at
  from members as m
  join member_policy_consents as mpc
    on mpc.member_id = m.id
  join active_marketing_policy as amp
    on amp.id = mpc.policy_document_id
  where mpc.kind = 'marketing'
    and mpc.version = amp.version
)
update members as m
set marketing_policy_version = amp.version,
    marketing_policy_consented_at = consented_members.agreed_at,
    updated_at = now()
from consented_members,
     active_marketing_policy as amp
where m.id = consented_members.member_id
  and (
    m.marketing_policy_version is distinct from amp.version
    or m.marketing_policy_consented_at is distinct from consented_members.agreed_at
  );

with active_marketing_policy as (
  select id, version
  from policy_documents
  where kind = 'marketing'
    and is_active = true
  order by version desc
  limit 1
),
consented_members as (
  select distinct
    m.id as member_id
  from members as m
  join member_policy_consents as mpc
    on mpc.member_id = m.id
  join active_marketing_policy as amp
    on amp.id = mpc.policy_document_id
  where mpc.kind = 'marketing'
    and mpc.version = amp.version
)
insert into push_preferences (
  member_id,
  marketing_enabled,
  updated_at
)
select
  member_id,
  true,
  now()
from consented_members
on conflict (member_id) do update set
  marketing_enabled = excluded.marketing_enabled,
  updated_at = excluded.updated_at
where push_preferences.marketing_enabled is distinct from excluded.marketing_enabled;
