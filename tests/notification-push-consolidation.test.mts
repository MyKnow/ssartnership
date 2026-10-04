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
