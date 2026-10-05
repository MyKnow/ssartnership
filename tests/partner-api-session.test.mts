import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  PARTNER_API_SESSION_DENIALS,
  partnerApiSessionDeniedResponse,
  resolvePartnerApiSessionDenial,
} from "../src/lib/partner-auth/api-session-policy.ts";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const partnerApiRoot = path.join(repositoryRoot, "src/app/api/partner");

function listRouteFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const entryPath = path.join(directory, entry);
    if (statSync(entryPath).isDirectory()) {
      return listRouteFiles(entryPath);
    }
    return entry === "route.ts" ? [entryPath] : [];
  });
}

function relative(filePath: string) {
  return path.relative(repositoryRoot, filePath).split(path.sep).join("/");
}

/**
 * Partner API routes that do not use the shared session gate, with the reason.
 * Anything else that reads a partner session must call
 * `requirePartnerApiSession()`.
 */
const SESSION_GATE_EXCEPTIONS = new Map<string, string>([
  [
    "src/app/api/partner/change-password/route.ts",
    "비밀번호 변경 자체가 강제 변경을 해소하므로 세션만 확인하고 보안 로그를 직접 남긴다",
  ],
  ["src/app/api/partner/reset-password/route.ts", "로그인 전 임시 비밀번호 발급 흐름"],
  ["src/app/api/partner/setup/[token]/route.ts", "로그인 전 초기 설정 토큰 흐름"],
]);

const PASSWORD_CHANGE_PENDING_ALLOWED = new Set([
  // Unsubscribing only reduces exposure.
  "src/app/api/partner/push/unsubscribe/route.ts",
]);

test("파트너 API 세션 판정은 미로그인 401, 강제 비밀번호 변경 403이다", () => {
  assert.equal(resolvePartnerApiSessionDenial(null), "unauthorized");
  assert.equal(resolvePartnerApiSessionDenial(undefined), "unauthorized");
  assert.equal(resolvePartnerApiSessionDenial({ accountId: "" }), "unauthorized");
  assert.equal(
    resolvePartnerApiSessionDenial({ accountId: "account-1", mustChangePassword: true }),
    "password_change_required",
  );
  assert.equal(
    resolvePartnerApiSessionDenial(
      { accountId: "account-1", mustChangePassword: true },
      { allowPasswordChangeRequired: true },
    ),
    null,
  );
  assert.equal(
    resolvePartnerApiSessionDenial({ accountId: "account-1", mustChangePassword: false }),
    null,
  );
  assert.equal(PARTNER_API_SESSION_DENIALS.unauthorized.status, 401);
  assert.equal(PARTNER_API_SESSION_DENIALS.password_change_required.status, 403);
});

test("파트너 API 세션 거부 응답은 상태 코드와 안전한 한국어 메시지만 담는다", async () => {
  const unauthorized = partnerApiSessionDeniedResponse("unauthorized");
  assert.equal(unauthorized.status, 401);
  assert.deepEqual(await unauthorized.json(), {
    ok: false,
    error: "unauthorized",
    message: "로그인이 필요합니다.",
  });

  const passwordChange = partnerApiSessionDeniedResponse("password_change_required");
  assert.equal(passwordChange.status, 403);
  assert.deepEqual(await passwordChange.json(), {
    ok: false,
    error: "password_change_required",
    message: "비밀번호를 변경한 뒤 다시 시도해 주세요.",
  });
});

test("세션이 필요한 파트너 API는 모두 공용 세션 게이트를 본문 해석 전에 호출한다", () => {
  const routeFiles = listRouteFiles(partnerApiRoot).map((filePath) => ({
    path: relative(filePath),
    source: readFileSync(filePath, "utf8"),
  }));
  assert.ok(routeFiles.length >= 10);

  for (const route of routeFiles) {
    if (SESSION_GATE_EXCEPTIONS.has(route.path)) {
      assert.doesNotMatch(route.source, /requirePartnerApiSession/, route.path);
      continue;
    }

    assert.doesNotMatch(route.source, /getPartnerSession\(|getSignedPartnerSession\(/, route.path);
    const [preamble, ...handlers] = route.source.split(/export async function /);
    assert.ok(handlers.length > 0, route.path);
    // A route may wrap the gate in a local helper (e.g. same-origin + session).
    const localGateNames = [
      ...preamble.matchAll(/async function (\w+)\([^)]*\)\s*\{[\s\S]*?requirePartnerApiSession\(/g),
    ].map((match) => match[1]);
    for (const handler of handlers) {
      const gateIndex = Math.min(
        ...["requirePartnerApiSession", ...localGateNames]
          .map((name) => handler.indexOf(`${name}(`))
          .filter((index) => index >= 0),
      );
      assert.ok(
        Number.isFinite(gateIndex),
        `${route.path}: ${handler.slice(0, 12)} must use the gate`,
      );
      for (const bodyReader of [
        "readRouteJsonBodyWithinLimit",
        "readPartnerPortalJsonBody",
        "parseNotificationIds(",
      ]) {
        const readerIndex = handler.indexOf(bodyReader);
        assert.ok(
          readerIndex < 0 || gateIndex < readerIndex,
          `${route.path}: session gate must run before ${bodyReader}`,
        );
      }
    }

    const allowsPendingChange = /allowPasswordChangeRequired:\s*true/.test(route.source);
    assert.equal(
      allowsPendingChange,
      PASSWORD_CHANGE_PENDING_ALLOWED.has(route.path),
      `${route.path}: forced password change exception must be listed`,
    );
  }
});
