import {
  JsonRequestBodyError,
  readJsonRequestBodyWithinLimit,
} from "@/lib/request-body-limit";
import {
  NOTIFICATION_TEMPLATE_MAX_BODY_LENGTH,
  NOTIFICATION_TEMPLATE_MAX_TITLE_LENGTH,
} from "@/lib/notification-templates/template";

// Allow enough UTF-8 headroom for Korean text plus JSON framing while still
// bounding preview/send payload parsing at the route edge.
export const MAX_ADMIN_NOTIFICATION_JSON_BODY_BYTES =
  (NOTIFICATION_TEMPLATE_MAX_TITLE_LENGTH + NOTIFICATION_TEMPLATE_MAX_BODY_LENGTH) * 4
  + 8_192;

export class AdminNotificationRouteBodyError extends Error {
  readonly status: 400 | 413;

  constructor(message: string, status: 400 | 413) {
    super(message);
    this.name = "AdminNotificationRouteBodyError";
    this.status = status;
  }
}

export async function readAdminNotificationJsonBody<T>(request: Request) {
  try {
    return await readJsonRequestBodyWithinLimit<T>(
      request,
      MAX_ADMIN_NOTIFICATION_JSON_BODY_BYTES,
    );
  } catch (error) {
    if (error instanceof AdminNotificationRouteBodyError) {
      throw error;
    }
    if (
      error instanceof JsonRequestBodyError &&
      error.code === "body_too_large"
    ) {
      throw new AdminNotificationRouteBodyError(
        "알림 요청 본문이 너무 큽니다.",
        413,
      );
    }
    throw new AdminNotificationRouteBodyError(
      "알림 요청 본문 형식을 확인해 주세요.",
      400,
    );
  }
}
