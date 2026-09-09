create or replace function public.create_partner_billing_profile_atomically(
  p_account_id uuid,
  p_company_id uuid,
  p_label text,
  p_payer_name text,
  p_business_registration_number text,
  p_business_name text,
  p_representative_name text,
  p_business_address text,
  p_business_type text,
  p_business_item text,
  p_tax_invoice_email text,
  p_make_default boolean
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  created_profile public.partner_billing_profiles%rowtype;
  should_be_default boolean;
begin
  if p_account_id is null or p_company_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'partner_billing_profile_create_invalid_request';
  end if;

  perform 1
  from public.partner_accounts
  where id = p_account_id
    and is_active = true
  for update;
  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'partner_billing_profile_create_access_denied';
  end if;

  perform 1
  from public.partner_account_companies
  where account_id = p_account_id
    and company_id = p_company_id
    and is_active = true
  for key share;
  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'partner_billing_profile_create_access_denied';
  end if;

  should_be_default :=
    coalesce(p_make_default, false)
    or not exists (
      select 1
      from public.partner_billing_profiles
      where account_id = p_account_id
        and archived_at is null
    );

  if should_be_default then
    update public.partner_billing_profiles
    set is_default = false
    where account_id = p_account_id
      and archived_at is null
      and is_default = true;
  end if;

  insert into public.partner_billing_profiles (
    account_id,
    company_id,
    label,
    payer_name,
    business_registration_number,
    business_name,
    representative_name,
    business_address,
    business_type,
    business_item,
    tax_invoice_email,
    tax_document_type,
    is_default
  )
  values (
    p_account_id,
    p_company_id,
    p_label,
    p_payer_name,
    p_business_registration_number,
    p_business_name,
    p_representative_name,
    p_business_address,
    p_business_type,
    p_business_item,
    p_tax_invoice_email,
    'tax_invoice',
    should_be_default
  )
  returning * into created_profile;

  return to_jsonb(created_profile);
end;
$$;

revoke all on function public.create_partner_billing_profile_atomically(
  uuid, uuid, text, text, text, text, text, text, text, text, text, boolean
) from public;
revoke all on function public.create_partner_billing_profile_atomically(
  uuid, uuid, text, text, text, text, text, text, text, text, text, boolean
) from anon;
revoke all on function public.create_partner_billing_profile_atomically(
  uuid, uuid, text, text, text, text, text, text, text, text, text, boolean
) from authenticated;
grant execute on function public.create_partner_billing_profile_atomically(
  uuid, uuid, text, text, text, text, text, text, text, text, text, boolean
) to service_role;


create or replace function public.set_partner_billing_profile_default(
  p_account_id uuid,
  p_company_id uuid,
  p_profile_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  target_profile public.partner_billing_profiles%rowtype;
begin
  if p_account_id is null or p_company_id is null or p_profile_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'partner_billing_profile_default_invalid_request';
  end if;

  perform 1
  from public.partner_accounts
  where id = p_account_id
    and is_active = true
  for update;
  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'partner_billing_profile_default_access_denied';
  end if;

  perform 1
  from public.partner_account_companies
  where account_id = p_account_id
    and company_id = p_company_id
    and is_active = true
  for key share;
  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'partner_billing_profile_default_access_denied';
  end if;

  select * into target_profile
  from public.partner_billing_profiles
  where id = p_profile_id
    and account_id = p_account_id
    and archived_at is null
  for update;
  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'partner_billing_profile_default_not_found';
  end if;

  update public.partner_billing_profiles
  set is_default = false
  where account_id = p_account_id
    and archived_at is null
    and id <> target_profile.id
    and is_default = true;

  update public.partner_billing_profiles
  set is_default = true
  where id = target_profile.id
    and account_id = p_account_id
    and archived_at is null;
  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'partner_billing_profile_default_state_conflict';
  end if;
end;
$$;

revoke all on function public.set_partner_billing_profile_default(uuid, uuid, uuid) from public;
revoke all on function public.set_partner_billing_profile_default(uuid, uuid, uuid) from anon;
revoke all on function public.set_partner_billing_profile_default(uuid, uuid, uuid) from authenticated;
grant execute on function public.set_partner_billing_profile_default(uuid, uuid, uuid) to service_role;
