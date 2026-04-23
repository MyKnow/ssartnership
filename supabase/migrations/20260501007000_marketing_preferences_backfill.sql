with active_marketing_policy as (
  select version
  from policy_documents
  where kind = 'marketing'
    and is_active = true
  order by version desc
  limit 1
)
update push_preferences as p
set marketing_enabled = (
      m.marketing_policy_version is not null
      and m.marketing_policy_version = amp.version
    ),
    updated_at = now()
from members as m,
     active_marketing_policy as amp
where p.member_id = m.id
  and p.marketing_enabled is distinct from (
    m.marketing_policy_version is not null
    and m.marketing_policy_version = amp.version
  );
