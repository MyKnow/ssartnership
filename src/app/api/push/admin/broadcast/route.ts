import { NextRequest, NextResponse } from "next/server";
import { ensureAdminApiPermission } from "@/lib/admin-access";
import { getRequestLogContext, logAdminAudit } from "@/lib/activity-logs";
import { isSameOriginPushRequest } from "@/lib/push/ops";
import { sendAdminNotificationCampaign, type AdminNotificationChannelSelection, type AdminNotificationType } from "@/lib/admin-notification-ops";
import { parsePushAudience } from "@/lib/push";
import { isUuid } from "@/lib/uuid";
import { getSafeAdminMessage } from "@/lib/admin-safe-messages";
import { withServerTiming } from "@/lib/server-timing";
import {
  AdminNotificationRouteBodyError,
  readAdminNotificationJsonBody,
} from "@/lib/admin-notification-route-body";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  return withServerTiming(async (timing) => {
    const context = getRequestLogContext(request);
    if (!isSameOriginPushRequest(request)) {
      return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 403 });
    }

    const accessDenied = await timing.measure("auth", () =>
      ensureAdminApiPermission(request, "notifications", "create"),
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
        confirmationText?: string | null;
        idempotencyKey?: string | null;
      }>(request);
      const idempotencyKey = body.idempotencyKey?.trim() ?? "";
      if (!isUuid(idempotencyKey)) {
        return NextResponse.json(
          { message: "발송 요청 식별자를 확인해 주세요." },
          { status: 400 },
        );
      }
      const result = await timing.measure("query", () =>
        sendAdminNotificationCampaign({
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
          confirmationText: body.confirmationText ?? null,
          idempotencyKey,
        }),
      );

      await logAdminAudit({
        ...context,
        action: "push_send",
        targetType: "push_message",
        properties: {
          type: result.preview.notificationType,
          channels: result.preview.selectedChannels,
          audienceScope: result.preview.audienceScope,
          audienceLabel: result.preview.audienceLabel,
          destination: result.preview.destinationLabel,
          totalAudienceCount: result.preview.totalAudienceCount,
          channelResults: result.channelResults,
          alreadyExists: result.alreadyExists ?? false,
        },
      });

      return NextResponse.json({
        ok: true,
        result,
      });
    } catch (error) {
      if (error instanceof AdminNotificationRouteBodyError) {
        return NextResponse.json(
          { message: error.message },
          { status: error.status },
        );
      }
      console.error("[push-admin-broadcast] send failed", error);
      const message = getSafeAdminMessage(
        error,
        "알림 발송에 실패했습니다. 잠시 후 다시 시도해 주세요.",
      );
      return NextResponse.json(
        { message },
        {
          status:
            message === "알림 발송에 실패했습니다. 잠시 후 다시 시도해 주세요."
              ? 503
              : 400,
        },
      );
    }
  });
}
