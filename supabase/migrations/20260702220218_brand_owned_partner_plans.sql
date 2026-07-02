alter table public.partners
  add column if not exists plan_tier text not null default 'basic',
  add column if not exists plan_started_at timestamp with time zone,
  add column if not exists plan_expires_at timestamp with time zone,
  add column if not exists plan_updated_at timestamp with time zone not null default now();

update public.partners
set plan_tier = 'basic'
where plan_tier not in ('basic', 'partner', 'boost');

alter table public.partners
  drop constraint if exists partners_plan_tier_check;
alter table public.partners
  add constraint partners_plan_tier_check
    check (plan_tier in ('basic', 'partner', 'boost'));

update public.partners as partner
set
  plan_tier = coalesce(company.plan_tier, partner.plan_tier, 'basic'),
  plan_started_at = case
    when coalesce(company.plan_tier, partner.plan_tier, 'basic') = 'basic'
      then case
        when partner.period_start is null then null
        else (partner.period_start::text || 'T00:00:00+09:00')::timestamp with time zone
      end
    else coalesce(partner.plan_started_at, company.plan_started_at)
  end,
  plan_expires_at = case
    when coalesce(company.plan_tier, partner.plan_tier, 'basic') = 'basic'
      then case
        when partner.period_end is null then null
        else (partner.period_end::text || 'T23:59:59+09:00')::timestamp with time zone
      end
    else coalesce(partner.plan_expires_at, company.plan_expires_at)
  end,
  plan_updated_at = coalesce(partner.plan_updated_at, company.plan_updated_at, now())
from public.partner_companies as company
where partner.company_id = company.id;

create or replace function public.sync_basic_partner_plan_dates()
returns trigger
language plpgsql
as $$
begin
  if new.plan_tier = 'basic' then
    new.plan_started_at = case
      when new.period_start is null then null
      else (new.period_start::text || 'T00:00:00+09:00')::timestamp with time zone
    end;
    new.plan_expires_at = case
      when new.period_end is null then null
      else (new.period_end::text || 'T23:59:59+09:00')::timestamp with time zone
    end;
  end if;

  if TG_OP = 'UPDATE' then
    new.plan_updated_at = now();
  else
    new.plan_updated_at = coalesce(new.plan_updated_at, now());
  end if;
  return new;
end;
$$;

drop trigger if exists partners_sync_basic_plan_dates on public.partners;
create trigger partners_sync_basic_plan_dates
  before insert or update of plan_tier, period_start, period_end, plan_started_at, plan_expires_at on public.partners
  for each row
  execute function public.sync_basic_partner_plan_dates();

alter table public.partner_plan_upgrade_requests
  add column if not exists partner_id uuid references public.partners(id) on delete cascade;

update public.partner_plan_upgrade_requests as request
set partner_id = picked.partner_id
from (
  select distinct on (company_id)
    company_id,
    id as partner_id
  from public.partners
  where company_id is not null
  order by company_id, created_at desc
) as picked
where request.partner_id is null
  and request.company_id = picked.company_id;

drop index if exists public.partner_plan_upgrade_requests_pending_company_idx;
create unique index if not exists partner_plan_upgrade_requests_pending_partner_idx
  on public.partner_plan_upgrade_requests(partner_id)
  where status = 'pending' and partner_id is not null;
create index if not exists partner_plan_upgrade_requests_partner_created_idx
  on public.partner_plan_upgrade_requests(partner_id, created_at desc);

do $$
begin
  if to_regclass('public.partner_company_plan_events') is not null
     and to_regclass('public.partner_brand_plan_events') is null then
    alter table public.partner_company_plan_events rename to partner_brand_plan_events;
  end if;
end $$;

alter table public.partner_brand_plan_events
  add column if not exists partner_id uuid references public.partners(id) on delete cascade;

update public.partner_brand_plan_events as event
set partner_id = coalesce(request.partner_id, picked.partner_id)
from public.partner_plan_upgrade_requests as request
full join (
  select distinct on (company_id)
    company_id,
    id as partner_id
  from public.partners
  where company_id is not null
  order by company_id, created_at desc
) as picked
  on picked.company_id = request.company_id
where event.partner_id is null
  and (
    event.upgrade_request_id = request.id
    or (event.upgrade_request_id is null and event.company_id = picked.company_id)
  );

drop index if exists public.partner_company_plan_events_company_created_idx;
drop index if exists public.partner_company_plan_events_upgrade_request_idx;
create index if not exists partner_brand_plan_events_partner_created_idx
  on public.partner_brand_plan_events(partner_id, created_at desc);
create index if not exists partner_brand_plan_events_company_created_idx
  on public.partner_brand_plan_events(company_id, created_at desc);
create index if not exists partner_brand_plan_events_upgrade_request_idx
  on public.partner_brand_plan_events(upgrade_request_id);

alter table public.partner_brand_plan_events enable row level security;
revoke all on table public.partner_brand_plan_events from anon;
revoke all on table public.partner_brand_plan_events from authenticated;

alter table public.partner_companies
  drop constraint if exists partner_companies_plan_tier_check;
alter table public.partner_companies
  drop column if exists plan_tier,
  drop column if exists plan_started_at,
  drop column if exists plan_expires_at,
  drop column if exists plan_updated_at;
