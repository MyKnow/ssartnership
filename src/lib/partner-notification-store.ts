import { createNotificationStorageError } from "@/lib/notifications/safe-error";
import { isPartnerPortalMock } from "@/lib/partner-portal";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

type StoredPartnerNotificationRelation = {
  id: string;
  type: string;
  title: string;
  body: string;
  target_url: string;
  metadata?: Record<string, unknown> | null;
  company_id: string | null;
  created_at: string;
};

export type StoredPartnerNotificationRow = {
  id: string;
  read_at: string | null;
  deleted_at?: string | null;
  created_at: string;
  notification?:
    | StoredPartnerNotificationRelation
    | StoredPartnerNotificationRelation[]
    | null;
};

type PartnerStoredNotificationListParams = {
  accountId: string;
  companyId?: string | null;
  limit?: number;
};

type PartnerStoredNotificationMutationParams = {
  accountId: string;
  notificationIds?: string[] | null;
  now?: string;
};

type PartnerStoredNotificationListResult = {
  isEmptyScope: boolean;
  unreadCount: number;
  items: StoredPartnerNotificationRow[];
};

const DEFAULT_PARTNER_NOTIFICATION_LIST_LIMIT = 30;
const MAX_PARTNER_NOTIFICATION_LIST_LIMIT = 100;

function normalizePartnerNotificationListLimit(limit?: number) {
  if (!Number.isFinite(limit)) {
    return DEFAULT_PARTNER_NOTIFICATION_LIST_LIMIT;
  }

  return Math.min(
    MAX_PARTNER_NOTIFICATION_LIST_LIMIT,
    Math.max(1, Math.trunc(limit as number)),
  );
}

type PartnerStoredNotificationMutationResult = {
  unreadCount: number;
  updatedCount: number;
};

type PartnerStoredNotificationRepository = {
  listScopedNotificationIds(companyId: string): Promise<string[]>;
  countUnread(params: {
    accountId: string;
    notificationIds?: string[] | null;
  }): Promise<number>;
  list(params: {
    accountId: string;
    notificationIds?: string[] | null;
    limit: number;
  }): Promise<StoredPartnerNotificationRow[]>;
  markRead(params: {
    accountId: string;
    notificationIds?: string[] | null;
    now: string;
  }): Promise<number>;
  softDelete(params: {
    accountId: string;
    notificationIds?: string[] | null;
    now: string;
  }): Promise<number>;
};

function createMockPartnerStoredNotificationRepository(): PartnerStoredNotificationRepository {
  return {
    async listScopedNotificationIds() {
      return [];
    },

    async countUnread() {
      return 0;
    },

    async list() {
      return [];
    },

    async markRead() {
      return 0;
    },

    async softDelete() {
      return 0;
    },
  };
}

function createSupabasePartnerStoredNotificationRepository(): PartnerStoredNotificationRepository {
  return {
    async listScopedNotificationIds(companyId: string) {
      const supabase = getSupabaseAdminClient();
      const [companyResult, globalResult] = await Promise.all([
        supabase
          .from("partner_notifications")
          .select("id")
          .eq("company_id", companyId),
        supabase
          .from("partner_notifications")
          .select("id")
          .is("company_id", null),
      ]);

      if (companyResult.error) {
        throw createNotificationStorageError(companyResult.error);
      }
      if (globalResult.error) {
        throw createNotificationStorageError(globalResult.error);
      }

      return [...(companyResult.data ?? []), ...(globalResult.data ?? [])].map(
        (row) => row.id as string,
      );
    },

    async countUnread({ accountId, notificationIds }) {
      const supabase = getSupabaseAdminClient();
      let query = supabase
        .from("partner_notification_recipients")
        .select("id", { count: "exact", head: true })
        .eq("account_id", accountId)
        .is("deleted_at", null)
        .is("read_at", null);
      if (notificationIds && notificationIds.length > 0) {
        query = query.in("notification_id", notificationIds);
      }
      const { count, error } = await query;

      if (error) {
        throw createNotificationStorageError(error);
      }

      return count ?? 0;
    },

    async list({ accountId, notificationIds, limit }) {
      const supabase = getSupabaseAdminClient();
      let query = supabase
        .from("partner_notification_recipients")
        .select(
          "id,read_at,deleted_at,created_at,notification:partner_notifications(id,type,title,body,target_url,metadata,company_id,created_at)",
        )
        .eq("account_id", accountId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (notificationIds && notificationIds.length > 0) {
        query = query.in("notification_id", notificationIds);
      }
      const { data, error } = await query;

      if (error) {
        throw createNotificationStorageError(error);
      }

      return (data ?? []) as StoredPartnerNotificationRow[];
    },

    async markRead({ accountId, notificationIds, now }) {
      const supabase = getSupabaseAdminClient();
      let query = supabase
        .from("partner_notification_recipients")
        .update({ read_at: now, updated_at: now })
        .eq("account_id", accountId)
        .is("deleted_at", null)
        .is("read_at", null);
      if (notificationIds && notificationIds.length > 0) {
        query = query.in("notification_id", notificationIds);
      }
      const { data, error } = await query.select("id");

      if (error) {
        throw createNotificationStorageError(error);
      }

      return data?.length ?? 0;
    },

    async softDelete({ accountId, notificationIds, now }) {
      const supabase = getSupabaseAdminClient();
      let query = supabase
        .from("partner_notification_recipients")
        .update({ deleted_at: now, updated_at: now })
        .eq("account_id", accountId)
        .is("deleted_at", null);
      if (notificationIds && notificationIds.length > 0) {
        query = query.in("notification_id", notificationIds);
      }
      const { data, error } = await query.select("id");

      if (error) {
        throw createNotificationStorageError(error);
      }

      return data?.length ?? 0;
    },
  };
}

export function createPartnerStoredNotificationService(
  repository: PartnerStoredNotificationRepository,
) {
  return {
    async list(
      params: PartnerStoredNotificationListParams,
    ): Promise<PartnerStoredNotificationListResult> {
      const limit = normalizePartnerNotificationListLimit(params.limit);
      const notificationIds = params.companyId
        ? await repository.listScopedNotificationIds(params.companyId)
        : null;

      if (notificationIds && notificationIds.length === 0) {
        return { isEmptyScope: true, unreadCount: 0, items: [] };
      }

      const [unreadCount, items] = await Promise.all([
        repository.countUnread({
          accountId: params.accountId,
          notificationIds,
        }),
        repository.list({
          accountId: params.accountId,
          notificationIds,
          limit,
        }),
      ]);

      return { isEmptyScope: false, unreadCount, items };
    },

    async markRead(
      params: PartnerStoredNotificationMutationParams,
    ): Promise<PartnerStoredNotificationMutationResult> {
      if (params.notificationIds && params.notificationIds.length === 0) {
        return {
          unreadCount: await repository.countUnread({ accountId: params.accountId }),
          updatedCount: 0,
        };
      }

      const updatedCount = await repository.markRead({
        accountId: params.accountId,
        notificationIds: params.notificationIds,
        now: params.now ?? new Date().toISOString(),
      });
      const unreadCount = await repository.countUnread({ accountId: params.accountId });

      return { unreadCount, updatedCount };
    },

    async remove(
      params: PartnerStoredNotificationMutationParams,
    ): Promise<PartnerStoredNotificationMutationResult> {
      if (params.notificationIds && params.notificationIds.length === 0) {
        return {
          unreadCount: await repository.countUnread({ accountId: params.accountId }),
          updatedCount: 0,
        };
      }

      const updatedCount = await repository.softDelete({
        accountId: params.accountId,
        notificationIds: params.notificationIds,
        now: params.now ?? new Date().toISOString(),
      });
      const unreadCount = await repository.countUnread({ accountId: params.accountId });

      return { unreadCount, updatedCount };
    },
  };
}

const activePartnerStoredNotificationRepository = isPartnerPortalMock
  ? createMockPartnerStoredNotificationRepository()
  : createSupabasePartnerStoredNotificationRepository();

const activePartnerStoredNotificationService = createPartnerStoredNotificationService(
  activePartnerStoredNotificationRepository,
);

export async function listPartnerStoredNotifications(
  params: PartnerStoredNotificationListParams,
) {
  return activePartnerStoredNotificationService.list(params);
}

export async function markPartnerStoredNotificationsRead(
  params: PartnerStoredNotificationMutationParams,
) {
  return activePartnerStoredNotificationService.markRead(params);
}

export async function deletePartnerStoredNotifications(
  params: PartnerStoredNotificationMutationParams,
) {
  return activePartnerStoredNotificationService.remove(params);
}
