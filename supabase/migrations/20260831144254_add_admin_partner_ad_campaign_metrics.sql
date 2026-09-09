-- Aggregate one partner's campaign metrics inside PostgreSQL so the admin
-- detail page does not download raw event history or issue per-campaign reads.
create index if not exists event_logs_ad_campaign_metric_idx
  on public.event_logs ((properties ->> 'campaignId'), event_name)
  where pg_catalog.jsonb_typeof(properties -> 'campaignId') = 'string'
    and event_name in (
      'home_banner_click',
      'coupon_view',
      'coupon_copy',
      'coupon_redeem',
      'ad_push_send'
    );

create or replace function public.get_admin_partner_ad_campaign_metrics(
  input_partner_id uuid
)
returns table (
  campaign_id uuid,
  home_banner_clicks bigint,
  coupon_views bigint,
  coupon_copies bigint,
  coupon_intent_count bigint,
  coupon_redemptions bigint,
  ad_push_sends bigint
)
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  with partner_campaigns as materialized (
    select campaign.id
    from public.ad_campaigns as campaign
    where input_partner_id is not null
      and campaign.partner_id = input_partner_id
  ),
  campaign_event_rows as (
    select
      campaign.id as campaign_id,
      event_log.event_name
    from partner_campaigns as campaign
    join public.event_logs as event_log
      on pg_catalog.jsonb_typeof(event_log.properties -> 'campaignId') = 'string'
      and event_log.properties ->> 'campaignId' = campaign.id::text
    where event_log.event_name in (
      'home_banner_click',
      'coupon_view',
      'coupon_copy',
      'coupon_redeem',
      'ad_push_send'
    )

    union all

    select
      campaign.id as campaign_id,
      event_log.event_name
    from partner_campaigns as campaign
    join public.event_logs as event_log
      on event_log.target_type = 'ad_campaign'
      and event_log.target_id = campaign.id::text
    where event_log.event_name in (
      'home_banner_click',
      'coupon_view',
      'coupon_copy',
      'coupon_redeem',
      'ad_push_send'
    )
      and pg_catalog.jsonb_typeof(event_log.properties -> 'campaignId')
        is distinct from 'string'
  ),
  event_counts as (
    select
      campaign_event_rows.campaign_id,
      pg_catalog.count(*) filter (
        where campaign_event_rows.event_name = 'home_banner_click'
      )::bigint as home_banner_clicks,
      pg_catalog.count(*) filter (
        where campaign_event_rows.event_name = 'coupon_view'
      )::bigint as coupon_views,
      pg_catalog.count(*) filter (
        where campaign_event_rows.event_name = 'coupon_copy'
      )::bigint as coupon_copies,
      pg_catalog.count(*) filter (
        where campaign_event_rows.event_name = 'coupon_redeem'
      )::bigint as coupon_intent_count,
      pg_catalog.count(*) filter (
        where campaign_event_rows.event_name = 'ad_push_send'
      )::bigint as ad_push_sends
    from campaign_event_rows
    group by campaign_event_rows.campaign_id
  ),
  redemption_counts as (
    select
      redemption.campaign_id,
      pg_catalog.count(*)::bigint as coupon_redemptions
    from public.ad_coupon_redemptions as redemption
    join partner_campaigns as campaign
      on campaign.id = redemption.campaign_id
    where redemption.partner_id = input_partner_id
      and redemption.status = 'redeemed'
    group by redemption.campaign_id
  )
  select
    campaign.id as campaign_id,
    coalesce(event_counts.home_banner_clicks, 0)::bigint,
    coalesce(event_counts.coupon_views, 0)::bigint,
    coalesce(event_counts.coupon_copies, 0)::bigint,
    coalesce(event_counts.coupon_intent_count, 0)::bigint,
    coalesce(redemption_counts.coupon_redemptions, 0)::bigint,
    coalesce(event_counts.ad_push_sends, 0)::bigint
  from partner_campaigns as campaign
  left join event_counts
    on event_counts.campaign_id = campaign.id
  left join redemption_counts
    on redemption_counts.campaign_id = campaign.id
  order by campaign.id;
$$;

revoke all on function public.get_admin_partner_ad_campaign_metrics(uuid) from public;
revoke all on function public.get_admin_partner_ad_campaign_metrics(uuid) from anon;
revoke all on function public.get_admin_partner_ad_campaign_metrics(uuid) from authenticated;
grant execute on function public.get_admin_partner_ad_campaign_metrics(uuid) to service_role;
