import type { AdminAccount } from "@/lib/admin-accounts";
import { canAdmin } from "@/lib/admin-permissions";
import { getManagedCampusFilterValues } from "@/lib/admin-scope";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export type AdminTaskQueueCounts = Partial<Record<string, number | null>>;

type CountResult = {
  count: number | string | null;
  error: unknown;
};

type AdminTaskInboxCountsRpcRow = {
  registration_pending_count: number | string | null;
  change_request_pending_count: number | string | null;
  graduate_verification_pending_count: number | string | null;
  signup_request_pending_count: number | string | null;
  profile_photo_pending_count: number | string | null;
  unread_notification_count: number | string | null;
};

function getTaskRank(count: number | null | undefined) {
  if (typeof count === "number" && count > 0) {
    return 0;
  }
  if (count === 0) {
    return 1;
  }
  if (count === undefined) {
    return 2;
  }
  return 3;
}

export function prioritizeAdminTaskItems<T extends { href: string }>(
  tasks: readonly T[],
  queueCounts: AdminTaskQueueCounts,
) {
  return [...tasks].sort((left, right) => {
    const leftCount = queueCounts[left.href];
    const rightCount = queueCounts[right.href];
    const rankDifference = getTaskRank(leftCount) - getTaskRank(rightCount);
    if (rankDifference !== 0) {
      return rankDifference;
    }
    if (typeof leftCount === "number" && typeof rightCount === "number") {
      return rightCount - leftCount;
    }
    return 0;
  });
}

export function getNextAdminTaskItem<
  T extends { href: string; priority?: number },
>(
  tasks: readonly T[],
  queueCounts: AdminTaskQueueCounts,
) {
  return tasks
    .filter((task) => (queueCounts[task.href] ?? 0) > 0)
    .sort((left, right) => {
      const priorityDifference = (left.priority ?? 0) - (right.priority ?? 0);
      if (priorityDifference !== 0) {
        return priorityDifference;
      }
      return (queueCounts[right.href] ?? 0) - (queueCounts[left.href] ?? 0);
    })[0] ?? null;
}

export function toSafeAdminTaskQueueCount({ count, error }: CountResult) {
  if (error) {
    return null;
  }
  const normalizedCount = typeof count === "number" ? count : Number(count);
  return Number.isFinite(normalizedCount) ? Math.max(0, normalizedCount) : 0;
}

export async function fetchAdminTaskInboxQueueCounts(
  supabase: Pick<ReturnType<typeof getSupabaseAdminClient>, "rpc">,
  {
    adminId,
    account,
  }: {
    adminId: string;
    account: Pick<
      AdminAccount,
      "permissionId" | "permissions" | "managedCampusSlugs"
    >;
  },
): Promise<AdminTaskQueueCounts> {
  const canReadBrands = canAdmin(account.permissions, "brands", "read");
  const canReadGraduateVerifications = canAdmin(
    account.permissions,
    "graduate_verifications",
    "read",
  );
  const canReadSignupRequests = canAdmin(
    account.permissions,
    "member_signup_requests",
    "read",
  );
  const canReadProfilePhotos = canAdmin(
    account.permissions,
    "profile_images",
    "read",
  );
  const canReadNotifications = canAdmin(
    account.permissions,
    "notifications",
    "read",
  );

  const { data, error } = await supabase.rpc("get_admin_task_inbox_counts", {
    input_admin_id: adminId,
    input_managed_campus_slugs: getManagedCampusFilterValues(account),
    input_include_brand_queues: canReadBrands,
    input_include_graduate_verifications: canReadGraduateVerifications,
    input_include_signup_requests: canReadSignupRequests,
    input_include_profile_photos: canReadProfilePhotos,
    input_include_notifications: canReadNotifications,
  });
  const row = ((data ?? [])[0] as AdminTaskInboxCountsRpcRow | undefined) ?? null;

  const queueCounts: AdminTaskQueueCounts = {};
  if (canReadBrands) {
    queueCounts["/admin/partner-registrations"] = toSafeAdminTaskQueueCount(
      { count: row?.registration_pending_count ?? null, error },
    );
    queueCounts["/admin/partner-requests"] = toSafeAdminTaskQueueCount(
      { count: row?.change_request_pending_count ?? null, error },
    );
  }
  if (canReadGraduateVerifications) {
    queueCounts["/admin/graduate-verifications"] = toSafeAdminTaskQueueCount(
      { count: row?.graduate_verification_pending_count ?? null, error },
    );
  }
  if (canReadSignupRequests) {
    queueCounts["/admin/member-signup-requests"] = toSafeAdminTaskQueueCount(
      { count: row?.signup_request_pending_count ?? null, error },
    );
  }
  if (canReadProfilePhotos) {
    queueCounts["/admin/profile-photos"] = toSafeAdminTaskQueueCount({
      count: row?.profile_photo_pending_count ?? null,
      error,
    });
  }
  if (canReadNotifications) {
    queueCounts["/admin/notifications"] = toSafeAdminTaskQueueCount({
      count: row?.unread_notification_count ?? null,
      error,
    });
  }

  return queueCounts;
}

export async function getAdminTaskQueueCounts({
  adminId,
  account,
}: {
  adminId: string;
  account: Pick<
    AdminAccount,
    "permissionId" | "permissions" | "managedCampusSlugs"
  >;
}): Promise<AdminTaskQueueCounts> {
  return fetchAdminTaskInboxQueueCounts(getSupabaseAdminClient(), {
    adminId,
    account,
  });
}
