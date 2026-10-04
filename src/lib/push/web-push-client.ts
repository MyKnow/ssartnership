import { getPushEnv } from "./config.ts";
import type { WebPushModule } from "./types.ts";

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
