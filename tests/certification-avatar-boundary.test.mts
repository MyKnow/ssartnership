import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const certificationPagePath = new URL(
  "../src/app/(site)/certification/page.tsx",
  import.meta.url,
);
const certificationViewPath = new URL(
  "../src/components/certification/CertificationView.tsx",
  import.meta.url,
);
const memberAvatarRoutePath = new URL(
  "../src/app/api/mm/avatar/route.ts",
  import.meta.url,
);

test("certification page does not pass avatar base64 through the client boundary", async () => {
  const [pageSource, viewSource] = await Promise.all([
    readFile(certificationPagePath, "utf8"),
    readFile(certificationViewPath, "utf8"),
  ]);

  assert.doesNotMatch(pageSource, /avatar_base64/);
  assert.doesNotMatch(viewSource, /avatar_base64/);
  assert.doesNotMatch(viewSource, /base64,/);
  assert.match(pageSource, /\/api\/mm\/avatar/);
});

test("member avatar route keeps base64 handling server-side", async () => {
  const routeSource = await readFile(memberAvatarRoutePath, "utf8");

  assert.match(routeSource, /getSignedUserSession/);
  assert.match(routeSource, /avatar_base64/);
  assert.match(routeSource, /content-type/);
  assert.match(routeSource, /cache-control/);
});
