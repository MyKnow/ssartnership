import { NextRequest, NextResponse } from "next/server";
import { getRequestLogContext, logAdminAudit } from "@/lib/activity-logs";
import { getAdminApiPermissionSession } from "@/lib/admin-access";
import {
  AdminMemberPasswordResetError,
  issueAdminMemberPasswordReset,
  type AdminMemberPasswordResetDelivery,
} from "@/lib/admin-member-password-reset";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";
import { withServerTiming } from "@/lib/server-timing";
import { isUuid } from "@/lib/uuid";

export const runtime = "nodejs";

function response(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  return withServerTiming(async (timing) => {
    if (!isTrustedSameOriginRequest(request, {
      expectedOrigin: request.nextUrl.origin,
      allowedContentTypes: ["application/json"],
    })) {
      return response({ ok: false, message: "요청을 확인해 주세요." }, 403);
    }

    const permission = await timing.measure("auth", () =>
      getAdminApiPermissionSession(request, "members", "update"),
    );
    if ("response" in permission) {
      return permission.response;
    }

    const body = await request.json().catch(() => null) as { delivery?: unknown } | null;
    const delivery = body?.delivery;
    if (delivery !== "copy" && delivery !== "email") {
      return response({ ok: false, message: "재발급 방식을 확인해 주세요." }, 400);
    }
    const { id: memberId } = await context.params;
    if (!isUuid(memberId)) {
      return response({ ok: false, message: "회원을 확인해 주세요." }, 400);
    }

    const action = delivery === "email"
      ? "member_password_reset_link_send" as const
      : "member_password_reset_link_generate" as const;
    const audit = {
      ...getRequestLogContext(request),
      action,
      actorId: permission.session.adminId,
      targetType: "member",
      targetId: memberId,
      properties: { delivery },
    };

    try {
      const issued = await timing.measure("query", () =>
        issueAdminMemberPasswordReset({
          memberId,
          delivery: delivery as AdminMemberPasswordResetDelivery,
        }),
      );
      await logAdminAudit({
        ...audit,
        action: issued.actionKind === "initial_setup"
          ? "member_manual_setup_link_reissue"
          : audit.action,
        properties: {
          ...audit.properties,
          actionKind: issued.actionKind,
          outcome: "success",
        },
      });
      return response({
        ok: true,
        actionKind: issued.actionKind,
        ...(issued.resetUrl ? { resetUrl: issued.resetUrl } : {}),
      });
    } catch (error) {
      await logAdminAudit({
        ...audit,
        properties: { ...audit.properties, outcome: "failure" },
      });
      if (error instanceof AdminMemberPasswordResetError) {
        if (error.code === "member_not_found") {
          return response({ ok: false, message: "회원을 찾을 수 없습니다." }, 404);
        }
        if (error.code === "email_not_available") {
          return response(
            { ok: false, message: "등록된 이메일이 있는 회원에게만 이메일로 발송할 수 있습니다." },
            400,
          );
        }
        if (error.code === "email_delivery_failed") {
          return response(
            { ok: false, message: "이메일을 발송하지 못했습니다. 잠시 후 다시 시도해 주세요." },
            503,
          );
        }
        if (error.code === "email_transition_pending") {
          return response(
            {
              ok: false,
              message: "이메일 로그인 전환이 진행 중인 회원입니다. 기존 전환을 완료하거나 새 전환 링크를 발급해 주세요.",
            },
            409,
          );
        }
      }
      return response(
        { ok: false, message: "비밀번호 재발급 링크를 준비하지 못했습니다. 잠시 후 다시 시도해 주세요." },
        503,
      );
    }
  });
}
