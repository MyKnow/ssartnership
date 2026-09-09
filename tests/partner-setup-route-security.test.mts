import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const routeSourcePromise = readFile(
  new URL("../src/app/api/partner/setup/[token]/route.ts", import.meta.url),
  "utf8",
);

test("파트너 초기 설정 JSON 응답은 동적 private 응답 helper로 통일한다", async () => {
  const source = await routeSourcePromise;

  assert.match(source, /export const dynamic = "force-dynamic";/);
  assert.match(
    source,
    /const PRIVATE_PARTNER_SETUP_JSON_HEADERS = \{[\s\S]*"Cache-Control": "private, no-store"[\s\S]*"X-Content-Type-Options": "nosniff"[\s\S]*\} as const;/,
  );
  assert.match(
    source,
    /NextResponse\.json\(body, \{[\s\S]*headers: PRIVATE_PARTNER_SETUP_JSON_HEADERS/,
  );

  assert.equal(
    (source.match(/NextResponse\.json\(/g) ?? []).length,
    1,
    "공용 helper 바깥에서 보안 헤더 없는 JSON 응답을 만들면 안 됩니다.",
  );
  assert.equal(
    (source.match(/return partnerSetupJson\(/g) ?? []).length,
    7,
    "GET 성공·실패와 POST 성공·실패 응답은 모두 공용 helper를 사용해야 합니다.",
  );
});

test("파트너 초기 설정 GET은 전달받은 토큰 조회와 두 private JSON 분기를 유지한다", async () => {
  const source = await routeSourcePromise;
  const getHandler = source.slice(
    source.indexOf("export async function GET"),
    source.indexOf("export async function POST"),
  );

  assert.match(getHandler, /getPartnerPortalSetupContext\(token\)/);
  assert.equal((getHandler.match(/return partnerSetupJson\(/g) ?? []).length, 2);
  assert.match(getHandler, /\{ error: "not_found" \}, \{ status: 404 \}/);
  assert.match(getHandler, /\{ ok: true, context: setupContext \}/);
});

test("파트너 초기 설정 POST는 same-origin 검사를 앞세우고 모든 JSON 분기를 helper로 반환한다", async () => {
  const source = await routeSourcePromise;
  const postHandler = source.slice(source.indexOf("export async function POST"));

  const originGuardIndex = postHandler.indexOf("isTrustedSameOriginRequest");
  const tokenReadIndex = postHandler.indexOf("const { token }");
  const bodyReadIndex = postHandler.indexOf("readPartnerPortalJsonBody");

  assert.ok(originGuardIndex >= 0);
  assert.ok(originGuardIndex < tokenReadIndex);
  assert.ok(originGuardIndex < bodyReadIndex);
  assert.equal((postHandler.match(/return partnerSetupJson\(/g) ?? []).length, 5);
  assert.doesNotMatch(postHandler, /return NextResponse\.json\(/);
  assert.match(postHandler, /\{ error: "forbidden" \}, \{ status: 403 \}/);
  assert.match(postHandler, /\{[\s\S]*error: "invalid_body"[\s\S]*status: 400/);
  assert.match(postHandler, /getPartnerPortalSetupErrorStatus\(error\.code\)/);
  assert.match(postHandler, /\{[\s\S]*error: "setup_failed"[\s\S]*status: 503/);
});
