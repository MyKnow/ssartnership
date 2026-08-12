import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const pageSource = readFileSync(
  new URL("../src/app/(site)/wallet/verify/[token]/page.tsx", import.meta.url),
  "utf8",
);
const avatarRouteSource = readFileSync(
  new URL("../src/app/api/wallet/apple/avatar/[token]/route.ts", import.meta.url),
  "utf8",
);

describe("apple wallet verify route contract", () => {
  it("marks the public verification page as dynamic and non-indexable without analytics", () => {
    assert.match(pageSource, /unstable_noStore as noStore/);
    assert.match(pageSource, /noStore\(\)/);
    assert.match(pageSource, /index:\s*false/);
    assert.match(pageSource, /follow:\s*false/);
    assert.match(pageSource, /referrer: "no-referrer"/);
    assert.doesNotMatch(pageSource, /AnalyticsEventOnMount/);
    assert.doesNotMatch(pageSource, /dedupeKey=/);
    assert.match(pageSource, /eventName: "wallet_pass_verify"/);
    assert.match(pageSource, /path: "\/wallet\/verify\/\[token\]"/);
    assert.doesNotMatch(pageSource, /targetId:/);
  });

  it("reuses the wallet verification helper and the wallet avatar route", () => {
    assert.match(pageSource, /resolveWalletVerifyState\(rawToken\)/);
    assert.match(
      pageSource,
      /avatarSrc=\{`\/api\/wallet\/apple\/avatar\/\$\{encodeURIComponent\(rawToken\)\}`\}/,
    );
    assert.match(pageSource, /CertificationCardFrame/);
  });

  it("keeps avatar responses private and revalidates the live token before streaming", () => {
    const jsonErrorSource = avatarRouteSource.slice(
      avatarRouteSource.indexOf("function jsonError"),
      avatarRouteSource.indexOf("export async function GET"),
    );
    const mockRedirectSource = avatarRouteSource.slice(
      avatarRouteSource.indexOf("if (isMockDataSource())"),
      avatarRouteSource.indexOf("const image ="),
    );
    const successResponseSource = avatarRouteSource.slice(
      avatarRouteSource.indexOf("return new NextResponse(body"),
    );

    assert.match(avatarRouteSource, /resolveWalletVerifyState\(rawToken\)/);
    assert.match(avatarRouteSource, /getActiveMemberProfileImage\(state\.member\.id/);
    assert.match(
      avatarRouteSource,
      /const PRIVATE_AVATAR_RESPONSE_HEADERS = \{[\s\S]*"cache-control": "private, no-store"[\s\S]*"x-content-type-options": "nosniff"[\s\S]*"x-robots-tag": "noindex, nofollow"[\s\S]*\} as const;/,
    );
    assert.match(
      jsonErrorSource,
      /headers: PRIVATE_AVATAR_RESPONSE_HEADERS/,
    );
    assert.match(
      mockRedirectSource,
      /NextResponse\.redirect\([\s\S]*headers: PRIVATE_AVATAR_RESPONSE_HEADERS/,
    );
    assert.match(
      successResponseSource,
      /return new NextResponse\(body,[\s\S]*\.\.\.PRIVATE_AVATAR_RESPONSE_HEADERS/,
    );
    assert.match(avatarRouteSource, /decodeWalletPassTokenSegment\(token\)/);
  });
});
