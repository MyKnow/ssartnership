create table if not exists public.ad_campaigns (
  id uuid primary key default uuid_generate_v4(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  package_tier text not null default 'basic',
  title text not null,
  description text not null default '',
  sponsor_label text not null default '',
  status text not null default 'draft',
  starts_at timestamp with time zone not null,
  ends_at timestamp with time zone not null,
  channels text[] not null default array['coupon']::text[],
  monthly_price_krw integer not null default 0,
  notes text not null default '',
  created_by_admin_id text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint ad_campaigns_package_tier_check
    check (package_tier in ('basic', 'partner', 'boost', 'sponsor')),
  constraint ad_campaigns_status_check
    check (status in ('draft', 'active', 'paused', 'ended')),
  constraint ad_campaigns_period_check
    check (starts_at <= ends_at),
  constraint ad_campaigns_price_check
    check (monthly_price_krw >= 0),
  constraint ad_campaigns_channels_check
    check (
      channels <@ array['coupon', 'home_banner', 'push']::text[]
      and array_length(channels, 1) is not null
    )
);

comment on table public.ad_campaigns is
  'Direct-sold sponsorship and advertising packages for partner monetization.';

create index if not exists ad_campaigns_partner_status_period_idx
  on public.ad_campaigns(partner_id, status, starts_at desc, ends_at desc);
create index if not exists ad_campaigns_updated_at_idx
  on public.ad_campaigns(updated_at desc);

create or replace function public.set_ad_campaigns_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists ad_campaigns_set_updated_at on public.ad_campaigns;
create trigger ad_campaigns_set_updated_at
before update on public.ad_campaigns
for each row
execute function public.set_ad_campaigns_updated_at();

create table if not exists public.ad_coupons (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid references public.ad_campaigns(id) on delete set null,
  partner_id uuid not null references public.partners(id) on delete cascade,
  title text not null,
  description text not null default '',
  code text not null default '',
  redemption_type text not null default 'onsite',
  discount_label text not null default '',
  terms text[] not null default '{}'::text[],
  status text not null default 'draft',
  starts_at timestamp with time zone not null,
  ends_at timestamp with time zone not null,
  usage_limit integer,
  per_member_limit integer not null default 1,
  external_url text not null default '',
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint ad_coupons_status_check
    check (status in ('draft', 'active', 'paused', 'ended')),
  constraint ad_coupons_redemption_type_check
    check (redemption_type in ('onsite', 'code', 'external')),
  constraint ad_coupons_period_check
    check (starts_at <= ends_at),
  constraint ad_coupons_usage_limit_check
    check (usage_limit is null or usage_limit >= 0),
  constraint ad_coupons_per_member_limit_check
    check (per_member_limit >= 1)
);

comment on table public.ad_coupons is
  'Coupons attached to advertising packages and partner sponsorship campaigns.';

create index if not exists ad_coupons_partner_status_period_idx
  on public.ad_coupons(partner_id, status, starts_at desc, ends_at desc);
create index if not exists ad_coupons_campaign_idx
  on public.ad_coupons(campaign_id);
create index if not exists ad_coupons_updated_at_idx
  on public.ad_coupons(updated_at desc);

create or replace function public.set_ad_coupons_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists ad_coupons_set_updated_at on public.ad_coupons;
create trigger ad_coupons_set_updated_at
before update on public.ad_coupons
for each row
execute function public.set_ad_coupons_updated_at();

create table if not exists public.ad_coupon_redemptions (
  id uuid primary key default uuid_generate_v4(),
  coupon_id uuid not null references public.ad_coupons(id) on delete cascade,
  campaign_id uuid references public.ad_campaigns(id) on delete set null,
  partner_id uuid not null references public.partners(id) on delete cascade,
  member_id uuid references public.members(id) on delete set null,
  session_id text,
  status text not null default 'redeemed',
  redemption_code text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  constraint ad_coupon_redemptions_status_check
    check (status in ('redeemed', 'cancelled')),
  constraint ad_coupon_redemptions_metadata_object_check
    check (jsonb_typeof(metadata) = 'object')
);

comment on table public.ad_coupon_redemptions is
  'Member coupon redemption intents and onsite use confirmations for ad package reporting.';

create index if not exists ad_coupon_redemptions_coupon_created_idx
  on public.ad_coupon_redemptions(coupon_id, created_at desc);
create index if not exists ad_coupon_redemptions_campaign_created_idx
  on public.ad_coupon_redemptions(campaign_id, created_at desc);
create index if not exists ad_coupon_redemptions_partner_created_idx
  on public.ad_coupon_redemptions(partner_id, created_at desc);
create index if not exists ad_coupon_redemptions_member_coupon_idx
  on public.ad_coupon_redemptions(member_id, coupon_id)
  where member_id is not null and status = 'redeemed';

alter table public.promotion_slides
  add column if not exists ad_campaign_id uuid references public.ad_campaigns(id) on delete set null,
  add column if not exists sponsor_label text not null default '';

create index if not exists promotion_slides_ad_campaign_idx
  on public.promotion_slides(ad_campaign_id);

alter table public.ad_campaigns enable row level security;
alter table public.ad_coupons enable row level security;
alter table public.ad_coupon_redemptions enable row level security;

revoke all on table public.ad_campaigns from anon;
revoke all on table public.ad_campaigns from authenticated;
revoke all on table public.ad_coupons from anon;
revoke all on table public.ad_coupons from authenticated;
revoke all on table public.ad_coupon_redemptions from anon;
revoke all on table public.ad_coupon_redemptions from authenticated;
