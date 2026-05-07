import { normalizePartnerLoginId } from "@/lib/partner-utils";
import type {
  PartnerAccountRow,
  PartnerCompanyInput,
  PartnerCompanyRow,
} from "../shared-types";

export function toPartnerAccountDisplayName(
  company: PartnerCompanyInput,
) {
  return company.contactName || company.name || "제휴 담당자";
}

export function toPartnerAccountLoginId(
  company: PartnerCompanyInput,
) {
  const email = company.contactEmail || "";
  return normalizePartnerLoginId(email);
}

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
