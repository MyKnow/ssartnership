import { NextRequest, NextResponse } from "next/server";
import { ensureAdminApiPermission } from "@/lib/admin-access";
import { getRequestLogContext, logAdminAudit } from "@/lib/activity-logs";
import { isSameOriginPushRequest } from "@/lib/push/ops";
import { sendAdminNotificationCampaign, type AdminNotificationChannelSelection, type AdminNotificationType } from "@/lib/admin-notification-ops";
import { parsePushAudience } from "@/lib/push";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const context = getRequestLogContext(request);
  if (!isSameOriginPushRequest(request)) {
    return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 403 });
  }

  const accessDenied = await ensureAdminApiPermission(
    request,
    "notifications",
    "create",
  );
  if (accessDenied) {
    return accessDenied;
  }

  try {
    const body = (await request.json()) as {
      notificationType?: AdminNotificationType;
      title?: string;
      body?: string;
      url?: string | null;
      channels?: Partial<AdminNotificationChannelSelection>;
      audience?: unknown;
      confirmationText?: string | null;
    };
    const result = await sendAdminNotificationCampaign({
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
    });

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
      },
    });

    return NextResponse.json({
      ok: true,
      result,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "공지 알림 발송에 실패했습니다.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
