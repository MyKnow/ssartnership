import type { getSupabaseAdminClient } from "@/lib/supabase/server";
import { deleteOperationalNotification } from "./repository.supabase";

export class OperationalNotificationPersistenceUncertainError extends Error {
  constructor(message: string, options: { cause: unknown }) {
    super(message, options);
    this.name = "OperationalNotificationPersistenceUncertainError";
  }
}

export async function rollbackCreatedOperationalNotification(input: {
  supabase: ReturnType<typeof getSupabaseAdminClient>;
  audience: "admin" | "partner";
  notificationId: string;
  originalError: unknown;
}) {
  try {
    await deleteOperationalNotification(input.supabase, input.audience, input.notificationId);
  } catch (cleanupError) {
    throw new OperationalNotificationPersistenceUncertainError(
      "알림 생성이 부분 실패했고 저장된 알림을 정리하지 못했습니다.",
      {
        cause: new AggregateError([input.originalError, cleanupError]),
      },
    );
  }
}
