import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  hasStorybookTeardownTimeout,
  isDirectExecution,
  resolveStorybookTestExitCode,
} from "../scripts/run-storybook-tests.mjs";

test("Vitest 종료 timeout 진단은 성공 종료 코드여도 실패로 승격한다", () => {
  const output = [
    "Test Files 150 passed (150)",
    "close timed out after 10000ms",
    "Tests closed successfully but something prevents Vite server from exiting",
  ].join("\n");

  assert.equal(hasStorybookTeardownTimeout(output), true);
  assert.equal(
    resolveStorybookTestExitCode({ exitCode: 0, signal: null, output }),
    1,
  );
});

test("일반 timeout 문구와 정상 종료는 Storybook 종료 timeout으로 오인하지 않는다", () => {
  const output = "스토리의 안내 문구: timeout이 지나면 다시 시도하세요.";

  assert.equal(hasStorybookTeardownTimeout(output), false);
  assert.equal(
    resolveStorybookTestExitCode({ exitCode: 0, signal: null, output }),
    0,
  );
});

test("신호 종료와 기존 Vitest 실패 코드는 그대로 실패 처리한다", () => {
  assert.equal(
    resolveStorybookTestExitCode({ exitCode: null, signal: "SIGTERM", output: "" }),
    1,
  );
  assert.equal(
    resolveStorybookTestExitCode({ exitCode: 2, signal: null, output: "" }),
    2,
  );
});

test("실행 파일 판별은 file URL 변환을 사용한다", () => {
  const moduleUrl = new URL("../scripts/run-storybook-tests.mjs", import.meta.url)
    .href;
  const sameFilePath = fileURLToPath(moduleUrl);

  assert.equal(isDirectExecution(moduleUrl, sameFilePath), true);
  assert.equal(isDirectExecution(moduleUrl, "./scripts/other-script.mjs"), false);
});
