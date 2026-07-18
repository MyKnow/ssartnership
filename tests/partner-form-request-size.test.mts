import assert from "node:assert/strict";
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
