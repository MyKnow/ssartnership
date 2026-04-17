export const PRODUCT_EVENT_NAMES = [
  'page_view',
  'partner_detail_view',
  'partner_card_click',
  'category_filter_change',
  'search_execute',
  'sort_change',
  'partner_map_click',
  'reservation_click',
  'inquiry_click',
  'share_link_copy',
  'push_settings_view',
  'push_subscribe',
  'push_unsubscribe_device',
  'push_unsubscribe_all',
  'push_preference_change',
  'suggest_submit',
  'pwa_install_click',
  'certification_view',
  'certification_qr_open',
  'certification_qr_verify',
] as const;

export type ProductEventName = (typeof PRODUCT_EVENT_NAMES)[number];

export const ADMIN_AUDIT_ACTIONS = [
  'login',
  'logout',
  'category_create',
  'category_update',
  'category_delete',
  'partner_company_create',
  'partner_company_update',
  'partner_company_delete',
  'partner_create',
  'partner_update',
  'partner_delete',
  'partner_change_request_approve',
  'partner_change_request_reject',
  'member_update',
  'member_directory_sync',
  'member_sync',
  'member_manual_add',
  'member_delete',
  'cycle_settings_update',
  'cycle_settings_early_start',
  'cycle_settings_restore',
  'push_send',
  'push_log_delete',
  'partner_account_update',
  'partner_account_company_update',
  'partner_account_initial_setup_link_generate',
  'partner_account_initial_setup_link_send',
  'partner_review_hide',
  'partner_review_restore',
] as const;

export type AdminAuditAction = (typeof ADMIN_AUDIT_ACTIONS)[number];

export const AUTH_SECURITY_EVENT_NAMES = [
  'member_login',
  'member_logout',
  'member_signup_code_request',
  'member_signup_complete',
  'member_policy_consent',
  'member_password_reset',
  'member_password_change',
  'member_delete',
  'admin_login',
  'admin_access',
  'partner_login',
  'partner_logout',
  'partner_password_reset',
  'partner_password_change',
] as const;

export type AuthSecurityEventName = (typeof AUTH_SECURITY_EVENT_NAMES)[number];
export type AuthSecurityStatus = 'success' | 'failure' | 'blocked';
export type EventActorType = 'guest' | 'member' | 'admin' | 'system';

const PRODUCT_EVENT_NAME_SET = new Set<string>(PRODUCT_EVENT_NAMES);
const ADMIN_AUDIT_ACTION_SET = new Set<string>(ADMIN_AUDIT_ACTIONS);
const AUTH_SECURITY_EVENT_NAME_SET = new Set<string>(AUTH_SECURITY_EVENT_NAMES);

export function isProductEventName(value: string): value is ProductEventName {
  return PRODUCT_EVENT_NAME_SET.has(value);
}

export function isAdminAuditAction(value: string): value is AdminAuditAction {
  return ADMIN_AUDIT_ACTION_SET.has(value);
}

export function isAuthSecurityEventName(value: string): value is AuthSecurityEventName {
  return AUTH_SECURITY_EVENT_NAME_SET.has(value);
}
