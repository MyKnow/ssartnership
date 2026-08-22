import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const feedbackModulePromise = import(
  new URL("../src/lib/admin-account-feedback.ts", import.meta.url).href
) as Promise<typeof import("../src/lib/admin-account-feedback.ts")>;

const actionsPath = new URL(
  "../src/app/admin/(protected)/_actions/admin-account-actions.ts",
  import.meta.url,
);
const pagePath = new URL(
  "../src/app/admin/(protected)/admins/page.tsx",
  import.meta.url,
);
const viewPath = new URL(
  "../src/components/admin/AdminAccountsView.tsx",
  import.meta.url,
);

test("관리자 권한 피드백은 안전한 상태 코드만 사용자 문구로 바꾼다", async () => {
  const feedbackModule = await feedbackModulePromise;
  assert.deepEqual(feedbackModule.getAdminAccountFeedback("granted"), {
    tone: "info",
    message: "회원에게 관리자 권한을 부여했습니다.",
  });
  assert.deepEqual(
    feedbackModule.getAdminAccountFeedback("admin_account_invalid_request"),
    {
      tone: "error",
      message: "입력한 회원·권한·관리 캠퍼스를 확인해 주세요.",
    },
  );
  assert.deepEqual(
    feedbackModule.getAdminAccountFeedback("postgres connection refused"),
    {
      tone: "error",
      message: "관리자 작업을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    },
  );
});

test("관리자 권한 액션과 페이지는 raw 오류 메시지를 URL이나 UI로 전달하지 않는다", async () => {
  const [actions, page, view] = await Promise.all([
    readFile(actionsPath, "utf8"),
    readFile(pagePath, "utf8"),
    readFile(viewPath, "utf8"),
  ]);

  assert.match(actions, /getAdminAccountActionErrorCode\(error\)/);
  assert.doesNotMatch(actions, /message:\s*error instanceof Error/);
  assert.match(page, /getAdminAccountFeedback\(status\)/);
  assert.match(page, /try \{/);
  assert.match(page, /loadError/);
  assert.doesNotMatch(page, /params\.message/);
  assert.match(view, /<details className="group">/);
  assert.match(view, /account\.isActive \? "활성" : "비활성"/);
  assert.match(view, /value=\{String\(!account\.isActive\)\}/);
  assert.match(view, /kind="empty"/);
});
