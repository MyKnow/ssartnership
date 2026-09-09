import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);

test("partner media attachment paths track every new URL before persistence", async () => {
  const sources = await Promise.all(
    [
      "src/lib/partner-registration-submit.server.ts",
      "src/app/partner/services/[partnerId]/request/_actions/media.ts",
      "src/app/admin/(protected)/_actions/partner-support/media.ts",
    ].map((path) => readFile(new URL(path, root), "utf8")),
  );

  for (const source of sources) {
    assert.match(source, /uploadedUrls\.push\(attached\.url\)/);
    assert.match(source, /rethrowAfterPartnerMediaCleanup\(\{/);
  }
});

test("partner media cleanup preserves both the mutation and cleanup failures", async () => {
  const storage = await readFile(
    new URL("src/lib/partner-media-storage.ts", root),
    "utf8",
  );

  assert.match(storage, /cleanupPartnerMediaOrThrow/);
  assert.match(storage, /partner_media_cleanup_failed/);
  assert.match(storage, /cause: \{ originalError: input\.originalError, cleanupError \}/);
  assert.match(storage, /rethrowAfterPartnerMediaCleanup/);
});

test("created registration rollback attempts storage and row cleanup together", async () => {
  const source = await readFile(
    new URL("src/lib/partner-registration-submit.server.ts", root),
    "utf8",
  );

  assert.match(source, /rollbackCreatedPartnerRegistrationRequest/);
  assert.match(source, /Promise\.allSettled\(\[/);
  assert.match(source, /partner_registration_cleanup_failed/);
  assert.doesNotMatch(
    source,
    /deletePartnerMediaUrls\(media\.uploadedUrls\)\.catch\(\(\) => undefined\)/,
  );
});
