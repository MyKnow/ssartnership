import { NextResponse } from "next/server.js";

const CRON_ERROR_MESSAGES = {
  "anonymize-deleted-members": "탈퇴 회원 익명화를 완료하지 못했습니다.",
  "archive-expired-promotions": "만료된 프로모션을 정리하지 못했습니다.",
  "cleanup-graduate-verification-files":
    "수료생 인증 파일 정리를 완료하지 못했습니다.",
  "cleanup-image-uploads": "만료된 이미지 임시 파일을 정리하지 못했습니다.",
  "cleanup-manual-member-imports":
    "가져오기 임시 파일을 정리하지 못했습니다.",
  "mattermost-sender-health": "Mattermost Sender 상태를 확인하지 못했습니다.",
  "partner-billing": "Partner billing cron failed",
  "purge-expired-operational-logs": "만료된 운영 로그를 정리하지 못했습니다.",
  "push-expiring-partners": "만료 예정 제휴처를 불러오지 못했습니다.",
  "reconcile-apple-wallet-passes":
    "Apple Wallet 패스 상태 조정을 완료하지 못했습니다.",
  rss: "RSS 피드를 갱신하지 못했습니다.",
} as const;

export type CronRouteName = keyof typeof CRON_ERROR_MESSAGES;

type CronResponseOptions = {
  headers?: HeadersInit;
};

export function ensureCronApiAccess(
  request: Pick<Request, "headers">,
  options?: CronResponseOptions,
) {
  const secret = process.env.CRON_SECRET;
  if (
    secret
    && request.headers.get("authorization") === `Bearer ${secret}`
  ) {
    return null;
  }

  return NextResponse.json(
    { message: "Unauthorized" },
    { status: 401, headers: options?.headers },
  );
}

export function getCronErrorResponse(
  routeName: CronRouteName,
  options?: CronResponseOptions,
) {
  return NextResponse.json(
    { ok: false, message: CRON_ERROR_MESSAGES[routeName] },
    { status: 500, headers: options?.headers },
  );
}
