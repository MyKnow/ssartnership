import { NextResponse } from "next/server";
import { getRequestLogContext, logAdminAudit } from "@/lib/activity-logs";
import { getSignedUserSession } from "@/lib/user-auth";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";
import { syncMemberMattermostProfile } from "@/lib/member-mattermost-profile-sync";
import { getMemberProfilePhotoState } from "@/lib/member-profile-images";
import { requiresMemberProfilePhotoUpdate } from "@/lib/member-profile-photo";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const context = getRequestLogContext(request);
  if (!isTrustedSameOriginRequest(request)) {
    return NextResponse.json({ ok: false, updated: false }, { status: 403 });
  }

  const session = await getSignedUserSession();
  if (!session?.userId) {
    return NextResponse.json({ ok: false, updated: false }, { status: 401 });
  }

  try {
    const syncResult = await syncMemberMattermostProfile(session.userId);
    if (!syncResult) {
      return NextResponse.json(
        {
          ok: false,
          updated: false,
          message: "연결된 Mattermost 계정을 찾지 못했습니다.",
        },
        { status: 409 },
      );
    }
    if ("unavailable" in syncResult) {
      await logAdminAudit({
        ...context,
        action: "member_email_login_transition",
        actorId: session.userId,
        targetType: "member",
        targetId: session.userId,
        properties: {
          source: "member_profile_action",
          reason: syncResult.transitionReason,
          mmUserId: syncResult.member.mmUserId,
          generation: syncResult.member.generation,
          lifecycleStatus: syncResult.lifecycleStatus,
          detailCode: syncResult.detailCode,
          providerRequestId: syncResult.providerRequestId,
        },
      });
      return NextResponse.json(
        {
          ok: false,
          updated: false,
          message: "MM 이용 상태가 종료되어 MM 로그인을 중단했습니다. 이메일 로그인 설정을 위해 관리자에게 문의해 주세요.",
          lifecycleStatus: syncResult.lifecycleStatus,
          detailCode: syncResult.detailCode,
          providerRequestId: syncResult.providerRequestId,
        },
        { status: 409 },
      );
    }
    if (syncResult.updated || syncResult.imageSkipped) {
      await logAdminAudit({
        ...context,
        action: "member_sync",
        actorId: session.userId,
        targetType: "member",
        targetId: session.userId,
        properties: {
          source: "member_profile_action",
          changedFields: syncResult.changedFields,
          imageUpdated: syncResult.imageUpdated,
          imageSkipped: syncResult.imageSkipped,
        },
      });
    }
    const photoState = await getMemberProfilePhotoState(session.userId);
    const requiresProfilePhotoSubmission = requiresMemberProfilePhotoUpdate(
      photoState.reviewStatus,
    );

    return NextResponse.json({
      ok: true,
      updated: syncResult.updated,
      changedFields: syncResult.changedFields,
      imageSkipped: syncResult.imageSkipped,
      requiresProfilePhotoSubmission,
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        updated: false,
        message: "프로필 동기화에 실패했습니다. 잠시 후 다시 시도해 주세요.",
      },
      { status: 503 },
    );
  }
}
