import { getSupabaseAdminClient } from "@/lib/supabase/server";

type PartnerFavoriteCountRpcRow = {
  partner_id: string | null;
  favorite_count: number | string | null;
};

type PartnerReviewCountRpcRow = {
  partner_id: string | null;
  review_count: number | string | null;
};

type PartnerEngagementCountRpcRow = {
  partner_id: string | null;
  favorite_count: number | string | null;
  review_count: number | string | null;
};

type ReviewVisibilityCountRpcRow = {
  total_count: number | string | null;
  visible_count: number | string | null;
  hidden_count: number | string | null;
};

type AdminDashboardCountRpcRow = {
  member_count: number | string | null;
  company_count: number | string | null;
  partner_count: number | string | null;
  category_count: number | string | null;
  account_count: number | string | null;
  review_count: number | string | null;
  active_push_subscription_count: number | string | null;
  product_log_count: number | string | null;
  audit_log_count: number | string | null;
  security_log_count: number | string | null;
};

type AdminDashboardHomeSnapshotRpcRow = AdminDashboardCountRpcRow & {
  registration_pending_count: number | string | null;
  change_request_pending_count: number | string | null;
  plan_request_pending_count: number | string | null;
  graduate_verification_pending_count: number | string | null;
  signup_request_pending_count: number | string | null;
  profile_photo_pending_count: number | string | null;
  unread_notification_count: number | string | null;
};

export type ReviewVisibilityCounts = {
  totalCount: number;
  visibleCount: number;
  hiddenCount: number;
};

export type AdminDashboardCounts = {
  memberCount: number;
  companyCount: number;
  partnerCount: number;
  categoryCount: number;
  accountCount: number;
  reviewCount: number;
  activePushSubscriptionCount: number;
  productLogCount: number;
  auditLogCount: number;
  securityLogCount: number;
};

export type AdminDashboardHomeQueueCounts = {
  registrationPendingCount: number;
  changeRequestPendingCount: number;
  planRequestPendingCount: number;
  graduateVerificationPendingCount: number;
  signupRequestPendingCount: number;
  profilePhotoPendingCount: number;
  unreadNotificationCount: number;
};

export type AdminDashboardHomeSnapshot = {
  counts: AdminDashboardCounts;
  queueCounts: AdminDashboardHomeQueueCounts;
};

export type PartnerEngagementCounts = {
  favoriteCounts: Map<string, number>;
  reviewCounts: Map<string, number>;
  engagementErrorMessage: string | null;
};

function normalizePartnerIds(partnerIds: readonly string[]) {
  return [...new Set(partnerIds.map((value) => value.trim()).filter(Boolean))];
}

function parseCount(value: number | string | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function toReviewVisibilityCounts(
  row?: ReviewVisibilityCountRpcRow | null,
): ReviewVisibilityCounts {
  return {
    totalCount: parseCount(row?.total_count),
    visibleCount: parseCount(row?.visible_count),
    hiddenCount: parseCount(row?.hidden_count),
  };
}

export function toAdminDashboardCounts(
  row?: AdminDashboardCountRpcRow | null,
): AdminDashboardCounts {
  return {
    memberCount: parseCount(row?.member_count),
    companyCount: parseCount(row?.company_count),
    partnerCount: parseCount(row?.partner_count),
    categoryCount: parseCount(row?.category_count),
    accountCount: parseCount(row?.account_count),
    reviewCount: parseCount(row?.review_count),
    activePushSubscriptionCount: parseCount(row?.active_push_subscription_count),
    productLogCount: parseCount(row?.product_log_count),
    auditLogCount: parseCount(row?.audit_log_count),
    securityLogCount: parseCount(row?.security_log_count),
  };
}

export function toAdminDashboardHomeSnapshot(
  row?: AdminDashboardHomeSnapshotRpcRow | null,
): AdminDashboardHomeSnapshot {
  return {
    counts: toAdminDashboardCounts(row),
    queueCounts: {
      registrationPendingCount: parseCount(row?.registration_pending_count),
      changeRequestPendingCount: parseCount(row?.change_request_pending_count),
      planRequestPendingCount: parseCount(row?.plan_request_pending_count),
      graduateVerificationPendingCount: parseCount(
        row?.graduate_verification_pending_count,
      ),
      signupRequestPendingCount: parseCount(row?.signup_request_pending_count),
      profilePhotoPendingCount: parseCount(row?.profile_photo_pending_count),
      unreadNotificationCount: parseCount(row?.unread_notification_count),
    },
  };
}

export function toPartnerCountMap(
  partnerIds: readonly string[],
  rows: ReadonlyArray<{
    partner_id: string | null;
    count: number | string | null;
  }>,
) {
  const counts = new Map(normalizePartnerIds(partnerIds).map((partnerId) => [partnerId, 0]));

  for (const row of rows) {
    const partnerId = row.partner_id ?? "";
    if (!counts.has(partnerId)) {
      continue;
    }
    counts.set(partnerId, parseCount(row.count));
  }

  return counts;
}

export async function fetchPartnerFavoriteCounts(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  partnerIds: readonly string[],
) {
  const normalizedPartnerIds = normalizePartnerIds(partnerIds);
  if (normalizedPartnerIds.length === 0) {
    return { counts: new Map<string, number>(), errorMessage: null as string | null };
  }

  const { data, error } = await supabase.rpc("get_partner_favorite_counts", {
    input_partner_ids: normalizedPartnerIds,
  });

  if (error) {
    return {
      counts: new Map(normalizedPartnerIds.map((partnerId) => [partnerId, 0])),
      errorMessage: error.message,
    };
  }

  const rows = ((data ?? []) as PartnerFavoriteCountRpcRow[]).map((row) => ({
    partner_id: row.partner_id,
    count: row.favorite_count,
  }));

  return {
    counts: toPartnerCountMap(normalizedPartnerIds, rows),
    errorMessage: null as string | null,
  };
}

export async function fetchPartnerReviewCounts(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  partnerIds: readonly string[],
) {
  const normalizedPartnerIds = normalizePartnerIds(partnerIds);
  if (normalizedPartnerIds.length === 0) {
    return { counts: new Map<string, number>(), errorMessage: null as string | null };
  }

  const { data, error } = await supabase.rpc("get_partner_review_counts", {
    input_partner_ids: normalizedPartnerIds,
  });

  if (error) {
    return {
      counts: new Map(normalizedPartnerIds.map((partnerId) => [partnerId, 0])),
      errorMessage: error.message,
    };
  }

  const rows = ((data ?? []) as PartnerReviewCountRpcRow[]).map((row) => ({
    partner_id: row.partner_id,
    count: row.review_count,
  }));

  return {
    counts: toPartnerCountMap(normalizedPartnerIds, rows),
    errorMessage: null as string | null,
  };
}

export async function fetchPartnerEngagementCounts(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  partnerIds: readonly string[],
): Promise<PartnerEngagementCounts> {
  const normalizedPartnerIds = normalizePartnerIds(partnerIds);
  if (normalizedPartnerIds.length === 0) {
    return {
      favoriteCounts: new Map<string, number>(),
      reviewCounts: new Map<string, number>(),
      engagementErrorMessage: null,
    };
  }

  try {
    const { data, error } = await supabase.rpc("get_partner_engagement_counts", {
      input_partner_ids: normalizedPartnerIds,
    });

    if (error) {
      return {
        favoriteCounts: new Map(normalizedPartnerIds.map((partnerId) => [partnerId, 0])),
        reviewCounts: new Map(normalizedPartnerIds.map((partnerId) => [partnerId, 0])),
        engagementErrorMessage: error.message,
      };
    }

    const rows = (data ?? []) as PartnerEngagementCountRpcRow[];
    return {
      favoriteCounts: toPartnerCountMap(
        normalizedPartnerIds,
        rows.map((row) => ({
          partner_id: row.partner_id,
          count: row.favorite_count,
        })),
      ),
      reviewCounts: toPartnerCountMap(
        normalizedPartnerIds,
        rows.map((row) => ({
          partner_id: row.partner_id,
          count: row.review_count,
        })),
      ),
      engagementErrorMessage: null,
    };
  } catch (error) {
    return {
      favoriteCounts: new Map(normalizedPartnerIds.map((partnerId) => [partnerId, 0])),
      reviewCounts: new Map(normalizedPartnerIds.map((partnerId) => [partnerId, 0])),
      engagementErrorMessage:
        error instanceof Error ? error.message : String(error),
    };
  }
}

export async function fetchAdminReviewCounts(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
) {
  const { data, error } = await supabase.rpc("get_admin_review_counts");

  if (error) {
    return {
      counts: toReviewVisibilityCounts(),
      errorMessage: error.message,
    };
  }

  return {
    counts: toReviewVisibilityCounts(((data ?? [])[0] as ReviewVisibilityCountRpcRow | undefined) ?? null),
    errorMessage: null as string | null,
  };
}

export async function fetchPartnerReviewVisibilityCounts(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  partnerId: string,
) {
  if (!partnerId.trim()) {
    return {
      counts: toReviewVisibilityCounts(),
      errorMessage: null as string | null,
    };
  }

  const { data, error } = await supabase.rpc("get_partner_review_visibility_counts", {
    input_partner_id: partnerId,
  });

  if (error) {
    return {
      counts: toReviewVisibilityCounts(),
      errorMessage: error.message,
    };
  }

  return {
    counts: toReviewVisibilityCounts(((data ?? [])[0] as ReviewVisibilityCountRpcRow | undefined) ?? null),
    errorMessage: null as string | null,
  };
}

export async function fetchMemberVisibleReviewCountInRange(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  memberId: string,
  startIso: string,
  endIso: string,
) {
  if (!memberId.trim()) {
    return {
      count: 0,
      errorMessage: null as string | null,
    };
  }

  const { data, error } = await supabase.rpc("get_member_visible_review_count_in_range", {
    input_member_id: memberId,
    input_start: startIso,
    input_end: endIso,
  });

  if (error) {
    return {
      count: 0,
      errorMessage: error.message,
    };
  }

  return {
    count: parseCount(data),
    errorMessage: null as string | null,
  };
}

export async function fetchAdminDashboardCounts(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
) {
  const { data, error } = await supabase.rpc("get_admin_dashboard_counts");

  if (error) {
    return {
      counts: toAdminDashboardCounts(),
      errorMessage: error.message,
    };
  }

  return {
    counts: toAdminDashboardCounts(((data ?? [])[0] as AdminDashboardCountRpcRow | undefined) ?? null),
    errorMessage: null as string | null,
  };
}

export async function fetchAdminDashboardHomeSnapshot(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  {
    adminId,
    managedCampusSlugs,
    includeBrandQueues,
    includeGraduateVerifications,
    includeSignupRequests,
    includeProfilePhotos,
    includeNotifications,
  }: {
    adminId: string;
    managedCampusSlugs: readonly string[] | null;
    includeBrandQueues: boolean;
    includeGraduateVerifications: boolean;
    includeSignupRequests: boolean;
    includeProfilePhotos: boolean;
    includeNotifications: boolean;
  },
) {
  const { data, error } = await supabase.rpc("get_admin_dashboard_home_snapshot", {
    input_admin_id: adminId,
    input_managed_campus_slugs: managedCampusSlugs,
    input_include_brand_queues: includeBrandQueues,
    input_include_graduate_verifications: includeGraduateVerifications,
    input_include_signup_requests: includeSignupRequests,
    input_include_profile_photos: includeProfilePhotos,
    input_include_notifications: includeNotifications,
  });

  if (error) {
    return {
      snapshot: toAdminDashboardHomeSnapshot(),
      hasError: true,
    };
  }

  return {
    snapshot: toAdminDashboardHomeSnapshot(
      ((data ?? [])[0] as AdminDashboardHomeSnapshotRpcRow | undefined) ?? null,
    ),
    hasError: false,
  };
}
