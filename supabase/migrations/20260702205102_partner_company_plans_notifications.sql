alter table public.partner_companies
  add column if not exists plan_tier text not null default 'basic',
  add column if not exists plan_started_at timestamp with time zone,
  add column if not exists plan_expires_at timestamp with time zone,
  add column if not exists plan_updated_at timestamp with time zone not null default now();

update public.partner_companies
set plan_tier = 'basic'
where plan_tier not in ('basic', 'partner', 'boost');

alter table public.partner_companies
  drop constraint if exists partner_companies_plan_tier_check;
alter table public.partner_companies
  add constraint partner_companies_plan_tier_check
    check (plan_tier in ('basic', 'partner', 'boost'));

create table if not exists public.partner_plan_upgrade_requests (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.partner_companies(id) on delete cascade,
  requested_by_account_id uuid not null references public.partner_accounts(id) on delete cascade,
  current_plan_tier text not null,
  requested_plan_tier text not null,
  status text not null default 'pending',
  payment_amount_krw integer not null default 0,
  payer_name text not null default '',
  memo text not null default '',
  admin_note text not null default '',
  reviewed_by_admin_id uuid references public.members(id) on delete set null,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint partner_plan_upgrade_requests_current_plan_check
    check (current_plan_tier in ('basic', 'partner', 'boost')),
  constraint partner_plan_upgrade_requests_requested_plan_check
    check (requested_plan_tier in ('basic', 'partner', 'boost')),
  constraint partner_plan_upgrade_requests_status_check
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  constraint partner_plan_upgrade_requests_amount_check
    check (payment_amount_krw >= 0)
);

create unique index if not exists partner_plan_upgrade_requests_pending_company_idx
  on public.partner_plan_upgrade_requests(company_id)
  where status = 'pending';
create index if not exists partner_plan_upgrade_requests_company_created_idx
  on public.partner_plan_upgrade_requests(company_id, created_at desc);
create index if not exists partner_plan_upgrade_requests_account_created_idx
  on public.partner_plan_upgrade_requests(requested_by_account_id, created_at desc);

drop trigger if exists partner_plan_upgrade_requests_set_updated_at
  on public.partner_plan_upgrade_requests;
create trigger partner_plan_upgrade_requests_set_updated_at
  before update on public.partner_plan_upgrade_requests
  for each row
  execute function public.set_partnership_updated_at();

create table if not exists public.partner_company_plan_events (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.partner_companies(id) on delete cascade,
  upgrade_request_id uuid references public.partner_plan_upgrade_requests(id) on delete set null,
  previous_plan_tier text,
  next_plan_tier text not null,
  source text not null default 'admin',
  actor_admin_id uuid references public.members(id) on delete set null,
  actor_partner_account_id uuid references public.partner_accounts(id) on delete set null,
  plan_started_at timestamp with time zone,
  plan_expires_at timestamp with time zone,
  note text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  constraint partner_company_plan_events_previous_plan_check
    check (previous_plan_tier is null or previous_plan_tier in ('basic', 'partner', 'boost')),
  constraint partner_company_plan_events_next_plan_check
    check (next_plan_tier in ('basic', 'partner', 'boost')),
  constraint partner_company_plan_events_source_check
    check (source in ('admin', 'partner_upgrade', 'expiration', 'system'))
);

create index if not exists partner_company_plan_events_company_created_idx
  on public.partner_company_plan_events(company_id, created_at desc);
create index if not exists partner_company_plan_events_upgrade_request_idx
  on public.partner_company_plan_events(upgrade_request_id);

update public.ad_campaigns
set
  package_tier = 'boost',
  notes = trim(concat(notes, case when notes = '' then '' else E'\n' end, 'Legacy Sponsor tier converted to Boost.'))
where package_tier = 'sponsor';

alter table public.ad_campaigns
  drop constraint if exists ad_campaigns_package_tier_check;
alter table public.ad_campaigns
  add constraint ad_campaigns_package_tier_check
    check (package_tier in ('basic', 'partner', 'boost'));

alter table public.ad_campaigns
  drop constraint if exists ad_campaigns_channels_check;
alter table public.ad_campaigns
  add constraint ad_campaigns_channels_check
    check (
      channels <@ array['coupon', 'home_banner', 'push', 'mm', 'ad_banner']::text[]
      and array_length(channels, 1) is not null
    );

create table if not exists public.admin_notification_preferences (
  admin_id uuid primary key references public.members(id) on delete cascade,
  enabled boolean not null default true,
  portal_enabled boolean not null default true,
  push_enabled boolean not null default true,
  security_enabled boolean not null default true,
  partner_request_enabled boolean not null default true,
  expiring_partner_enabled boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.admin_push_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  admin_id uuid not null references public.members(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  expiration_time timestamp with time zone,
  user_agent text,
  is_active boolean not null default true,
  failure_reason text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  last_success_at timestamp with time zone,
  last_failure_at timestamp with time zone
);

create table if not exists public.admin_notifications (
  id uuid primary key default uuid_generate_v4(),
  type text not null,
  title text not null,
  body text not null,
  target_url text not null default '/admin',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  constraint admin_notifications_type_check
    check (type in ('partner_change_request', 'partner_immediate_update', 'expiring_partner', 'security_alert'))
);

create table if not exists public.admin_notification_recipients (
  id uuid primary key default uuid_generate_v4(),
  notification_id uuid not null references public.admin_notifications(id) on delete cascade,
  admin_id uuid not null references public.members(id) on delete cascade,
  read_at timestamp with time zone,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (notification_id, admin_id)
);

create table if not exists public.admin_notification_deliveries (
  id uuid primary key default uuid_generate_v4(),
  notification_id uuid not null references public.admin_notifications(id) on delete cascade,
  admin_id uuid references public.members(id) on delete cascade,
  channel text not null,
  status text not null,
  error_message text,
  delivered_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  constraint admin_notification_deliveries_channel_check
    check (channel in ('portal', 'push')),
  constraint admin_notification_deliveries_status_check
    check (status in ('pending', 'sent', 'failed', 'skipped'))
);

create table if not exists public.partner_notification_preferences (
  account_id uuid primary key references public.partner_accounts(id) on delete cascade,
  enabled boolean not null default true,
  portal_enabled boolean not null default true,
  push_enabled boolean not null default true,
  email_enabled boolean not null default true,
  plan_enabled boolean not null default true,
  expiring_partner_enabled boolean not null default true,
  metrics_enabled boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.partner_push_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid not null references public.partner_accounts(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  expiration_time timestamp with time zone,
  user_agent text,
  is_active boolean not null default true,
  failure_reason text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  last_success_at timestamp with time zone,
  last_failure_at timestamp with time zone
);

create table if not exists public.partner_notifications (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid references public.partner_companies(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  target_url text not null default '/partner/notifications',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  constraint partner_notifications_type_check
    check (type in ('expiring_partner', 'plan_changed', 'plan_upgrade_requested', 'plan_upgrade_approved', 'plan_upgrade_rejected', 'metrics_digest'))
);

create table if not exists public.partner_notification_recipients (
  id uuid primary key default uuid_generate_v4(),
  notification_id uuid not null references public.partner_notifications(id) on delete cascade,
  account_id uuid not null references public.partner_accounts(id) on delete cascade,
  read_at timestamp with time zone,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (notification_id, account_id)
);

create table if not exists public.partner_notification_deliveries (
  id uuid primary key default uuid_generate_v4(),
  notification_id uuid not null references public.partner_notifications(id) on delete cascade,
  account_id uuid references public.partner_accounts(id) on delete cascade,
  channel text not null,
  status text not null,
  error_message text,
  delivered_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  constraint partner_notification_deliveries_channel_check
    check (channel in ('portal', 'push', 'email')),
  constraint partner_notification_deliveries_status_check
    check (status in ('pending', 'sent', 'failed', 'skipped'))
);

create table if not exists public.operational_notification_dedupes (
  dedupe_key text primary key,
  audience text not null,
  notification_type text not null,
  target_id text not null,
  created_at timestamp with time zone not null default now(),
  constraint operational_notification_dedupes_audience_check
    check (audience in ('admin', 'partner'))
);

create index if not exists admin_push_subscriptions_admin_active_idx
  on public.admin_push_subscriptions(admin_id)
  where is_active = true;
create index if not exists admin_notification_recipients_admin_created_idx
  on public.admin_notification_recipients(admin_id, created_at desc);
create index if not exists admin_notification_deliveries_notification_idx
  on public.admin_notification_deliveries(notification_id);
create index if not exists partner_push_subscriptions_account_active_idx
  on public.partner_push_subscriptions(account_id)
  where is_active = true;
create index if not exists partner_notifications_company_created_idx
  on public.partner_notifications(company_id, created_at desc);
create index if not exists partner_notification_recipients_account_created_idx
  on public.partner_notification_recipients(account_id, created_at desc);
create index if not exists partner_notification_deliveries_notification_idx
  on public.partner_notification_deliveries(notification_id);

drop trigger if exists admin_notification_preferences_set_updated_at
  on public.admin_notification_preferences;
create trigger admin_notification_preferences_set_updated_at
  before update on public.admin_notification_preferences
  for each row
  execute function public.set_partnership_updated_at();

drop trigger if exists admin_push_subscriptions_set_updated_at
  on public.admin_push_subscriptions;
create trigger admin_push_subscriptions_set_updated_at
  before update on public.admin_push_subscriptions
  for each row
  execute function public.set_partnership_updated_at();

drop trigger if exists admin_notification_recipients_set_updated_at
  on public.admin_notification_recipients;
create trigger admin_notification_recipients_set_updated_at
  before update on public.admin_notification_recipients
  for each row
  execute function public.set_partnership_updated_at();

drop trigger if exists partner_notification_preferences_set_updated_at
  on public.partner_notification_preferences;
create trigger partner_notification_preferences_set_updated_at
  before update on public.partner_notification_preferences
  for each row
  execute function public.set_partnership_updated_at();

drop trigger if exists partner_push_subscriptions_set_updated_at
  on public.partner_push_subscriptions;
create trigger partner_push_subscriptions_set_updated_at
  before update on public.partner_push_subscriptions
  for each row
  execute function public.set_partnership_updated_at();

drop trigger if exists partner_notification_recipients_set_updated_at
  on public.partner_notification_recipients;
create trigger partner_notification_recipients_set_updated_at
  before update on public.partner_notification_recipients
  for each row
  execute function public.set_partnership_updated_at();

alter table public.partner_plan_upgrade_requests enable row level security;
alter table public.partner_company_plan_events enable row level security;
alter table public.admin_notification_preferences enable row level security;
alter table public.admin_push_subscriptions enable row level security;
alter table public.admin_notifications enable row level security;
alter table public.admin_notification_recipients enable row level security;
alter table public.admin_notification_deliveries enable row level security;
alter table public.partner_notification_preferences enable row level security;
alter table public.partner_push_subscriptions enable row level security;
alter table public.partner_notifications enable row level security;
alter table public.partner_notification_recipients enable row level security;
alter table public.partner_notification_deliveries enable row level security;
alter table public.operational_notification_dedupes enable row level security;

revoke all on table public.partner_plan_upgrade_requests from anon;
revoke all on table public.partner_plan_upgrade_requests from authenticated;
revoke all on table public.partner_company_plan_events from anon;
revoke all on table public.partner_company_plan_events from authenticated;
revoke all on table public.admin_notification_preferences from anon;
revoke all on table public.admin_notification_preferences from authenticated;
revoke all on table public.admin_push_subscriptions from anon;
revoke all on table public.admin_push_subscriptions from authenticated;
revoke all on table public.admin_notifications from anon;
revoke all on table public.admin_notifications from authenticated;
revoke all on table public.admin_notification_recipients from anon;
revoke all on table public.admin_notification_recipients from authenticated;
revoke all on table public.admin_notification_deliveries from anon;
revoke all on table public.admin_notification_deliveries from authenticated;
revoke all on table public.partner_notification_preferences from anon;
revoke all on table public.partner_notification_preferences from authenticated;
revoke all on table public.partner_push_subscriptions from anon;
revoke all on table public.partner_push_subscriptions from authenticated;
revoke all on table public.partner_notifications from anon;
revoke all on table public.partner_notifications from authenticated;
revoke all on table public.partner_notification_recipients from anon;
revoke all on table public.partner_notification_recipients from authenticated;
revoke all on table public.partner_notification_deliveries from anon;
revoke all on table public.partner_notification_deliveries from authenticated;
revoke all on table public.operational_notification_dedupes from anon;
revoke all on table public.operational_notification_dedupes from authenticated;
