-- Restore the explicit execution contract for ad coupon wallet RPCs.
-- These functions are invoked through the service-role Supabase admin client
-- and must not remain executable by public-facing roles.
revoke all on function public.issue_ad_coupon(uuid, uuid, text) from public;
revoke all on function public.issue_ad_coupon(uuid, uuid, text) from anon;
revoke all on function public.issue_ad_coupon(uuid, uuid, text) from authenticated;
grant execute on function public.issue_ad_coupon(uuid, uuid, text) to service_role;

revoke all on function public.redeem_ad_coupon_issue(uuid, uuid, text, jsonb, text) from public;
revoke all on function public.redeem_ad_coupon_issue(uuid, uuid, text, jsonb, text) from anon;
revoke all on function public.redeem_ad_coupon_issue(uuid, uuid, text, jsonb, text) from authenticated;
grant execute on function public.redeem_ad_coupon_issue(uuid, uuid, text, jsonb, text) to service_role;
