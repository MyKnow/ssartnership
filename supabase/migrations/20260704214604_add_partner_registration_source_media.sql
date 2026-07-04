alter table public.partner_registration_requests
  add column if not exists source text not null default 'public_web',
  add column if not exists company_id uuid references public.partner_companies(id) on delete set null,
  add column if not exists requested_by_partner_account_id uuid references public.partner_accounts(id) on delete set null,
  add column if not exists thumbnail_url text,
  add column if not exists image_urls text[] not null default '{}';

alter table public.partner_registration_requests
  drop constraint if exists partner_registration_requests_source_check;
alter table public.partner_registration_requests
  add constraint partner_registration_requests_source_check
  check (source in ('public_web', 'public_excel', 'partner_portal'));

create index if not exists partner_registration_requests_source_created_idx
  on public.partner_registration_requests(source, created_at desc);

create index if not exists partner_registration_requests_company_created_idx
  on public.partner_registration_requests(company_id, created_at desc)
  where company_id is not null;

create index if not exists partner_registration_requests_requested_account_created_idx
  on public.partner_registration_requests(requested_by_partner_account_id, created_at desc)
  where requested_by_partner_account_id is not null;
