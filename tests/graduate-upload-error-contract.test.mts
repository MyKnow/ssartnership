import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  createGraduateVerificationSignedUpload,
  GraduateUploadValidationError,
} from "../src/lib/graduate-verification-storage.ts";

const routeSource = readFileSync(
  new URL("../src/app/api/graduate-verification/uploads/sign/route.ts", import.meta.url),
  "utf8",
);

test("수료생 업로드 검증 오류는 명시적인 타입으로 구분한다", async () => {
  await assert.rejects(
    createGraduateVerificationSignedUpload({
      challengeId: "challenge-id",
      kind: "certificate",
      contentType: "text/plain",
      size: 1,
    }),
    (error: unknown) =>
      error instanceof GraduateUploadValidationError
      && error.message === "업로드 파일 형식을 확인해 주세요.",
  );
});

test("수료생 업로드 서명 API는 검증 오류만 노출하고 운영 오류는 일반화한다", () => {
  assert.match(routeSource, /error instanceof GraduateUploadValidationError/);
  assert.match(routeSource, /\{ status: 400 \}/);
  assert.match(routeSource, /\[graduate-verification\/upload-sign\] failed/);
  assert.match(
    routeSource,
    /업로드 URL을 발급하지 못했습니다\. 잠시 후 다시 시도해 주세요\./,
  );
  assert.match(routeSource, /\{ status: 503 \}/);
  assert.doesNotMatch(
    routeSource,
    /message:\s*error instanceof Error\s*\?\s*error\.message/,
  );
});
