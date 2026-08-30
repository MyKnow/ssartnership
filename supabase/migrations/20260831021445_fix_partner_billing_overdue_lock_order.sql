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
  should_downgrade_partner boolean;
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
  loop
    checked_count := checked_count + 1;

    if invoice_row.upgrade_request_id is not null then
      select * into request_row
      from public.partner_plan_upgrade_requests
      where id = invoice_row.upgrade_request_id
        and partner_id = invoice_row.partner_id
        and company_id = invoice_row.company_id
      for update skip locked;
      if not found or request_row.status <> 'pending' then
        continue;
      end if;

      select candidate.* into invoice_row
      from public.partner_billing_invoices as candidate
      where candidate.id = invoice_row.id
        and candidate.upgrade_request_id = request_row.id
        and candidate.status = 'pending_payment'
      for update skip locked;
    else
      select candidate.* into invoice_row
      from public.partner_billing_invoices as candidate
      where candidate.id = invoice_row.id
        and candidate.status = 'pending_payment'
      for update skip locked;
    end if;
    if not found then
      continue;
    end if;

    should_downgrade_partner := partner_row.plan_tier <> 'basic'
      and (
        invoice_row.upgrade_request_id is null
        or partner_row.plan_tier is not distinct from request_row.current_plan_tier
      );
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

    if should_downgrade_partner then
      update public.partners
      set plan_tier = 'basic',
          plan_started_at = null,
          plan_expires_at = null,
          plan_updated_at = p_now,
          updated_at = p_now
      where id = partner_row.id;
    end if;

    update public.partner_billing_invoices
    set status = 'overdue',
        overdue_marked_at = p_now,
        downgraded_at = case
          when should_downgrade_partner then coalesce(downgraded_at, p_now)
          else downgraded_at
        end
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

    if should_downgrade_partner then
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
        partner_row.plan_tier,
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
    end if;
  end loop;

  return pg_catalog.jsonb_build_object(
    'checked', checked_count,
    'downgraded', downgraded_count,
    'results', results
  );
end;
$$;

revoke all on function public.process_partner_billing_overdue_downgrades(timestamp with time zone, integer) from public;
revoke all on function public.process_partner_billing_overdue_downgrades(timestamp with time zone, integer) from anon;
revoke all on function public.process_partner_billing_overdue_downgrades(timestamp with time zone, integer) from authenticated;
grant execute on function public.process_partner_billing_overdue_downgrades(timestamp with time zone, integer) to service_role;
