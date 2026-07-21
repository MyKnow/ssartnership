-- Backfill the new daily projection from immutable raw product logs.
-- Grouping makes this idempotent and avoids one upsert per historical event.
with grouped_activity as (
  select
    (coalesce(event_logs.recorded_at, event_logs.created_at) at time zone 'Asia/Seoul')::date as activity_date,
    identity.identity_kind,
    identity.identity_hash,
    min(coalesce(event_logs.recorded_at, event_logs.created_at)) as first_event_at,
    max(coalesce(event_logs.recorded_at, event_logs.created_at)) as last_event_at
  from public.event_logs
  cross join lateral public.platform_activity_identity_key(
    event_logs.actor_type,
    event_logs.actor_id,
    event_logs.session_id
  ) as identity
  where coalesce(event_logs.recorded_at, event_logs.created_at) is not null
  group by
    (coalesce(event_logs.recorded_at, event_logs.created_at) at time zone 'Asia/Seoul')::date,
    identity.identity_kind,
    identity.identity_hash
)
insert into public.platform_active_identities (
  activity_date,
  identity_kind,
  identity_hash,
  first_event_at,
  last_event_at
)
select
  activity_date,
  identity_kind,
  identity_hash,
  first_event_at,
  last_event_at
from grouped_activity
on conflict (activity_date, identity_kind, identity_hash)
do update
set
  first_event_at = least(
    public.platform_active_identities.first_event_at,
    excluded.first_event_at
  ),
  last_event_at = greatest(
    public.platform_active_identities.last_event_at,
    excluded.last_event_at
  ),
  updated_at = now();
