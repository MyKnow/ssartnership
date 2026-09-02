import { createNotificationStorageError } from "@/lib/notifications/safe-error";
import { listMockPartnerPortalSetupsInternal } from "@/lib/mock/partner-portal/store";
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

type MockPartnerStoredNotificationRecipient = {
  id: string;
  accountId: string;
  notificationId: string;
  readAt: string | null;
  deletedAt: string | null;
  createdAt: string;
};

type MockPartnerStoredNotificationState = {
  notifications: Map<string, StoredPartnerNotificationRelation>;
  recipients: MockPartnerStoredNotificationRecipient[];
};

const mockPartnerNotificationGlobalScope = globalThis as typeof globalThis & {
  __mockPartnerStoredNotificationState?: MockPartnerStoredNotificationState;
};

const MOCK_GLOBAL_PARTNER_NOTIFICATION_ID =
  "10000000-0000-4000-8000-000000000001";

function createMockNotificationId(index: number) {
  return `10000000-0000-4000-8000-${String(index + 2).padStart(12, "0")}`;
}

function createMockRecipientId(index: number) {
  return `20000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
}

function createMockPartnerStoredNotificationState(): MockPartnerStoredNotificationState {
  const setups = listMockPartnerPortalSetupsInternal();
  const notifications = new Map<string, StoredPartnerNotificationRelation>();
  notifications.set(MOCK_GLOBAL_PARTNER_NOTIFICATION_ID, {
    id: MOCK_GLOBAL_PARTNER_NOTIFICATION_ID,
    type: "plan",
    title: "파트너 포털 운영 안내",
    body: "새로운 운영 소식과 제휴 현황을 확인해 주세요.",
    target_url: "/partner",
    metadata: { source: "mock" },
    company_id: null,
    created_at: "2026-08-30T09:00:00.000Z",
  });

  const companyNotificationIds = new Map<string, string>();
  const companySetups = new Map(
    setups.map((setup) => [setup.company.id, setup] as const),
  );
  [...companySetups.values()].forEach((setup, index) => {
    const notificationId = createMockNotificationId(index);
    companyNotificationIds.set(setup.company.id, notificationId);
    notifications.set(notificationId, {
      id: notificationId,
      type: "plan",
      title: `${setup.company.name} 운영 현황이 업데이트되었습니다`,
      body: "이번 달 제휴 운영 현황과 플랜 정보를 확인해 주세요.",
      target_url: `/partner/companies/${setup.company.id}/plans`,
      metadata: { source: "mock" },
      company_id: setup.company.id,
      created_at: new Date(
        Date.parse("2026-08-30T08:00:00.000Z") - index * 60_000,
      ).toISOString(),
    });
  });

  const recipients: MockPartnerStoredNotificationRecipient[] = [];
  const accountSetups = new Map(
    setups.map((setup) => [setup.account.id, setup] as const),
  );
  for (const setup of accountSetups.values()) {
    const accessibleCompanyIds = setup.account.linkedCompanyIds ?? [
      setup.company.id,
    ];
    const notificationIds = [
      MOCK_GLOBAL_PARTNER_NOTIFICATION_ID,
      ...accessibleCompanyIds
        .map((companyId) => companyNotificationIds.get(companyId) ?? null)
        .filter((id): id is string => Boolean(id)),
    ];

    for (const notificationId of notificationIds) {
      const notification = notifications.get(notificationId);
      if (!notification) {
        continue;
      }
      recipients.push({
        id: createMockRecipientId(recipients.length),
        accountId: setup.account.id,
        notificationId,
        readAt: null,
        deletedAt: null,
        createdAt: notification.created_at,
      });
    }
  }

  return { notifications, recipients };
}

function getMockPartnerStoredNotificationState() {
  if (!mockPartnerNotificationGlobalScope.__mockPartnerStoredNotificationState) {
    mockPartnerNotificationGlobalScope.__mockPartnerStoredNotificationState =
      createMockPartnerStoredNotificationState();
  }
  return mockPartnerNotificationGlobalScope.__mockPartnerStoredNotificationState;
}

export function resetMockPartnerStoredNotificationStore() {
  delete mockPartnerNotificationGlobalScope.__mockPartnerStoredNotificationState;
}

function createMockPartnerStoredNotificationRepository(): PartnerStoredNotificationRepository {
  function isSelected(
    recipient: MockPartnerStoredNotificationRecipient,
    accountId: string,
    notificationIds?: string[] | null,
  ) {
    return (
      recipient.accountId === accountId &&
      (!notificationIds || notificationIds.includes(recipient.notificationId))
    );
  }

  return {
    async listScopedNotificationIds(companyId) {
      return [...getMockPartnerStoredNotificationState().notifications.values()]
        .filter(
          (notification) =>
            notification.company_id == null ||
            notification.company_id === companyId,
        )
        .map((notification) => notification.id);
    },

    async countUnread({ accountId, notificationIds }) {
      return getMockPartnerStoredNotificationState().recipients.filter(
        (recipient) =>
          isSelected(recipient, accountId, notificationIds) &&
          recipient.deletedAt == null &&
          recipient.readAt == null,
      ).length;
    },

    async list({ accountId, notificationIds, limit }) {
      const state = getMockPartnerStoredNotificationState();
      return state.recipients
        .filter(
          (recipient) =>
            isSelected(recipient, accountId, notificationIds) &&
            recipient.deletedAt == null,
        )
        .sort((left, right) => {
          if (left.createdAt === right.createdAt) {
            return right.id.localeCompare(left.id);
          }
          return right.createdAt.localeCompare(left.createdAt);
        })
        .slice(0, limit)
        .map((recipient) => {
          const notification = state.notifications.get(recipient.notificationId);
          return {
            id: recipient.id,
            read_at: recipient.readAt,
            deleted_at: recipient.deletedAt,
            created_at: recipient.createdAt,
            notification: notification
              ? {
                  ...notification,
                  metadata: notification.metadata
                    ? { ...notification.metadata }
                    : notification.metadata,
                }
              : null,
          };
        });
    },

    async markRead({ accountId, notificationIds, now }) {
      let updatedCount = 0;
      for (const recipient of getMockPartnerStoredNotificationState().recipients) {
        if (
          isSelected(recipient, accountId, notificationIds) &&
          recipient.deletedAt == null &&
          recipient.readAt == null
        ) {
          recipient.readAt = now;
          updatedCount += 1;
        }
      }
      return updatedCount;
    },

    async softDelete({ accountId, notificationIds, now }) {
      let updatedCount = 0;
      for (const recipient of getMockPartnerStoredNotificationState().recipients) {
        if (
          isSelected(recipient, accountId, notificationIds) &&
          recipient.deletedAt == null
        ) {
          recipient.deletedAt = now;
          updatedCount += 1;
        }
      }
      return updatedCount;
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
        .update({ read_at: now, updated_at: now }, { count: "exact" })
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

    async softDelete({ accountId, notificationIds, now }) {
      const supabase = getSupabaseAdminClient();
      let query = supabase
        .from("partner_notification_recipients")
        .update({ deleted_at: now, updated_at: now }, { count: "exact" })
        .eq("account_id", accountId)
        .is("deleted_at", null);
      if (notificationIds && notificationIds.length > 0) {
        query = query.in("notification_id", notificationIds);
      }
      const { count, error } = await query;

      if (error) {
        throw createNotificationStorageError(error);
      }

      return count ?? 0;
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
