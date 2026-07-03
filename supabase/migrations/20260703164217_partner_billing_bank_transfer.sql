create table if not exists public.partner_billing_profiles (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.partner_companies(id) on delete cascade,
  business_registration_number text not null,
  business_name text not null,
  representative_name text not null,
  business_address text not null,
  business_type text not null,
  business_item text not null,
  tax_invoice_email text not null,
  tax_document_type text not null default 'tax_invoice',
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (company_id),
  constraint partner_billing_profiles_brn_check
    check (business_registration_number ~ '^[0-9]{10}$'),
  constraint partner_billing_profiles_email_check
    check (position('@' in tax_invoice_email) > 1),
  constraint partner_billing_profiles_tax_document_type_check
    check (tax_document_type in ('tax_invoice'))
);

create table if not exists public.partner_billing_invoices (
  id uuid primary key default uuid_generate_v4(),
  invoice_number text not null unique,
  company_id uuid not null references public.partner_companies(id) on delete cascade,
  partner_id uuid not null references public.partners(id) on delete cascade,
  upgrade_request_id uuid references public.partner_plan_upgrade_requests(id) on delete set null,
  requested_by_account_id uuid references public.partner_accounts(id) on delete set null,
  billing_reason text not null default 'plan_upgrade',
  billing_policy text not null,
  payment_method text not null default 'manual_bank_transfer',
  status text not null default 'pending_payment',
  current_plan_tier text not null,
  requested_plan_tier text not null,
  remaining_days integer not null default 30,
  service_period_start timestamp with time zone,
  service_period_end timestamp with time zone,
  supply_amount_krw integer not null,
  vat_amount_krw integer not null,
  total_amount_krw integer not null,
  issue_date date not null default current_date,
  due_at timestamp with time zone not null,
  paid_at timestamp with time zone,
  overdue_marked_at timestamp with time zone,
  downgraded_at timestamp with time zone,
  cancelled_at timestamp with time zone,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint partner_billing_invoices_reason_check
    check (billing_reason in ('plan_upgrade', 'recurring_plan', 'manual_adjustment', 'overdue_downgrade')),
  constraint partner_billing_invoices_policy_check
    check (billing_policy in ('first_month_full_amount', 'remaining_period_difference')),
  constraint partner_billing_invoices_payment_method_check
    check (payment_method in ('manual_bank_transfer')),
  constraint partner_billing_invoices_status_check
    check (status in ('pending_payment', 'paid', 'overdue', 'cancelled')),
  constraint partner_billing_invoices_current_plan_check
    check (current_plan_tier in ('basic', 'partner', 'boost')),
  constraint partner_billing_invoices_requested_plan_check
    check (requested_plan_tier in ('basic', 'partner', 'boost')),
  constraint partner_billing_invoices_remaining_days_check
    check (remaining_days > 0),
  constraint partner_billing_invoices_amount_check
    check (
      supply_amount_krw >= 0
      and vat_amount_krw >= 0
      and total_amount_krw >= 0
      and total_amount_krw = supply_amount_krw + vat_amount_krw
    )
);

create table if not exists public.partner_billing_payments (
  id uuid primary key default uuid_generate_v4(),
  invoice_id uuid not null references public.partner_billing_invoices(id) on delete cascade,
  method text not null default 'manual_bank_transfer',
  status text not null default 'awaiting_transfer',
  amount_krw integer not null,
  payer_name text not null default '',
  memo text not null default '',
  confirmed_by_admin_id uuid references public.members(id) on delete set null,
  confirmed_at timestamp with time zone,
  failure_reason text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint partner_billing_payments_method_check
    check (method in ('manual_bank_transfer')),
  constraint partner_billing_payments_status_check
    check (status in ('awaiting_transfer', 'confirmed', 'cancelled', 'failed')),
  constraint partner_billing_payments_amount_check
    check (amount_krw >= 0)
);

create table if not exists public.partner_tax_documents (
  id uuid primary key default uuid_generate_v4(),
  invoice_id uuid not null unique references public.partner_billing_invoices(id) on delete cascade,
  type text not null default 'tax_invoice',
  status text not null default 'requested',
  business_registration_number text not null,
  business_name text not null,
  representative_name text not null,
  business_address text not null,
  business_type text not null,
  business_item text not null,
  tax_invoice_email text not null,
  provider text not null default 'manual_hometax',
  external_document_id text,
  issued_by_admin_id uuid references public.members(id) on delete set null,
  issued_at timestamp with time zone,
  sent_at timestamp with time zone,
  cancelled_at timestamp with time zone,
  failure_reason text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint partner_tax_documents_type_check
    check (type in ('tax_invoice')),
  constraint partner_tax_documents_status_check
    check (status in ('requested', 'pending_issue', 'issued', 'cancelled')),
  constraint partner_tax_documents_brn_check
    check (business_registration_number ~ '^[0-9]{10}$')
);

alter table public.partner_plan_upgrade_requests
  add column if not exists billing_invoice_id uuid references public.partner_billing_invoices(id) on delete set null;

create unique index if not exists partner_plan_upgrade_requests_billing_invoice_idx
  on public.partner_plan_upgrade_requests(billing_invoice_id)
  where billing_invoice_id is not null;
create index if not exists partner_billing_profiles_company_idx
  on public.partner_billing_profiles(company_id);
create index if not exists partner_billing_invoices_company_status_due_idx
  on public.partner_billing_invoices(company_id, status, due_at);
create index if not exists partner_billing_invoices_partner_created_idx
  on public.partner_billing_invoices(partner_id, created_at desc);
create index if not exists partner_billing_invoices_upgrade_request_idx
  on public.partner_billing_invoices(upgrade_request_id);
create index if not exists partner_billing_payments_invoice_idx
  on public.partner_billing_payments(invoice_id, created_at desc);
create index if not exists partner_tax_documents_status_created_idx
  on public.partner_tax_documents(status, created_at desc);

drop trigger if exists partner_billing_profiles_set_updated_at
  on public.partner_billing_profiles;
create trigger partner_billing_profiles_set_updated_at
  before update on public.partner_billing_profiles
  for each row
  execute function public.set_partnership_updated_at();

drop trigger if exists partner_billing_invoices_set_updated_at
  on public.partner_billing_invoices;
create trigger partner_billing_invoices_set_updated_at
  before update on public.partner_billing_invoices
  for each row
  execute function public.set_partnership_updated_at();

drop trigger if exists partner_billing_payments_set_updated_at
  on public.partner_billing_payments;
create trigger partner_billing_payments_set_updated_at
  before update on public.partner_billing_payments
  for each row
  execute function public.set_partnership_updated_at();

drop trigger if exists partner_tax_documents_set_updated_at
  on public.partner_tax_documents;
create trigger partner_tax_documents_set_updated_at
  before update on public.partner_tax_documents
  for each row
  execute function public.set_partnership_updated_at();

alter table public.partner_billing_profiles enable row level security;
alter table public.partner_billing_invoices enable row level security;
alter table public.partner_billing_payments enable row level security;
alter table public.partner_tax_documents enable row level security;

revoke all on table public.partner_billing_profiles from anon;
revoke all on table public.partner_billing_profiles from authenticated;
revoke all on table public.partner_billing_invoices from anon;
revoke all on table public.partner_billing_invoices from authenticated;
revoke all on table public.partner_billing_payments from anon;
revoke all on table public.partner_billing_payments from authenticated;
revoke all on table public.partner_tax_documents from anon;
revoke all on table public.partner_tax_documents from authenticated;
