import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const source = readFileSync(
  new URL("../src/app/api/wallet/apple/pass/route.ts", import.meta.url),
  "utf8",
);

describe("wallet apple member route contract", () => {
  it("serves member downloads as a private pkpass attachment", () => {
    assert.match(source, /export const runtime = "nodejs"/);
    assert.match(source, /getAppleWalletPassForMemberDownload\(/);
    assert.match(
      source,
      /getAppleWalletPassForMemberDownload\(\s*auth\.userId,\s*\)/,
    );
    assert.match(source, /"content-type": "application\/vnd\.apple\.pkpass"/);
    assert.match(source, /"content-disposition": `attachment; filename="\$\{PASS_FILE_NAME\}"`/);
    assert.match(source, /"cache-control": "private, no-store"/);
    assert.match(source, /"last-modified": getAppleWalletPassLastModified\(pass\)/);
    assert.match(source, /"x-content-type-options": "nosniff"/);
  });

  it("guards issue and revoke with same-origin json requests and signed sessions", () => {
    assert.match(source, /allowedContentTypes: \["application\/json"\]/);
    assert.match(source, /isTrustedSameOriginRequest\(request,/);
    assert.match(source, /const session = await getSignedUserSession\(\)/);
    assert.match(source, /return \{ response: jsonMessage\("로그인이 필요합니다\.", 401\) \}/);
  });

  it("validates request bodies with the wallet request schemas", () => {
    assert.match(source, /issueAppleWalletPassRequestSchema\.safeParse\(body\)/);
    assert.match(source, /revokeAppleWalletPassRequestSchema\.safeParse\(body\)/);
    assert.match(source, /"Apple Wallet 발급 요청을 확인해 주세요\."/);
    assert.match(source, /"Apple Wallet 폐기 요청을 확인해 주세요\."/);
  });

  it("calls the wallet pass service with the logged-in member id only", () => {
    assert.match(source, /issueAppleWalletMemberPass\(\{\s*memberId: auth\.userId,/);
    assert.match(source, /revokeAppleWalletMemberPass\(\{\s*memberId: auth\.userId,/);
    assert.match(source, /reason: parsed\.data\.reason/);
    assert.doesNotMatch(source, /console\.error/);
    assert.match(source, /downloadUrl: "\/api\/wallet\/apple\/pass"/);
    assert.doesNotMatch(source, /pass: result\.pass/);
    assert.doesNotMatch(source, /revision: result\.revision/);
  });

  it("records only safe, pass-id-free product events", () => {
    assert.match(source, /eventName: "wallet_pass_download"/);
    assert.match(source, /eventName: "wallet_pass_issue"/);
    assert.match(source, /eventName: "wallet_pass_revoke"/);
    assert.match(source, /targetType: "wallet_pass"/);
    assert.doesNotMatch(source, /targetId:/);
  });

  it("rate limits signing and mutation work per authenticated member", () => {
    assert.match(source, /consumeProductEventQuota\(\{/);
    assert.match(source, /sessionId: userId/);
    assert.match(source, /"wallet_pass_download"/);
    assert.match(source, /"wallet_pass_issue"/);
    assert.match(source, /"wallet_pass_revoke"/);
    assert.match(source, /잠시 후 다시 시도해 주세요/);
    assert.match(source, /429/);
  });

  it("maps wallet service failures to safe status codes", () => {
    assert.match(source, /case "wallet_not_configured"/);
    assert.match(source, /case "wallet_pass_build_failed"/);
    assert.match(source, /case "wallet_ineligible"/);
    assert.match(source, /case "wallet_pass_idempotency_conflict"/);
    assert.match(source, /case "wallet_pass_not_found"/);
    assert.match(source, /case "wallet_pass_revoked"/);
    assert.match(source, /case "wallet_pass_snapshot_invalid"/);
  });
});
