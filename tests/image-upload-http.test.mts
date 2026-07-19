import assert from "node:assert/strict";
import test from "node:test";

const modulePromise = import("../src/lib/image-upload/http.ts");

test("공통 이미지 업로드 sign 요청은 역할별 정책과 파일 메타데이터를 함께 검증한다", async () => {
  const { parseImageUploadSignRequest } = await modulePromise;

  assert.deepEqual(
    parseImageUploadSignRequest({
      purpose: "partner",
      actorMode: "admin",
      uploads: [{
        clientId: "thumbnail-1",
        role: "thumbnail",
        fileName: "brand.heic",
        contentType: "image/heic",
        size: 1024,
      }],
    }),
    {
      purpose: "partner",
      actorMode: "admin",
      uploads: [{
        clientId: "thumbnail-1",
        role: "thumbnail",
        fileName: "brand.heic",
        contentType: "image/heic",
        size: 1024,
      }],
    },
  );

  assert.equal(
    parseImageUploadSignRequest({
      purpose: "partner",
      uploads: [{
        clientId: "thumbnail-1",
        role: "unknown",
        fileName: "brand.webp",
        contentType: "image/webp",
        size: 1024,
      }],
    }),
    null,
  );
});

test("공통 이미지 업로드 complete 요청은 중복되거나 비정상인 업로드 ID를 거부한다", async () => {
  const { parseImageUploadCompleteRequest } = await modulePromise;
  const uploadId = "03f5459b-dfee-4558-907a-509a396312f5";

  assert.deepEqual(
    parseImageUploadCompleteRequest({ purpose: "review", uploadIds: [uploadId] }),
    { purpose: "review", uploadIds: [uploadId] },
  );
  assert.equal(
    parseImageUploadCompleteRequest({ purpose: "review", uploadIds: [uploadId, uploadId] }),
    null,
  );
  assert.equal(
    parseImageUploadCompleteRequest({ purpose: "review", uploadIds: ["not-an-id"] }),
    null,
  );
});

test("신규 가입 프로필 업로드는 signup actor와 profile 역할을 함께 요구한다", async () => {
  const { parseImageUploadSignRequest, parseImageUploadCompleteRequest } = await modulePromise;
  const upload = {
    clientId: "mattermost-profile",
    role: "profile",
    fileName: "mattermost.webp",
    contentType: "image/webp",
    size: 1024,
  };
  const uploadId = "03f5459b-dfee-4558-907a-509a396312f5";

  assert.deepEqual(
    parseImageUploadSignRequest({
      purpose: "member-signup-profile",
      actorMode: "signup",
      uploads: [upload],
    }),
    {
      purpose: "member-signup-profile",
      actorMode: "signup",
      uploads: [upload],
    },
  );
  assert.deepEqual(
    parseImageUploadCompleteRequest({
      purpose: "member-signup-profile",
      actorMode: "signup",
      uploadIds: [uploadId],
    }),
    {
      purpose: "member-signup-profile",
      actorMode: "signup",
      uploadIds: [uploadId],
    },
  );
  assert.equal(
    parseImageUploadSignRequest({
      purpose: "member-signup-profile",
      actorMode: "guest",
      uploads: [upload],
    }),
    null,
  );
  assert.equal(
    parseImageUploadCompleteRequest({
      purpose: "review",
      actorMode: "signup",
      uploadIds: [uploadId],
    }),
    null,
  );
});
