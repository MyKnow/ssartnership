create or replace function public.cancel_partner_plan_upgrade_billing(
  p_request_id uuid,
  p_next_request_status text,
  p_cancelled_at timestamp with time zone,
  p_admin_id uuid default null,
  p_admin_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  request_row public.partner_plan_upgrade_requests%rowtype;
  invoice_row public.partner_billing_invoices%rowtype;
  invoice_exists boolean := false;
begin
  if p_request_id is null
    or p_cancelled_at is null
    or p_next_request_status not in ('rejected', 'cancelled') then
    raise exception using
      errcode = 'P0001',
      message = 'partner_plan_cancel_invalid_request';
  end if;
  if p_next_request_status = 'rejected' and p_admin_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'partner_plan_cancel_admin_required';
  end if;

  select * into request_row
  from public.partner_plan_upgrade_requests
  where id = p_request_id
  for update;
  if not found or request_row.status <> 'pending' then
    raise exception using
      errcode = 'P0001',
      message = 'partner_plan_cancel_request_state_conflict';
  end if;

  if request_row.billing_invoice_id is not null then
    select * into invoice_row
    from public.partner_billing_invoices
    where id = request_row.billing_invoice_id
      and upgrade_request_id = request_row.id
    for update;
    invoice_exists := found;
  else
    select * into invoice_row
    from public.partner_billing_invoices
    where upgrade_request_id = request_row.id
    order by created_at desc, id desc
    limit 1
    for update;
    invoice_exists := found;
  end if;

  if invoice_exists and invoice_row.status = 'paid' then
    raise exception using
      errcode = 'P0001',
      message = 'partner_plan_cancel_paid_invoice_conflict';
  end if;

  update public.partner_plan_upgrade_requests
  set status = p_next_request_status,
      admin_note = case
        when p_next_request_status = 'rejected' then coalesce(p_admin_note, '')
        else admin_note
      end,
      reviewed_by_admin_id = case
        when p_next_request_status = 'rejected' then p_admin_id
        else reviewed_by_admin_id
      end,
      reviewed_at = case
        when p_next_request_status = 'rejected' then coalesce(reviewed_at, p_cancelled_at)
        else reviewed_at
      end,
      updated_at = p_cancelled_at
  where id = request_row.id
  returning * into request_row;

  if invoice_exists and invoice_row.status = 'pending_payment' then
    update public.partner_billing_invoices
    set status = 'cancelled',
        cancelled_at = coalesce(cancelled_at, p_cancelled_at)
    where id = invoice_row.id
    returning * into invoice_row;

    update public.partner_billing_payments
    set status = 'cancelled',
        failure_reason = null
    where invoice_id = invoice_row.id
      and status = 'awaiting_transfer';

    update public.partner_tax_documents
    set status = 'cancelled',
        cancelled_at = coalesce(cancelled_at, p_cancelled_at)
    where invoice_id = invoice_row.id
      and status in ('requested', 'pending_issue');
  end if;

  return pg_catalog.jsonb_build_object(
    'requestId', request_row.id,
    'status', request_row.status,
    'invoiceId', invoice_row.id,
    'invoiceStatus', invoice_row.status
  );
end;
$$;

revoke all on function public.cancel_partner_plan_upgrade_billing(uuid, text, timestamp with time zone, uuid, text) from public;
revoke all on function public.cancel_partner_plan_upgrade_billing(uuid, text, timestamp with time zone, uuid, text) from anon;
revoke all on function public.cancel_partner_plan_upgrade_billing(uuid, text, timestamp with time zone, uuid, text) from authenticated;
grant execute on function public.cancel_partner_plan_upgrade_billing(uuid, text, timestamp with time zone, uuid, text) to service_role;

create or replace function public.update_partner_brand_plan_by_admin(
  p_partner_id uuid,
  p_expected_plan_tier text,
  p_expected_plan_updated_at timestamp with time zone,
  p_next_plan_tier text,
  p_plan_started_at timestamp with time zone,
  p_plan_expires_at timestamp with time zone,
  p_actor_admin_id uuid default null,
  p_note text default null,
  p_updated_at timestamp with time zone default now()
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  partner_row public.partners%rowtype;
  event_row public.partner_brand_plan_events%rowtype;
  previous_plan_tier text;
begin
  if p_partner_id is null
    or p_updated_at is null
    or p_expected_plan_tier not in ('basic', 'partner', 'boost')
    or p_next_plan_tier not in ('basic', 'partner', 'boost') then
    raise exception using
      errcode = 'P0001',
      message = 'partner_plan_admin_update_invalid_request';
  end if;
  if p_plan_started_at is not null
    and p_plan_expires_at is not null
    and p_plan_expires_at <= p_plan_started_at then
    raise exception using
      errcode = 'P0001',
      message = 'partner_plan_admin_update_invalid_window';
  end if;

  select * into partner_row
  from public.partners
  where id = p_partner_id
  for update;
  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'partner_plan_admin_update_partner_not_found';
  end if;
  if partner_row.company_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'partner_plan_admin_update_company_required';
  end if;
  if partner_row.plan_tier is distinct from p_expected_plan_tier
    or partner_row.plan_updated_at is distinct from p_expected_plan_updated_at then
    raise exception using
      errcode = 'P0001',
      message = 'partner_plan_admin_update_state_changed';
  end if;
  if exists (
    select 1
    from public.partner_plan_upgrade_requests as request
    where request.partner_id = partner_row.id
      and request.status = 'pending'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'partner_plan_admin_update_pending_request';
  end if;

  previous_plan_tier := partner_row.plan_tier;

  update public.partners
  set plan_tier = p_next_plan_tier,
      plan_started_at = p_plan_started_at,
      plan_expires_at = p_plan_expires_at,
      plan_updated_at = p_updated_at,
      updated_at = p_updated_at
  where id = partner_row.id
  returning * into partner_row;

  insert into public.partner_brand_plan_events (
    partner_id,
    company_id,
    previous_plan_tier,
    next_plan_tier,
    source,
    actor_admin_id,
    plan_started_at,
    plan_expires_at,
    note
  ) values (
    partner_row.id,
    partner_row.company_id,
    previous_plan_tier,
    p_next_plan_tier,
    'admin',
    p_actor_admin_id,
    p_plan_started_at,
    p_plan_expires_at,
    coalesce(p_note, '')
  )
  returning * into event_row;

  return pg_catalog.jsonb_build_object(
    'partner', pg_catalog.to_jsonb(partner_row),
    'event', pg_catalog.to_jsonb(event_row)
  );
end;
$$;

revoke all on function public.update_partner_brand_plan_by_admin(uuid, text, timestamp with time zone, text, timestamp with time zone, timestamp with time zone, uuid, text, timestamp with time zone) from public;
revoke all on function public.update_partner_brand_plan_by_admin(uuid, text, timestamp with time zone, text, timestamp with time zone, timestamp with time zone, uuid, text, timestamp with time zone) from anon;
revoke all on function public.update_partner_brand_plan_by_admin(uuid, text, timestamp with time zone, text, timestamp with time zone, timestamp with time zone, uuid, text, timestamp with time zone) from authenticated;
grant execute on function public.update_partner_brand_plan_by_admin(uuid, text, timestamp with time zone, text, timestamp with time zone, timestamp with time zone, uuid, text, timestamp with time zone) to service_role;

create or replace function public.approve_partner_plan_upgrade_request(
  p_request_id uuid,
  p_admin_id uuid,
  p_admin_note text default null,
  p_reviewed_at timestamp with time zone default now()
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  request_row public.partner_plan_upgrade_requests%rowtype;
  invoice_row public.partner_billing_invoices%rowtype;
  partner_row public.partners%rowtype;
  event_row public.partner_brand_plan_events%rowtype;
  computed_plan_started_at timestamp with time zone;
  computed_plan_expires_at timestamp with time zone;
begin
  if p_request_id is null
    or p_admin_id is null
    or p_reviewed_at is null then
    raise exception using
      errcode = 'P0001',
      message = 'partner_plan_approval_invalid_request';
  end if;

  select * into request_row
  from public.partner_plan_upgrade_requests
  where id = p_request_id
  for update;
  if not found or request_row.status <> 'pending' then
    raise exception using
      errcode = 'P0001',
      message = 'partner_plan_approval_request_state_conflict';
  end if;

  if request_row.billing_invoice_id is not null then
    select * into invoice_row
    from public.partner_billing_invoices
    where id = request_row.billing_invoice_id
      and upgrade_request_id = request_row.id
    for update;
  else
    select * into invoice_row
    from public.partner_billing_invoices
    where upgrade_request_id = request_row.id
    order by created_at desc, id desc
    limit 1
    for update;
  end if;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'partner_plan_approval_invoice_not_found';
  end if;
  if invoice_row.status <> 'paid' then
    raise exception using
      errcode = 'P0001',
      message = 'partner_plan_approval_invoice_unpaid_conflict';
  end if;

  select * into partner_row
  from public.partners
  where id = request_row.partner_id
    and company_id = request_row.company_id
  for update;
  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'partner_plan_approval_partner_not_found';
  end if;
  if partner_row.plan_tier is distinct from request_row.current_plan_tier then
    raise exception using
      errcode = 'P0001',
      message = 'partner_plan_approval_partner_state_conflict';
  end if;

  computed_plan_started_at := coalesce(invoice_row.paid_at, p_reviewed_at);
  computed_plan_expires_at := coalesce(
    invoice_row.service_period_end,
    computed_plan_started_at + make_interval(days => greatest(coalesce(invoice_row.remaining_days, 30), 1))
  );

  update public.partner_plan_upgrade_requests
  set status = 'approved',
      admin_note = coalesce(p_admin_note, ''),
      reviewed_by_admin_id = p_admin_id,
      reviewed_at = p_reviewed_at,
      updated_at = p_reviewed_at
  where id = request_row.id
  returning * into request_row;

  update public.partners
  set plan_tier = request_row.requested_plan_tier,
      plan_started_at = computed_plan_started_at,
      plan_expires_at = computed_plan_expires_at,
      plan_updated_at = p_reviewed_at,
      updated_at = p_reviewed_at
  where id = partner_row.id
  returning * into partner_row;

  insert into public.partner_brand_plan_events (
    partner_id,
    company_id,
    upgrade_request_id,
    previous_plan_tier,
    next_plan_tier,
    source,
    actor_admin_id,
    actor_partner_account_id,
    plan_started_at,
    plan_expires_at,
    note
  ) values (
    partner_row.id,
    partner_row.company_id,
    request_row.id,
    request_row.current_plan_tier,
    request_row.requested_plan_tier,
    'partner_upgrade',
    p_admin_id,
    request_row.requested_by_account_id,
    computed_plan_started_at,
    computed_plan_expires_at,
    coalesce(p_admin_note, '')
  )
  returning * into event_row;

  return pg_catalog.jsonb_build_object(
    'request', pg_catalog.to_jsonb(request_row),
    'invoice', pg_catalog.to_jsonb(invoice_row),
    'partner', pg_catalog.to_jsonb(partner_row),
    'event', pg_catalog.to_jsonb(event_row)
  );
end;
$$;

revoke all on function public.approve_partner_plan_upgrade_request(uuid, uuid, text, timestamp with time zone) from public;
revoke all on function public.approve_partner_plan_upgrade_request(uuid, uuid, text, timestamp with time zone) from anon;
revoke all on function public.approve_partner_plan_upgrade_request(uuid, uuid, text, timestamp with time zone) from authenticated;
grant execute on function public.approve_partner_plan_upgrade_request(uuid, uuid, text, timestamp with time zone) to service_role;
