-- Return bounded campaign rollups instead of transferring raw event and
-- redemption history to the admin application.
create index if not exists ad_coupon_redemptions_campaign_coupon_redeemed_idx
  on public.ad_coupon_redemptions (campaign_id, coupon_id)
  where status = 'redeemed';

drop function if exists public.get_admin_partner_ad_campaign_metrics(uuid);

create or replace function public.get_admin_ad_campaign_rollups(
  input_partner_id uuid default null
)
returns table (
  campaign_id uuid,
  home_banner_clicks bigint,
  coupon_views bigint,
  coupon_copies bigint,
  coupon_intent_count bigint,
  coupon_redemptions bigint,
  ad_push_sends bigint,
  coupon_redemption_counts jsonb
)
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  with campaign_scope as materialized (
    select campaign.id
    from public.ad_campaigns as campaign
    where input_partner_id is null
      or campaign.partner_id = input_partner_id
  ),
  campaign_event_rows as (
    select
      campaign.id as campaign_id,
      event_log.event_name
    from campaign_scope as campaign
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
    from campaign_scope as campaign
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
  coupon_redemption_counts as (
    select
      redemption.campaign_id,
      redemption.coupon_id,
      pg_catalog.count(*)::bigint as redemption_count
    from public.ad_coupon_redemptions as redemption
    join campaign_scope as campaign
      on campaign.id = redemption.campaign_id
    where redemption.status = 'redeemed'
    group by redemption.campaign_id, redemption.coupon_id
  ),
  redemption_rollups as (
    select
      coupon_redemption_counts.campaign_id,
      pg_catalog.sum(coupon_redemption_counts.redemption_count)::bigint
        as coupon_redemptions,
      pg_catalog.jsonb_object_agg(
        coupon_redemption_counts.coupon_id::text,
        coupon_redemption_counts.redemption_count
        order by coupon_redemption_counts.coupon_id
      ) as coupon_redemption_counts
    from coupon_redemption_counts
    group by coupon_redemption_counts.campaign_id
  )
  select
    campaign.id as campaign_id,
    pg_catalog.coalesce(event_counts.home_banner_clicks, 0::bigint),
    pg_catalog.coalesce(event_counts.coupon_views, 0::bigint),
    pg_catalog.coalesce(event_counts.coupon_copies, 0::bigint),
    pg_catalog.coalesce(event_counts.coupon_intent_count, 0::bigint),
    pg_catalog.coalesce(redemption_rollups.coupon_redemptions, 0::bigint),
    pg_catalog.coalesce(event_counts.ad_push_sends, 0::bigint),
    pg_catalog.coalesce(
      redemption_rollups.coupon_redemption_counts,
      '{}'::jsonb
    )
  from campaign_scope as campaign
  left join event_counts
    on event_counts.campaign_id = campaign.id
  left join redemption_rollups
    on redemption_rollups.campaign_id = campaign.id
  order by campaign.id;
$$;

revoke all on function public.get_admin_ad_campaign_rollups(uuid) from public;
revoke all on function public.get_admin_ad_campaign_rollups(uuid) from anon;
revoke all on function public.get_admin_ad_campaign_rollups(uuid) from authenticated;
grant execute on function public.get_admin_ad_campaign_rollups(uuid) to service_role;
