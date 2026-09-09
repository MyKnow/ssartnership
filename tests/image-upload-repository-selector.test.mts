import assert from "node:assert/strict";
import test from "node:test";

import {
  createImageUploadRepository,
  getSignedImageUploadHeaders,
  ImageUploadRepositoryUnavailableError,
  selectImageUploadDataAccess,
} from "../src/lib/image-upload/repository.server.ts";
import type { ImageUploadRepository } from "../src/lib/image-upload/repository.ts";

const fullEnvironment = {
  NEXT_PUBLIC_DATA_SOURCE: "supabase",
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_ANON_KEY: "anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
};

test("이미지 업로드는 완전한 Supabase 자격증명에서만 활성화된다", () => {
  const supabaseRepository = {} as ImageUploadRepository;
  assert.equal(selectImageUploadDataAccess(fullEnvironment).source, "supabase");
  assert.equal(
    createImageUploadRepository(fullEnvironment, () => supabaseRepository),
    supabaseRepository,
  );
  assert.deepEqual(getSignedImageUploadHeaders(fullEnvironment), {
    apikey: "anon-key",
    Authorization: "Bearer anon-key",
  });
});

for (const environment of [
  { NEXT_PUBLIC_DATA_SOURCE: "mock" },
  {
    NEXT_PUBLIC_DATA_SOURCE: "supabase",
    SUPABASE_URL: "https://project.supabase.co",
    SUPABASE_ANON_KEY: "anon-key",
  },
  {
    NEXT_PUBLIC_DATA_SOURCE: "supabase",
    SUPABASE_URL: "https://project.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  },
]) {
  test(`이미지 업로드 불가 환경을 명시적으로 거부한다: ${JSON.stringify(environment)}`, async () => {
    const repository = createImageUploadRepository(environment);
    await assert.rejects(
      repository.expireStale(),
      (error: unknown) => error instanceof ImageUploadRepositoryUnavailableError,
    );
    assert.throws(
      () => getSignedImageUploadHeaders(environment),
      ImageUploadRepositoryUnavailableError,
    );
  });
}

test("명시적 mock은 지원하지 않는 이미지 업로드 capability로 표시한다", () => {
  assert.deepEqual(
    selectImageUploadDataAccess({ NEXT_PUBLIC_DATA_SOURCE: "mock" }),
    {
      capability: "admin",
      source: "unavailable",
      reason: "unsupported_capability",
    },
  );
});
