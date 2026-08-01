import {
  type PartnerRegistrationRequestStatus,
  type PartnerRegistrationQueueSort,
  type PartnerRegistrationSource,
} from "@/lib/partner-registration";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export type AdminPartnerRegistrationRequestDataRow = {
  id: string;
  status: string;
  visibility?: string | null;
  source?: PartnerRegistrationSource | null;
  registration_mode?: string | null;
  service_mode: "offline" | "online";
  benefit_action_type: "certification" | "external_link" | "onsite" | "none";
  benefit_items?: unknown;
  benefit_verification_pin_configured?: boolean;
  branch_scope_type?: string | null;
  branch_scope_note?: string | null;
  brand_name: string;
  category_id?: string | null;
  category_label: string;
  period_start?: string | null;
  period_end?: string | null;
  inquiry_link?: string | null;
  brand_phone?: string | null;
  detail_description?: string | null;
  company_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone?: string | null;
  company_description?: string | null;
  benefits: string[];
  conditions: string[];
  tags: string[];
  location: string;
  map_url?: string | null;
  site_link?: string | null;
  benefit_action_link?: string | null;
  thumbnail_url?: string | null;
  image_urls?: string[] | null;
  memo?: string | null;
  admin_note?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  company?:
    | { managed_campus_slugs?: string[] | null }
    | Array<{ managed_campus_slugs?: string[] | null }>
    | null;
  branches?: Array<{
    id: string;
    branch_type?: string | null;
    campus_slugs?: string[] | null;
  }> | null;
  benefit_groups?: Array<{
    id: string;
    group_key?: string | null;
    label?: string | null;
  }> | null;
};

type RegistrationQueueIndexRow = {
  id?: string | null;
  total_count?: number | string | null;
};

const PARTNER_REGISTRATION_QUEUE_SELECT = [
  "id",
  "status",
  "visibility",
  "source",
  "registration_mode",
  "service_mode",
  "benefit_action_type",
  "benefit_items",
  "benefit_verification_pin_hash",
  "benefit_verification_pin_salt",
  "branch_scope_type",
  "branch_scope_note",
  "brand_name",
  "category_id",
  "category_label",
  "period_start",
  "period_end",
  "inquiry_link",
  "brand_phone",
  "detail_description",
  "company_name",
  "contact_name",
  "contact_email",
  "contact_phone",
  "company_description",
  "benefits",
  "conditions",
  "tags",
  "location",
  "map_url",
  "site_link",
  "benefit_action_link",
  "thumbnail_url",
  "image_urls",
  "memo",
  "admin_note",
  "reviewed_at",
  "created_at",
  "company:partner_companies(managed_campus_slugs)",
  "branches:partner_registration_branches(id,branch_type,campus_slugs)",
  "benefit_groups:partner_registration_benefit_groups(id,group_key,label)",
].join(",");

function toCount(value: number | string | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, value);
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }
  return 0;
}

export async function listAdminPartnerRegistrationRequestPage({
  status,
  search,
  source,
  visibility,
  sort,
  page,
  pageSize,
  managedCampusSlugs,
}: {
  status: PartnerRegistrationRequestStatus | null;
  search: string;
  source: PartnerRegistrationSource | null;
  visibility: "public" | "confidential" | "private" | null;
  sort: PartnerRegistrationQueueSort;
  page: number;
  pageSize: number;
  managedCampusSlugs: readonly string[] | null;
}) {
  let supabase: ReturnType<typeof getSupabaseAdminClient>;
  let indexResult: {
    data: RegistrationQueueIndexRow[] | null;
    error: unknown;
  };

  try {
    supabase = getSupabaseAdminClient();
    indexResult = await supabase.rpc("get_admin_partner_registration_request_page", {
      input_status: status,
      input_page: page,
      input_page_size: pageSize,
      input_managed_campus_slugs: managedCampusSlugs,
      input_search: search || null,
      input_source: source,
      input_visibility: visibility,
      input_sort: sort,
    });
  } catch {
    return { rows: [] as AdminPartnerRegistrationRequestDataRow[], totalCount: 0, loadError: true };
  }

  if (indexResult.error) {
    return { rows: [] as AdminPartnerRegistrationRequestDataRow[], totalCount: 0, loadError: true };
  }

  const indexRows = (indexResult.data ?? []) as RegistrationQueueIndexRow[];
  const ids = indexRows.flatMap((row) =>
    typeof row.id === "string" && row.id ? [row.id] : [],
  );
  const totalCount = toCount(indexRows[0]?.total_count);
  if (ids.length === 0) {
    return { rows: [] as AdminPartnerRegistrationRequestDataRow[], totalCount, loadError: false };
  }

  let rowsData: unknown[] | null = null;
  let rowsError: unknown = null;
  try {
    const rowsResult = await supabase
      .from("partner_registration_requests")
      .select(PARTNER_REGISTRATION_QUEUE_SELECT)
      .in("id", ids);
    rowsData = rowsResult.data as unknown[] | null;
    rowsError = rowsResult.error;
  } catch {
    return { rows: [] as AdminPartnerRegistrationRequestDataRow[], totalCount: 0, loadError: true };
  }
  if (rowsError) {
    return { rows: [] as AdminPartnerRegistrationRequestDataRow[], totalCount: 0, loadError: true };
  }

  const rowsById = new Map(
    (rowsData ?? []).map((rawRow) => {
      const row = rawRow as unknown as AdminPartnerRegistrationRequestDataRow & {
        benefit_verification_pin_hash?: string | null;
        benefit_verification_pin_salt?: string | null;
      };
      const {
        benefit_verification_pin_hash: _hash,
        benefit_verification_pin_salt: _salt,
        ...safeRow
      } = row;
      void _hash;
      void _salt;
      const sanitizedRow: AdminPartnerRegistrationRequestDataRow = {
        ...safeRow,
        benefit_verification_pin_configured: Boolean(
          row.benefit_verification_pin_hash &&
            row.benefit_verification_pin_salt,
        ),
      };
      return [row.id, sanitizedRow] as const;
    }),
  );
  return {
    rows: ids.flatMap((id) => {
      const row = rowsById.get(id);
      return row ? [row] : [];
    }),
    totalCount,
    loadError: false,
  };
}
