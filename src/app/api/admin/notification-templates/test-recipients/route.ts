import { NextRequest, NextResponse } from "next/server";
import { ensureAdminApiPermission } from "@/lib/admin-access";
import { listNotificationTemplateTestRecipients } from "@/lib/notification-templates/test-delivery.server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const denied = await ensureAdminApiPermission(
    request,
    "notification_templates",
    "read",
  );
  if (denied) {
    return denied;
  }

  try {
    return NextResponse.json(await listNotificationTemplateTestRecipients());
  } catch {
    return NextResponse.json(
      { message: "테스트 수신 회원을 불러오지 못했습니다." },
      { status: 503 },
    );
  }
}
