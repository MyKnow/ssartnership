alter table public.partner_billing_profiles
  add column if not exists account_id uuid references public.partner_accounts(id) on delete cascade,
  add column if not exists label text not null default '기본 세금계산서 정보',
  add column if not exists payer_name text not null default '',
  add column if not exists is_default boolean not null default false,
  add column if not exists last_used_at timestamp with time zone,
  add column if not exists archived_at timestamp with time zone;

alter table public.partner_billing_profiles
  drop constraint if exists partner_billing_profiles_company_id_key;

update public.partner_billing_profiles profile
set
  label = coalesce(nullif(profile.business_name, ''), '기본 세금계산서 정보'),
  payer_name = coalesce(
    nullif((
      select request.payer_name
      from public.partner_plan_upgrade_requests request
      where request.company_id = profile.company_id
        and request.payer_name <> ''
      order by request.created_at desc
      limit 1
    ), ''),
    nullif(profile.business_name, ''),
    '입금자명 미지정'
  ),
  is_default = true,
  last_used_at = (
    select request.created_at
    from public.partner_plan_upgrade_requests request
    where request.company_id = profile.company_id
    order by request.created_at desc
    limit 1
  )
where profile.archived_at is null;

alter table public.partner_billing_profiles
  add constraint partner_billing_profiles_label_check
    check (char_length(label) between 1 and 80),
  add constraint partner_billing_profiles_payer_name_check
    check (char_length(payer_name) between 1 and 80);

create index if not exists partner_billing_profiles_account_company_idx
  on public.partner_billing_profiles(account_id, company_id, archived_at, updated_at desc);

create index if not exists partner_billing_profiles_company_active_idx
  on public.partner_billing_profiles(company_id, archived_at, updated_at desc);

create unique index if not exists partner_billing_profiles_default_account_company_idx
  on public.partner_billing_profiles(account_id, company_id)
  where is_default
    and archived_at is null
    and account_id is not null;
