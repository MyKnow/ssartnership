import { getPushEnv } from "./config.ts";
import { buildTrustedPushSubscriptionRequest } from "./subscription-trust.ts";
import { PushError } from "./types.ts";
import type { WebPushModule } from "./types.ts";

/**
 * push 서비스 응답 대기 상한. 응답 없는 엔드포인트 하나가 동시성 풀 전체와
 * 발송 로그 마감(finalize)을 붙잡지 않도록 모든 발송에 적용한다.
 */
export const WEB_PUSH_SEND_TIMEOUT_MS = 10_000;

let webPushPromise: Promise<WebPushModule> | null = null;

/**
 * VAPID 설정을 마친 web-push 모듈을 프로세스당 한 번만 불러온다.
 * 회원 캠페인·관리자/파트너 운영 알림·템플릿 테스트 발송이 같은 인스턴스를 쓴다.
 */
export function getWebPush(): Promise<WebPushModule> {
  if (!webPushPromise) {
    webPushPromise = import("web-push")
      .then((module) => {
        const { publicKey, privateKey, subject } = getPushEnv();
        module.setVapidDetails(subject, publicKey, privateKey);
        return module;
      })
      .catch((error: unknown) => {
        // 설정 누락처럼 복구 가능한 실패 뒤에 재시도할 수 있도록 캐시를 비운다.
        webPushPromise = null;
        throw error;
      });
  }
  return webPushPromise;
}

export type WebPushTarget = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

/**
 * 저장된 구독을 신뢰 검증한 뒤 타임아웃을 걸어 발송한다. 발송 경로는 모두
 * 이 함수를 거쳐야 하며 `webpush.sendNotification`을 직접 부르지 않는다.
 */
export async function sendWebPush(
  webpush: WebPushModule,
  target: WebPushTarget,
  payload: string,
) {
  const request = await buildTrustedPushSubscriptionRequest(target);
  return webpush.sendNotification(request, payload, {
    timeout: WEB_PUSH_SEND_TIMEOUT_MS,
  });
}

export function getWebPushStatusCode(error: unknown) {
  if (typeof error !== "object" || error === null || !("statusCode" in error)) {
    return null;
  }
  const statusCode = Number((error as { statusCode?: unknown }).statusCode);
  return Number.isFinite(statusCode) ? statusCode : null;
}

/**
 * 만료된 구독(404/410)과 신뢰 검증에 실패한 구독만 비활성화한다.
 * 타임아웃·네트워크 오류·5xx는 일시 장애로 보고 구독을 유지한다.
 */
export function shouldDeactivatePushSubscription(error: unknown) {
  if (error instanceof PushError) {
    return error.code === "invalid_request";
  }
  const statusCode = getWebPushStatusCode(error);
  return statusCode === 404 || statusCode === 410;
}
