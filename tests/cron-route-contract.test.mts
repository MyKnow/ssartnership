import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

import {
  ensureCronApiAccess,
  getCronErrorResponse,
} from "../src/lib/cron-route.ts";
import { REGISTERED_CRON_PATHS } from "../scripts/lib/self-host-cron.mjs";

const root = new URL("..", import.meta.url);
const cronRoot = new URL("src/app/api/cron/", root);

function getCronRouteNames() {
  return readdirSync(cronRoot, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        readFileSync(new URL(`${entry.name}/route.ts`, cronRoot), "utf8").length > 0,
    )
    .map((entry) => entry.name)
    .sort();
}

test("cron route matrix는 schedules.json 등록 경로와 공용 보안 계약을 모두 사용한다", () => {
  const routeNames = getCronRouteNames();
  const schedules = JSON.parse(
    readFileSync(
      new URL("deploy/self-host-operations/production-cron/schedules.json", root),
      "utf8",
    ),
  ) as {
    crons?: Array<{ path?: string }>;
    unscheduled?: Array<{ path?: string }>;
  };
  const toRouteName = (entry: { path?: string }) =>
    entry.path?.match(/^\/api\/cron\/([^/]+)$/)?.[1] ?? "";
  const configuredRouteNames = [
    ...(schedules.crons ?? []),
    ...(schedules.unscheduled ?? []),
  ]
    .map(toRouteName)
    .filter(Boolean)
    .sort();

  assert.deepEqual(routeNames, configuredRouteNames);
  assert.deepEqual(
    [...REGISTERED_CRON_PATHS].map((path) => path.slice("/api/cron/".length)).sort(),
    routeNames,
  );

  for (const routeName of routeNames) {
    const source = readFileSync(
      new URL(`src/app/api/cron/${routeName}/route.ts`, root),
      "utf8",
    );
    assert.match(source, /ensureCronApiAccess/);
    assert.match(source, /getCronErrorResponse/);
    assert.match(source, new RegExp(`getCronErrorResponse\\(\\s*"${routeName}"`));
    assert.doesNotMatch(source, /process\.env\.CRON_SECRET/);
    assert.doesNotMatch(source, /error\.message/);
  }
});

test("cron 인증은 설정된 bearer secret만 허용하고 실패 응답을 통일한다", async () => {
  const originalSecret = process.env.CRON_SECRET;
  try {
    delete process.env.CRON_SECRET;
    const missingSecret = ensureCronApiAccess(
      new Request("https://example.com/api/cron/rss"),
    );
    assert.equal(missingSecret?.status, 401);
    assert.deepEqual(await missingSecret?.json(), { message: "Unauthorized" });

    process.env.CRON_SECRET = "cron-test-secret";
    assert.equal(
      ensureCronApiAccess(
        new Request("https://example.com/api/cron/rss", {
          headers: { authorization: "Bearer wrong" },
        }),
      )?.status,
      401,
    );
    assert.equal(
      ensureCronApiAccess(
        new Request("https://example.com/api/cron/rss", {
          headers: { authorization: "Bearer cron-test-secret" },
        }),
      ),
      null,
    );
  } finally {
    if (originalSecret === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = originalSecret;
    }
  }
});

test("cron 500 응답은 route key로 고정된 안전 메시지만 노출한다", async () => {
  const response = getCronErrorResponse("rss");

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), {
    ok: false,
    message: "RSS 피드를 갱신하지 못했습니다.",
  });
});
