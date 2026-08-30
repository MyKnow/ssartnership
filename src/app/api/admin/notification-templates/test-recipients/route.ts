import { NextRequest, NextResponse } from "next/server";
import { getNotificationTemplateAdminApiSession } from "@/lib/admin-access";
import { listNotificationTemplateTestRecipients } from "@/lib/notification-templates/test-delivery.server";
import { withServerTiming } from "@/lib/server-timing";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  return withServerTiming(async (timing) => {
    const access = await timing.measure("auth", () =>
      getNotificationTemplateAdminApiSession(request, "read"),
    );
    if ("response" in access) {
      return access.response;
    }
    const { session } = access;

    try {
      const recipients = await timing.measure("query", () =>
        listNotificationTemplateTestRecipients({
          preferredMemberId: session.adminId,
        }),
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
