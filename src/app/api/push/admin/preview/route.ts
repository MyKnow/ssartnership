import { NextRequest, NextResponse } from "next/server";
import { ensureAdminApiAccess } from "@/lib/admin-access";
import { isSameOriginPushRequest } from "@/lib/push/ops";
import { parsePushAudience } from "@/lib/push";
import {
  previewAdminNotificationCampaign,
  type AdminNotificationChannelSelection,
  type AdminNotificationType,
} from "@/lib/admin-notification-ops";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!isSameOriginPushRequest(request)) {
    return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 403 });
  }

  const accessDenied = await ensureAdminApiAccess(request);
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
    };

    const preview = await previewAdminNotificationCampaign({
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
    });

    return NextResponse.json({ ok: true, preview });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "알림 검토 정보를 불러오지 못했습니다.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
