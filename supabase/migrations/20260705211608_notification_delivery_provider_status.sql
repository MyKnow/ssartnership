alter table public.notification_deliveries
  add column if not exists provider text,
  add column if not exists provider_notification_id text,
  add column if not exists provider_campaign_id text,
  add column if not exists provider_idempotency_key text,
  add column if not exists provider_status text,
  add column if not exists updated_at timestamp with time zone default now();

update public.notification_deliveries
set updated_at = coalesce(updated_at, created_at, now())
where updated_at is null;

create index if not exists notification_deliveries_provider_notification_idx
  on public.notification_deliveries(provider, provider_notification_id)
  where provider_notification_id is not null;

create index if not exists notification_deliveries_provider_campaign_idx
  on public.notification_deliveries(provider, provider_campaign_id, created_at desc)
  where provider_campaign_id is not null;

create index if not exists notification_deliveries_provider_pending_idx
  on public.notification_deliveries(provider, channel, status, created_at desc)
  where provider is not null;

drop trigger if exists notification_deliveries_set_updated_at
  on public.notification_deliveries;
create trigger notification_deliveries_set_updated_at
  before update on public.notification_deliveries
  for each row
  execute function public.set_partnership_updated_at();
