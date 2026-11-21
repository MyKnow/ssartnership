import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const modulePromise = import("../src/lib/partner-form-request-size.ts");

function createFormData(fileSize = 0) {
  const formData = new FormData();
  formData.set("name", "카페 싸피 역삼본점");
  formData.set("detailDescription", "제휴처 설명입니다.");
  if (fileSize > 0) {
    formData.append(
      "thumbnailFile",
      new File([new Uint8Array(fileSize)], "thumbnail.webp", {
        type: "image/webp",
      }),
    );
  }
  return formData;
}

test("partner form request size excludes image binaries because they use direct staging uploads", async () => {
  const {
    PARTNER_FORM_MULTIPART_SAFETY_BUFFER_BYTES,
    estimatePartnerFormRequestBytes,
  } = await modulePromise;

  const formData = createFormData(1024);
  const estimatedBytes = estimatePartnerFormRequestBytes(formData);

  const withoutImage = estimatePartnerFormRequestBytes(createFormData());

  assert.equal(estimatedBytes, withoutImage);
  assert.ok(estimatedBytes > PARTNER_FORM_MULTIPART_SAFETY_BUFFER_BYTES);
});

test("partner form request is accepted below the safe server-action limit", async () => {
  const {
    PARTNER_FORM_SAFE_REQUEST_BODY_BYTES,
    isPartnerFormRequestWithinSafeLimit,
  } = await modulePromise;

  assert.equal(
    isPartnerFormRequestWithinSafeLimit(
      createFormData(PARTNER_FORM_SAFE_REQUEST_BODY_BYTES - 200_000),
    ),
    true,
  );
});

test("partner form image size no longer drives the Server Action request guard", async () => {
  const {
    PARTNER_FORM_SAFE_REQUEST_BODY_BYTES,
    isPartnerFormRequestWithinSafeLimit,
  } = await modulePromise;

  assert.equal(
    isPartnerFormRequestWithinSafeLimit(
      createFormData(PARTNER_FORM_SAFE_REQUEST_BODY_BYTES),
    ),
    true,
  );
});

test("partner form 한도는 Next Server Action 한도와 같고 엣지 프록시 한도보다 작다", async () => {
  const { PARTNER_FORM_SERVER_ACTION_BODY_LIMIT_BYTES } = await modulePromise;
  const nextConfig = readFileSync(new URL("../next.config.ts", import.meta.url), "utf8");
  const edge = readFileSync(new URL("../deploy/pve/edge.Caddyfile", import.meta.url), "utf8");
  const serverActionLimit = /bodySizeLimit:\s*"(\d+)mb"/u.exec(nextConfig)?.[1];
  const edgeLimits = [...edge.matchAll(/max_size (\d+)MB/gu)].map((match) => Number(match[1]));

  assert.equal(Number(serverActionLimit) * 1024 * 1024, PARTNER_FORM_SERVER_ACTION_BODY_LIMIT_BYTES);
  assert.ok(edgeLimits.length > 0);
  assert.ok(Math.max(...edgeLimits) * 1024 * 1024 > PARTNER_FORM_SERVER_ACTION_BODY_LIMIT_BYTES);
  assert.doesNotMatch(
    readFileSync(new URL("../src/lib/partner-form-request-size.ts", import.meta.url), "utf8"),
    /Vercel/u,
  );
});
