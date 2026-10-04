import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";

const repoRoot = new URL("..", import.meta.url).pathname;

function readSource(path: string) {
  return readFileSync(join(repoRoot, path), "utf8");
}

function listSourceFiles(directory: string): string[] {
  const absolute = join(repoRoot, directory);
  return readdirSync(absolute).flatMap((entry) => {
    const path = join(absolute, entry);
    if (statSync(path).isDirectory()) {
      return listSourceFiles(relative(repoRoot, path));
    }
    return /\.(ts|tsx)$/.test(entry) ? [relative(repoRoot, path)] : [];
  });
}

test("web-push 모듈 로더는 push/web-push-client.ts 한 곳에만 있다", () => {
  const definitions = listSourceFiles("src").filter((path) =>
    /function getWebPush\(/.test(readSource(path)),
  );
  assert.deepEqual(definitions, ["src/lib/push/web-push-client.ts"]);

  const importers = listSourceFiles("src").filter((path) =>
    /(?<!typeof )import\("web-push"\)|^import (?!type ).*from "web-push"/m.test(
      readSource(path),
    ),
  );
  assert.deepEqual(importers, ["src/lib/push/web-push-client.ts"]);

  const directSenders = listSourceFiles("src").filter((path) =>
    /\.sendNotification\(/.test(readSource(path)),
  );
  assert.deepEqual(
    directSenders,
    ["src/lib/push/web-push-client.ts"],
    "발송은 타임아웃이 걸린 sendWebPush만 사용한다",
  );
});

test("관리자 알림 운영 타입은 서버 모듈과 분리되어 있고 역import 순환이 없다", () => {
  const types = readSource("src/lib/admin-notification-ops-types.ts");
  assert.doesNotMatch(types, /^import (?!type )/m, "types module must stay type-only");
  assert.match(types, /export const ADMIN_NOTIFICATION_TYPES/);

  for (const path of [
    "src/lib/admin-notification-ops-utils.ts",
    "src/lib/admin-notification-ops-delivery.ts",
  ]) {
    assert.doesNotMatch(
      readSource(path),
      /from "@\/lib\/admin-notification-ops"/,
      `${path} must import types from admin-notification-ops-types`,
    );
  }

  const componentImporters = listSourceFiles("src/components").filter((path) =>
    /from "@\/lib\/admin-notification-ops"/.test(readSource(path)),
  );
  assert.deepEqual(componentImporters, []);
});

test("알림·이벤트 회원 순회는 탈퇴 회원을 제외하고 PK 순서로 페이지를 나눈다", () => {
  const operations = readSource("src/lib/admin-notification-ops.ts");
  assert.equal(
    (
      operations.match(
        /\.select\(MEMBER_IDENTITY_SELECT\)\s*\.is\("deleted_at", null\)/g,
      ) ?? []
    ).length,
    2,
  );
  assert.doesNotMatch(operations, /\.order\("display_name"/);

  const newPartner = readSource("src/lib/new-partner-notifications.ts");
  assert.match(
    newPartner,
    /\.select\("id,campus"\)\s*\.is\("deleted_at", null\)[\s\S]{0,120}\.order\("id", \{ ascending: true \}\)/,
  );

  // 추첨 후보 순서 계약 때문에 이벤트 보상 후보는 기존 정렬을 유지한다.
  const eventRewards = readSource("src/lib/promotions/event-rewards.ts");
  assert.match(
    eventRewards,
    /\.select\(MEMBER_EVENT_CANDIDATE_SELECT\)\s*\.is\("deleted_at", null\)[\s\S]{0,200}\.order\("generation", \{ ascending: false \}\)\s*\.order\("display_name", \{ ascending: true \}\)\s*\.order\("id", \{ ascending: true \}\)/,
  );
});

test("관리자·파트너 운영 푸시 팬아웃은 한 함수를 config로 공유한다", () => {
  const operational = readSource("src/lib/operational-notifications.ts");
  assert.equal((operational.match(/async function sendOperationalPushDeliveries\(/g) ?? []).length, 1);
  assert.match(operational, /sendOperationalPushDeliveries\(ADMIN_OPERATIONAL_PUSH,/);
  assert.match(operational, /sendOperationalPushDeliveries\(PARTNER_OPERATIONAL_PUSH,/);
  assert.equal(
    (operational.match(/forEachWithConcurrency\(\s*subscriptions,/g) ?? []).length,
    1,
    "구독 팬아웃 루프는 한 벌만 둔다",
  );
});
