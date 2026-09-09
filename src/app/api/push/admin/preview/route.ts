import { NextRequest, NextResponse } from "next/server";
import { ensureAdminApiPermission } from "@/lib/admin-access";
import { isSameOriginPushRequest } from "@/lib/push/ops";
import { parsePushAudience } from "@/lib/push";
import {
  previewAdminNotificationCampaign,
  type AdminNotificationChannelSelection,
  type AdminNotificationType,
} from "@/lib/admin-notification-ops";
import { getSafeAdminMessage } from "@/lib/admin-safe-messages";
import { withServerTiming } from "@/lib/server-timing";
import {
  AdminNotificationRouteBodyError,
  readAdminNotificationJsonBody,
} from "@/lib/admin-notification-route-body";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  return withServerTiming(async (timing) => {
    if (!isSameOriginPushRequest(request)) {
      return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 403 });
    }

    const accessDenied = await timing.measure("auth", () =>
      ensureAdminApiPermission(request, "notifications", "read"),
    );
    if (accessDenied) {
      return accessDenied;
    }

    try {
      const body = await readAdminNotificationJsonBody<{
        notificationType?: AdminNotificationType;
        title?: string;
        body?: string;
        url?: string | null;
        channels?: Partial<AdminNotificationChannelSelection>;
        audience?: unknown;
      }>(request);

      const preview = await timing.measure("query", () =>
        previewAdminNotificationCampaign({
          notificationType: body.notificationType ?? "announcement",
          title: body.title ?? "",
          body: body.body ?? "",
          url: body.url ?? null,
          audience: parsePushAudience(body.audience),
          channels: {
            in_app: Boolean(body.channels?.in_app),
            push: Boolean(body.channels?.push),
            mm: Boolean(body.channels?.mm),
          },
        }),
      );

      return NextResponse.json({ ok: true, preview });
    } catch (error) {
      if (error instanceof AdminNotificationRouteBodyError) {
        return NextResponse.json(
          { message: error.message },
          { status: error.status },
        );
      }
      console.error("[push-admin-preview] preview failed", error);
      const message = getSafeAdminMessage(
        error,
        "알림 검토 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
      );
      return NextResponse.json(
        { message },
        {
          status:
            message === "알림 검토 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."
              ? 503
              : 400,
        },
      );
    }
  });
}
