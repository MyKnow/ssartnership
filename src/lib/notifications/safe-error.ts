import { PushError } from "@/lib/push/types";
import { RouteJsonBodyError } from "@/lib/route-json-body";

export class NotificationRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotificationRequestError";
  }
}

export function createNotificationStorageError(error: unknown) {
  const wrapped = new Error("알림 저장소를 처리하지 못했습니다.");
  wrapped.cause = error;
  return wrapped;
}

export function getSafeNotificationRouteError(
  error: unknown,
  fallback: string,
) {
  if (error instanceof RouteJsonBodyError) {
    return { message: error.message, status: error.status };
  }
  if (
    error instanceof NotificationRequestError ||
    (error instanceof PushError && error.code === "invalid_request")
  ) {
    return { message: error.message, status: 400 as const };
  }

  return { message: fallback, status: 503 as const };
}

export function shouldLogNotificationRouteError(error: unknown) {
  return getSafeNotificationRouteError(error, "").status >= 500;
}
