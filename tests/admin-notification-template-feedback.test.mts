import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const feedbackModulePromise = import(
  new URL("../src/lib/notification-templates/admin-feedback.ts", import.meta.url).href,
) as Promise<typeof import("../src/lib/notification-templates/admin-feedback.ts")>;

const actionsPath = new URL(
  "../src/app/admin/(protected)/notification-templates/actions.ts",
  import.meta.url,
);
const pagePath = new URL(
  "../src/app/admin/(protected)/notification-templates/page.tsx",
  import.meta.url,
);

test("알림 템플릿 피드백은 URL 오류 값을 안전한 문구로 제한한다", async () => {
  const { getNotificationTemplateFeedback } = await feedbackModulePromise;

  assert.deepEqual(getNotificationTemplateFeedback({ status: "updated" }), {
    tone: "info",
    message: "알림 템플릿을 저장했습니다.",
  });
  assert.deepEqual(getNotificationTemplateFeedback({ error: "invalid_request" }), {
    tone: "error",
    message: "입력한 템플릿·채널·수신 회원 정보를 확인해 주세요.",
  });
  assert.deepEqual(getNotificationTemplateFeedback({ error: "SMTP secret leaked" }), {
    tone: "error",
    message: "알림 템플릿 작업을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.",
  });
});

test("알림 템플릿 액션은 예측 가능한 입력 오류를 throw하거나 raw message로 전달하지 않는다", async () => {
  const [actions, page] = await Promise.all([
    readFile(actionsPath, "utf8"),
    readFile(pagePath, "utf8"),
  ]);

  assert.match(actions, /error=invalid_request/);
  assert.match(actions, /error=save_failed/);
  assert.doesNotMatch(actions, /getSafeAdminMessage/);
  assert.doesNotMatch(actions, /throw new Error\("알림 (?:채널|템플릿 대상)/);
  assert.match(page, /getNotificationTemplateFeedback/);
  assert.doesNotMatch(page, /errorMessage=\{params\.error/);
});
