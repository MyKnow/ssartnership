import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("관리자 forbidden 상태는 빈 상태와 구분되는 경고 표면을 사용한다", async () => {
  const source = await readFile(
    new URL("../src/components/admin/AdminStatePanel.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /kind === "forbidden"/);
  assert.match(source, /tone="warning"/);
  assert.match(source, /role="status"/);
  assert.match(source, /aria-live="polite"/);
});

test("관리자 오류 상태는 스크린리더에 즉시 전달되는 alert live region을 사용한다", async () => {
  const source = await readFile(
    new URL("../src/components/admin/AdminStatePanel.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /kind === "error"/);
  assert.match(source, /role="alert"/);
  assert.match(source, /aria-live="assertive"/);
});

test("공통 InlineMessage는 danger 톤을 기본 alert로 승격할 수 있다", async () => {
  const source = await readFile(
    new URL("../src/components/ui/InlineMessage.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /role\?\: "alert" \| "status"/);
  assert.match(source, /tone === "danger" \? "alert"/);
  assert.match(source, /aria-live=\{ariaLive\}/);
});

test("권한 거부 화면은 브라우저 alert 대신 접근 가능한 인라인 상태를 제공한다", async () => {
  const source = await readFile(
    new URL(
      "../src/components/admin/AdminAccessDeniedNotice.tsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.doesNotMatch(source, /window\.alert/);
  assert.match(source, /role="alert"/);
  assert.match(source, /aria-labelledby/);
  assert.match(source, /aria-describedby/);
});
