import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

type ClientUuidModule = typeof import("../src/lib/client-uuid.ts");

const clientUuidModulePromise = import(
  new URL("../src/lib/client-uuid.ts", import.meta.url).href,
) as Promise<ClientUuidModule>;

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

test("client UUID prefers the native browser implementation", async () => {
  const { createClientUuid } = await clientUuidModulePromise;
  const expected = "03f5459b-dfee-4558-907a-509a396312f5";

  assert.equal(
    createClientUuid({ randomUUID: () => expected }),
    expected,
  );
});

test("client UUID remains RFC 4122 compatible without randomUUID", async () => {
  const { createClientUuid } = await clientUuidModulePromise;
  const result = createClientUuid({
    getRandomValues(values) {
      values.forEach((_, index) => {
        values[index] = index;
      });
      return values;
    },
  });

  assert.equal(result, "00010203-0405-4607-8809-0a0b0c0d0e0f");
  assert.match(result, UUID_V4_PATTERN);
  assert.match(createClientUuid(null), UUID_V4_PATTERN);
});

test("browser request and local-key surfaces share the safe UUID helper", async () => {
  const sources = await Promise.all(
    [
      "../src/components/partner/PartnerBenefitVerificationView.tsx",
      "../src/components/partner-reviews/PartnerReviewForm.tsx",
      "../src/components/review-media/shared.ts",
      "../src/lib/image-upload/draft.client.ts",
      "../src/components/certification/AppleWalletPassSection.tsx",
      "../src/components/admin/push-manager/useAdminPushManager.ts",
    ].map((sourcePath) =>
      readFile(new URL(sourcePath, import.meta.url), "utf8"),
    ),
  );

  for (const source of sources) {
    assert.match(source, /createClientUuid/);
    assert.doesNotMatch(source, /\bcrypto\.randomUUID/);
  }
});
