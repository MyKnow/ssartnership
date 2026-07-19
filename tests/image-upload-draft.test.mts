import assert from "node:assert/strict";
import test from "node:test";

const modulePromise = import("../src/lib/image-upload/draft.ts");

test("이미지 Draft는 만료된 레코드를 복원하지 않고 업로드 ID를 보존한다", async () => {
  const { createImageUploadDraft, readImageUploadDraft } = await modulePromise;
  const now = new Date("2026-07-18T12:00:00.000Z").getTime();
  const draft = createImageUploadDraft({
    formKey: "partner-registration",
    values: { brandName: "카페 싸피", contactEmail: "partner@example.com" },
    manifests: [{ uploadId: "03f5459b-dfee-4558-907a-509a396312f5", role: "gallery", order: 0 }],
    now,
  });

  assert.equal(readImageUploadDraft(draft, now + 60_000)?.values.brandName, "카페 싸피");
  assert.equal(readImageUploadDraft(draft, now + 60_000)?.manifests[0]?.uploadId, "03f5459b-dfee-4558-907a-509a396312f5");
  assert.equal(readImageUploadDraft(draft, now + 25 * 60 * 60 * 1000), null);
});

test("이미지 Draft는 비밀번호와 인증서 원본 관련 값을 저장하지 않는다", async () => {
  const { createImageUploadDraft } = await modulePromise;
  const draft = createImageUploadDraft({
    formKey: "partner-registration",
    values: {
      brandName: "카페 싸피",
      password: "never-store",
      certificateFileName: "certificate.pdf",
      accessToken: "never-store",
    },
    manifests: [],
  });

  assert.deepEqual(draft.values, { brandName: "카페 싸피" });
});

test("이미지 Draft는 다중 선택값을 보존하되 민감한 선택값은 제외한다", async () => {
  const { createImageUploadDraft } = await modulePromise;
  const draft = createImageUploadDraft({
    formKey: "partner-registration",
    values: {
      campusSlugs: ["seoul", "daejeon"],
      appliesTo: ["student", "graduate"],
      certificateConsent: true,
    },
    manifests: [],
  });

  assert.deepEqual(draft.values, {
    campusSlugs: ["seoul", "daejeon"],
    appliesTo: ["student", "graduate"],
  });
});

test("이미지 Draft 제출 키는 24시간 동안 같은 폼의 재시도 ID를 보존한다", async () => {
  const {
    createImageUploadSubmissionKey,
    readImageUploadSubmissionKey,
  } = await modulePromise;
  const now = new Date("2026-07-18T12:00:00.000Z").getTime();
  const key = createImageUploadSubmissionKey({
    formKey: "partner-registration-public",
    id: "03f5459b-dfee-4558-907a-509a396312f5",
    now,
  });

  assert.equal(
    readImageUploadSubmissionKey(key, now + 60_000)?.id,
    "03f5459b-dfee-4558-907a-509a396312f5",
  );
  assert.equal(readImageUploadSubmissionKey(key, now + 25 * 60 * 60 * 1000), null);
});
