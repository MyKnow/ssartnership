import { NextRequest, NextResponse } from "next/server";
import { getNotificationTemplateAdminApiSession } from "@/lib/admin-access";
import {
  getNotificationTemplateDefinition,
  type NotificationTemplateChannel,
} from "@/lib/notification-templates/catalog";
import { resolveNotificationTemplate } from "@/lib/notification-templates/repository.server";
import { withServerTiming } from "@/lib/server-timing";

export const runtime = "nodejs";

function getChannel(value: string | null): NotificationTemplateChannel | null {
  return value === "email" ||
    value === "mattermost" ||
    value === "push" ||
    value === "in_app"
    ? value
    : null;
}

export async function GET(request: NextRequest) {
  return withServerTiming(async (timing) => {
    const access = await timing.measure("auth", () =>
      getNotificationTemplateAdminApiSession(request, "read"),
    );
    if ("response" in access) {
      return access.response;
    }

    const eventKey = request.nextUrl.searchParams.get("eventKey")?.trim() ?? "";
    const channel = getChannel(request.nextUrl.searchParams.get("channel"));
    const definition = getNotificationTemplateDefinition(eventKey);
    if (!definition || !channel || definition.channel !== channel) {
      return NextResponse.json(
        { message: "알림 템플릿 대상을 확인해 주세요." },
        { status: 400 },
      );
    }

    try {
      const template = await timing.measure("query", () =>
        resolveNotificationTemplate(eventKey),
      );
      return NextResponse.json(template, {
        headers: {
          "Cache-Control": "private, no-store",
        },
      });
    } catch {
      return NextResponse.json(
        { message: "알림 템플릿 상세를 불러오지 못했습니다." },
        { status: 503 },
      );
    }
  });
}
