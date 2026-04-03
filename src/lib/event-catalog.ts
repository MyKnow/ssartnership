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
  'partner_create',
  'partner_update',
  'partner_delete',
  'member_update',
  'member_sync',
  'member_delete',
  'push_send',
  'push_log_delete',
] as const;

export type AdminAuditAction = (typeof ADMIN_AUDIT_ACTIONS)[number];

export const AUTH_SECURITY_EVENT_NAMES = [
  'member_login',
  'member_logout',
  'member_signup_code_request',
  'member_signup_complete',
  'member_password_reset',
  'member_password_change',
  'member_delete',
  'admin_login',
  'admin_access',
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
