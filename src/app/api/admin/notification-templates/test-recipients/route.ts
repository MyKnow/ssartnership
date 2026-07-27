import { NextRequest, NextResponse } from "next/server";
import { ensureAdminApiPermission } from "@/lib/admin-access";
import { listNotificationTemplateTestRecipients } from "@/lib/notification-templates/test-delivery.server";
import { withServerTiming } from "@/lib/server-timing";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  return withServerTiming(async (timing) => {
    const denied = await timing.measure("auth", () =>
      ensureAdminApiPermission(
        request,
        "notification_templates",
        "read",
      ),
    );
    if (denied) {
      return denied;
    }

    try {
      const recipients = await timing.measure("query", () =>
        listNotificationTemplateTestRecipients(),
      );
      return NextResponse.json(recipients);
    } catch (error) {
      console.error("[admin-notification-test-recipients] read failed", error);
      return NextResponse.json(
        { message: "테스트 수신 회원을 불러오지 못했습니다." },
        { status: 503 },
      );
    }
  });
}
