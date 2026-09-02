create or replace function public.create_partner_plan_upgrade_billing(
  p_partner_id uuid,
  p_company_id uuid,
  p_account_id uuid,
  p_billing_profile_id uuid,
  p_expected_current_plan_tier text,
  p_expected_plan_updated_at timestamp with time zone,
  p_requested_plan_tier text,
  p_invoice_number text,
  p_billing_policy text,
  p_remaining_days integer,
  p_service_period_start timestamp with time zone,
  p_service_period_end timestamp with time zone,
  p_supply_amount_krw integer,
  p_vat_amount_krw integer,
  p_total_amount_krw integer,
  p_due_at timestamp with time zone,
  p_payer_name text,
  p_memo text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  partner_row public.partners%rowtype;
  billing_profile_row public.partner_billing_profiles%rowtype;
  request_row public.partner_plan_upgrade_requests%rowtype;
  invoice_row public.partner_billing_invoices%rowtype;
  payment_row public.partner_billing_payments%rowtype;
  tax_document_row public.partner_tax_documents%rowtype;
  requested_by_display_name text;
  operation_time timestamp with time zone := pg_catalog.clock_timestamp();
  normalized_payer_name text := pg_catalog.btrim(coalesce(p_payer_name, ''));
  normalized_memo text := pg_catalog.btrim(coalesce(p_memo, ''));
begin
  if p_partner_id is null
    or p_company_id is null
    or p_account_id is null
    or p_billing_profile_id is null
    or p_expected_current_plan_tier not in ('basic', 'partner', 'boost')
    or p_requested_plan_tier not in ('basic', 'partner', 'boost')
    or p_requested_plan_tier = p_expected_current_plan_tier
    or p_billing_policy not in ('first_month_full_amount', 'remaining_period_difference')
    or p_remaining_days is null
    or p_remaining_days < 1
    or p_service_period_start is null
    or p_service_period_end is null
    or p_service_period_end <= p_service_period_start
    or p_due_at is null
    or p_due_at <= p_service_period_start
    or p_supply_amount_krw is null
    or p_supply_amount_krw < 0
    or p_vat_amount_krw is null
    or p_vat_amount_krw < 0
    or p_total_amount_krw is null
    or p_total_amount_krw < 0
    or p_total_amount_krw <> p_supply_amount_krw + p_vat_amount_krw
    or p_invoice_number is null
    or p_invoice_number !~ '^SSP-[0-9]{8}-[0-9A-F]{8}$'
    or pg_catalog.char_length(normalized_payer_name) not between 1 and 80
    or pg_catalog.char_length(normalized_memo) > 1000 then
    raise exception using
      errcode = 'P0001',
      message = 'partner_plan_billing_invalid_request';
  end if;

  select * into partner_row
  from public.partners
  where id = p_partner_id
  for update;
  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'partner_plan_billing_partner_not_found';
  end if;
  if partner_row.company_id is distinct from p_company_id then
    raise exception using
      errcode = 'P0001',
      message = 'partner_plan_billing_access_denied';
  end if;
  if partner_row.plan_tier <> p_expected_current_plan_tier
    or partner_row.plan_updated_at is distinct from p_expected_plan_updated_at then
    raise exception using
      errcode = 'P0001',
      message = 'partner_plan_billing_state_changed';
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
      message = 'partner_plan_billing_access_denied';
  end if;

  select * into billing_profile_row
  from public.partner_billing_profiles
  where id = p_billing_profile_id
    and archived_at is null
    and (
      account_id = p_account_id
      or (account_id is null and company_id = p_company_id)
    )
  for update;
  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'partner_plan_billing_profile_not_found';
  end if;
  if pg_catalog.btrim(billing_profile_row.payer_name) <> normalized_payer_name then
    raise exception using
      errcode = 'P0001',
      message = 'partner_plan_billing_profile_changed';
  end if;

  insert into public.partner_plan_upgrade_requests (
    partner_id,
    company_id,
    requested_by_account_id,
    current_plan_tier,
    requested_plan_tier,
    payment_amount_krw,
    payer_name,
    memo
  ) values (
    partner_row.id,
    p_company_id,
    p_account_id,
    partner_row.plan_tier,
    p_requested_plan_tier,
    p_total_amount_krw,
    normalized_payer_name,
    normalized_memo
  )
  returning * into request_row;

  insert into public.partner_billing_invoices (
    invoice_number,
    company_id,
    partner_id,
    upgrade_request_id,
    requested_by_account_id,
    billing_reason,
    billing_policy,
    payment_method,
    status,
    current_plan_tier,
    requested_plan_tier,
    remaining_days,
    service_period_start,
    service_period_end,
    supply_amount_krw,
    vat_amount_krw,
    total_amount_krw,
    due_at,
    metadata
  ) values (
    p_invoice_number,
    p_company_id,
    partner_row.id,
    request_row.id,
    p_account_id,
    'plan_upgrade',
    p_billing_policy,
    'manual_bank_transfer',
    'pending_payment',
    partner_row.plan_tier,
    p_requested_plan_tier,
    p_remaining_days,
    p_service_period_start,
    p_service_period_end,
    p_supply_amount_krw,
    p_vat_amount_krw,
    p_total_amount_krw,
    p_due_at,
    pg_catalog.jsonb_build_object(
      'vatIncluded', true,
      'taxDocumentType', 'tax_invoice'
    )
  )
  returning * into invoice_row;

  insert into public.partner_billing_payments (
    invoice_id,
    method,
    status,
    amount_krw,
    payer_name,
    memo
  ) values (
    invoice_row.id,
    'manual_bank_transfer',
    'awaiting_transfer',
    p_total_amount_krw,
    normalized_payer_name,
    normalized_memo
  )
  returning * into payment_row;

  insert into public.partner_tax_documents (
    invoice_id,
    type,
    status,
    business_registration_number,
    business_name,
    representative_name,
    business_address,
    business_type,
    business_item,
    tax_invoice_email,
    provider
  ) values (
    invoice_row.id,
    'tax_invoice',
    'requested',
    billing_profile_row.business_registration_number,
    billing_profile_row.business_name,
    billing_profile_row.representative_name,
    billing_profile_row.business_address,
    billing_profile_row.business_type,
    billing_profile_row.business_item,
    billing_profile_row.tax_invoice_email,
    'manual_hometax'
  )
  returning * into tax_document_row;

  update public.partner_plan_upgrade_requests
  set billing_invoice_id = invoice_row.id
  where id = request_row.id
  returning * into request_row;

  update public.partner_billing_profiles
  set last_used_at = operation_time
  where id = billing_profile_row.id;

  select display_name into requested_by_display_name
  from public.partner_accounts
  where id = p_account_id;

  return pg_catalog.jsonb_build_object(
    'request', pg_catalog.to_jsonb(request_row),
    'invoice', pg_catalog.to_jsonb(invoice_row),
    'payment', pg_catalog.to_jsonb(payment_row),
    'taxDocument', pg_catalog.to_jsonb(tax_document_row),
    'requestedByDisplayName', requested_by_display_name
  );
end;
$$;

create or replace function public.confirm_partner_plan_bank_transfer_payment(
  p_request_id uuid,
  p_admin_id uuid,
  p_tax_document_status text,
  p_confirmed_at timestamp with time zone
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  request_row public.partner_plan_upgrade_requests%rowtype;
  invoice_row public.partner_billing_invoices%rowtype;
  payment_row public.partner_billing_payments%rowtype;
  tax_document_row public.partner_tax_documents%rowtype;
  payment_count integer;
  target_tax_document_status text;
begin
  if p_request_id is null
    or p_admin_id is null
    or p_confirmed_at is null
    or p_tax_document_status not in ('pending_issue', 'issued') then
    raise exception using
      errcode = 'P0001',
      message = 'partner_plan_payment_invalid_request';
  end if;

  select * into request_row
  from public.partner_plan_upgrade_requests
  where id = p_request_id
  for update;
  if not found or request_row.status <> 'pending' then
    raise exception using
      errcode = 'P0001',
      message = 'partner_plan_payment_request_state_conflict';
  end if;

  select * into invoice_row
  from public.partner_billing_invoices
  where id = request_row.billing_invoice_id
    and upgrade_request_id = request_row.id
  for update;
  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'partner_plan_payment_invoice_not_found';
  end if;
  if invoice_row.status = 'cancelled' then
    raise exception using
      errcode = 'P0001',
      message = 'partner_plan_payment_invoice_cancelled';
  end if;

  select * into tax_document_row
  from public.partner_tax_documents
  where invoice_id = invoice_row.id
  for update;
  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'partner_plan_payment_tax_document_not_found';
  end if;

  target_tax_document_status := case
    when tax_document_row.status = 'issued' then 'issued'
    else p_tax_document_status
  end;

  update public.partner_billing_invoices
  set status = 'paid',
      paid_at = coalesce(paid_at, p_confirmed_at)
  where id = invoice_row.id
  returning * into invoice_row;

  update public.partner_billing_payments
  set status = 'confirmed',
      confirmed_by_admin_id = coalesce(confirmed_by_admin_id, p_admin_id),
      confirmed_at = coalesce(confirmed_at, p_confirmed_at),
      failure_reason = null
  where invoice_id = invoice_row.id
    and status <> 'cancelled';
  get diagnostics payment_count = row_count;
  if payment_count < 1 then
    raise exception using
      errcode = 'P0001',
      message = 'partner_plan_payment_record_not_found';
  end if;

  select * into payment_row
  from public.partner_billing_payments
  where invoice_id = invoice_row.id
    and status = 'confirmed'
  order by confirmed_at desc nulls last, created_at desc, id desc
  limit 1;

  update public.partner_tax_documents
  set status = target_tax_document_status,
      issued_by_admin_id = case
        when target_tax_document_status = 'issued'
          then coalesce(issued_by_admin_id, p_admin_id)
        else issued_by_admin_id
      end,
      issued_at = case
        when target_tax_document_status = 'issued'
          then coalesce(issued_at, p_confirmed_at)
        else issued_at
      end,
      sent_at = case
        when target_tax_document_status = 'issued'
          then coalesce(sent_at, p_confirmed_at)
        else sent_at
      end,
      cancelled_at = null,
      failure_reason = null
  where id = tax_document_row.id
  returning * into tax_document_row;

  return pg_catalog.jsonb_build_object(
    'invoice', pg_catalog.to_jsonb(invoice_row),
    'payment', pg_catalog.to_jsonb(payment_row),
    'taxDocument', pg_catalog.to_jsonb(tax_document_row)
  );
end;
$$;

create or replace function public.process_partner_billing_overdue_downgrades(
  p_now timestamp with time zone,
  p_limit integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  invoice_row public.partner_billing_invoices%rowtype;
  partner_row public.partners%rowtype;
  request_row public.partner_plan_upgrade_requests%rowtype;
  payment_row public.partner_billing_payments%rowtype;
  tax_document_row public.partner_tax_documents%rowtype;
  checked_count integer := 0;
  downgraded_count integer := 0;
  normalized_limit integer;
  results jsonb := '[]'::jsonb;
begin
  if p_now is null then
    raise exception using
      errcode = 'P0001',
      message = 'partner_billing_overdue_invalid_request';
  end if;
  normalized_limit := least(100, greatest(1, coalesce(p_limit, 100)));

  for invoice_row in
    select invoice.*
    from public.partner_billing_invoices as invoice
    where invoice.status = 'pending_payment'
      and invoice.due_at <= p_now
    order by invoice.due_at asc, invoice.id asc
    limit normalized_limit
    for update skip locked
  loop
    checked_count := checked_count + 1;
    if invoice_row.requested_plan_tier = 'basic'
      or invoice_row.due_at + interval '7 days' > p_now then
      continue;
    end if;

    select * into partner_row
    from public.partners
    where id = invoice_row.partner_id
      and company_id = invoice_row.company_id
    for update;
    if not found then
      continue;
    end if;

    if invoice_row.upgrade_request_id is not null then
      select * into request_row
      from public.partner_plan_upgrade_requests
      where id = invoice_row.upgrade_request_id
        and partner_id = invoice_row.partner_id
        and company_id = invoice_row.company_id
      for update;
      if not found or request_row.status <> 'pending' then
        continue;
      end if;
    end if;

    select * into payment_row
    from public.partner_billing_payments
    where invoice_id = invoice_row.id
      and status = 'awaiting_transfer'
    order by created_at desc, id desc
    limit 1
    for update;
    if not found then
      continue;
    end if;

    select * into tax_document_row
    from public.partner_tax_documents
    where invoice_id = invoice_row.id
      and status in ('requested', 'pending_issue')
    for update;
    if not found then
      continue;
    end if;

    update public.partners
    set plan_tier = 'basic',
        plan_started_at = null,
        plan_expires_at = null,
        plan_updated_at = p_now,
        updated_at = p_now
    where id = partner_row.id;

    update public.partner_billing_invoices
    set status = 'overdue',
        overdue_marked_at = p_now,
        downgraded_at = p_now
    where id = invoice_row.id
      and status = 'pending_payment';
    if not found then
      raise exception using
        errcode = 'P0001',
        message = 'partner_billing_overdue_invoice_state_conflict';
    end if;

    update public.partner_billing_payments
    set status = 'failed',
        failure_reason = '미납 7일 경과로 자동 취소되었습니다.'
    where invoice_id = invoice_row.id
      and status = 'awaiting_transfer';

    update public.partner_tax_documents
    set status = 'cancelled',
        cancelled_at = p_now
    where invoice_id = invoice_row.id
      and status in ('requested', 'pending_issue');

    if invoice_row.upgrade_request_id is not null then
      update public.partner_plan_upgrade_requests
      set status = 'cancelled',
          admin_note = '미납 7일 경과로 자동 취소되었습니다.',
          updated_at = p_now
      where id = request_row.id
        and status = 'pending';
      if not found then
        raise exception using
          errcode = 'P0001',
          message = 'partner_billing_overdue_request_state_conflict';
      end if;
    end if;

    insert into public.partner_brand_plan_events (
      partner_id,
      company_id,
      upgrade_request_id,
      previous_plan_tier,
      next_plan_tier,
      source,
      plan_started_at,
      plan_expires_at,
      note,
      metadata
    ) values (
      invoice_row.partner_id,
      invoice_row.company_id,
      invoice_row.upgrade_request_id,
      invoice_row.requested_plan_tier,
      'basic',
      'system',
      null,
      null,
      '계좌이체 청구 미납 7일 경과로 Basic 플랜으로 자동 조정',
      pg_catalog.jsonb_build_object(
        'invoiceId', invoice_row.id,
        'invoiceNumber', invoice_row.invoice_number,
        'reason', 'unpaid_after_grace_period'
      )
    );

    downgraded_count := downgraded_count + 1;
    results := results || pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object(
        'invoiceId', invoice_row.id,
        'partnerId', invoice_row.partner_id,
        'downgradedTo', 'basic'
      )
    );
  end loop;

  return pg_catalog.jsonb_build_object(
    'checked', checked_count,
    'downgraded', downgraded_count,
    'results', results
  );
end;
$$;

revoke all on function public.create_partner_plan_upgrade_billing(uuid, uuid, uuid, uuid, text, timestamp with time zone, text, text, text, integer, timestamp with time zone, timestamp with time zone, integer, integer, integer, timestamp with time zone, text, text) from public;
revoke all on function public.create_partner_plan_upgrade_billing(uuid, uuid, uuid, uuid, text, timestamp with time zone, text, text, text, integer, timestamp with time zone, timestamp with time zone, integer, integer, integer, timestamp with time zone, text, text) from anon;
revoke all on function public.create_partner_plan_upgrade_billing(uuid, uuid, uuid, uuid, text, timestamp with time zone, text, text, text, integer, timestamp with time zone, timestamp with time zone, integer, integer, integer, timestamp with time zone, text, text) from authenticated;
grant execute on function public.create_partner_plan_upgrade_billing(uuid, uuid, uuid, uuid, text, timestamp with time zone, text, text, text, integer, timestamp with time zone, timestamp with time zone, integer, integer, integer, timestamp with time zone, text, text) to service_role;

revoke all on function public.confirm_partner_plan_bank_transfer_payment(uuid, uuid, text, timestamp with time zone) from public;
revoke all on function public.confirm_partner_plan_bank_transfer_payment(uuid, uuid, text, timestamp with time zone) from anon;
revoke all on function public.confirm_partner_plan_bank_transfer_payment(uuid, uuid, text, timestamp with time zone) from authenticated;
grant execute on function public.confirm_partner_plan_bank_transfer_payment(uuid, uuid, text, timestamp with time zone) to service_role;

revoke all on function public.process_partner_billing_overdue_downgrades(timestamp with time zone, integer) from public;
revoke all on function public.process_partner_billing_overdue_downgrades(timestamp with time zone, integer) from anon;
revoke all on function public.process_partner_billing_overdue_downgrades(timestamp with time zone, integer) from authenticated;
grant execute on function public.process_partner_billing_overdue_downgrades(timestamp with time zone, integer) to service_role;
