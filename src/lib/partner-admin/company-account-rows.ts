import { generateTempPassword, hashPassword } from "@/lib/password";

/**
 * Row contracts and builders for the admin partner company/account write
 * paths. Keeping them here lets the company CRUD, company provisioning, and
 * account creation actions share one projection and one insert shape.
 */

export const PARTNER_COMPANY_SELECT =
  "id,name,slug,description,is_active,managed_campus_slugs";

export type PartnerCompanyRow = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  is_active?: boolean | null;
  managed_campus_slugs?: string[] | null;
};

export type PartnerAccountRow = {
  id: string;
  login_id: string;
  display_name: string;
  email?: string | null;
  password_hash?: string | null;
  password_salt?: string | null;
  must_change_password?: boolean | null;
  is_active?: boolean | null;
  email_verified_at?: string | null;
  initial_setup_completed_at?: string | null;
  initial_setup_link_sent_at?: string | null;
  initial_setup_expires_at?: string | null;
  last_login_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export function normalizePartnerCompanyRow(
  row: PartnerCompanyRow | null | undefined,
) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description ?? null,
    is_active: row.is_active ?? true,
    managed_campus_slugs: row.managed_campus_slugs ?? [],
  } satisfies PartnerCompanyRow;
}

export function normalizePartnerAccountRow(
  row: PartnerAccountRow | null | undefined,
) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    login_id: row.login_id,
    display_name: row.display_name,
    email: row.email ?? null,
    password_hash: row.password_hash ?? null,
    password_salt: row.password_salt ?? null,
    must_change_password: row.must_change_password ?? true,
    is_active: row.is_active ?? true,
    email_verified_at: row.email_verified_at ?? null,
    initial_setup_completed_at: row.initial_setup_completed_at ?? null,
    initial_setup_link_sent_at: row.initial_setup_link_sent_at ?? null,
    initial_setup_expires_at: row.initial_setup_expires_at ?? null,
    last_login_at: row.last_login_at ?? null,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  } satisfies PartnerAccountRow;
}

export type NewPartnerAccountInsert = {
  login_id: string;
  display_name: string;
  email: string;
  password_hash: string;
  password_salt: string;
  must_change_password: true;
  is_active: boolean;
  email_verified_at: null;
  initial_setup_completed_at: null;
  initial_setup_link_sent_at: null;
  initial_setup_expires_at: null;
  created_at: string;
  updated_at: string;
};

/**
 * New partner accounts never receive a usable password. The random temporary
 * password is discarded immediately; the owner must finish the initial setup
 * link, so `must_change_password` is always true and setup state starts empty.
 */
export function buildNewPartnerAccountInsert(input: {
  loginId: string;
  displayName: string;
  isActive: boolean;
  now: string;
  passwordRecord?: { hash: string; salt: string };
}): NewPartnerAccountInsert {
  const passwordRecord =
    input.passwordRecord ?? hashPassword(generateTempPassword(12));

  return {
    login_id: input.loginId,
    display_name: input.displayName,
    email: input.loginId,
    password_hash: passwordRecord.hash,
    password_salt: passwordRecord.salt,
    must_change_password: true,
    is_active: input.isActive,
    email_verified_at: null,
    initial_setup_completed_at: null,
    initial_setup_link_sent_at: null,
    initial_setup_expires_at: null,
    created_at: input.now,
    updated_at: input.now,
  };
}
