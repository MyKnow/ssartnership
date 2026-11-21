import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  NOTIFICATION_TEMPLATE_SAMPLE_ERROR,
  getNotificationTemplateSampleValues,
  renderNotificationTemplateSample,
} from "../src/lib/notification-templates/sample.ts";

function readSource(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const variables = [
  { name: "title", label: "제목", example: "신규 제휴 안내" },
  { name: "partnerName", label: "제휴처" },
];

test("템플릿 샘플은 예시 값이 없으면 라벨로 채운다", () => {
  assert.deepEqual(getNotificationTemplateSampleValues(variables), {
    title: "신규 제휴 안내",
    partnerName: "제휴처 예시",
  });
  assert.equal(
    renderNotificationTemplateSample("{title} - {partnerName}", variables),
    "신규 제휴 안내 - 제휴처 예시",
  );
  assert.match(NOTIFICATION_TEMPLATE_SAMPLE_ERROR, /필수 변수 계약/);
});

test("알림 템플릿 편집기는 이메일 미리보기 라이브러리를 정적으로 불러오지 않는다", () => {
  const manager = readSource("src/components/admin/AdminNotificationTemplateManager.tsx");
  assert.doesNotMatch(manager, /@\/lib\/email-content/);
  assert.match(
    manager,
    /const AdminEmailPreview = dynamic\(\s*\(\) => import\("@\/components\/admin\/AdminEmailPreview"\)/,
  );
  assert.match(manager, /detail\.channel === "email" \? \(\s*<AdminEmailPreview/);

  const preview = readSource("src/components/admin/AdminEmailPreview.tsx");
  assert.match(preview, /^"use client";/);
  assert.match(preview, /import \{ renderEmailBody \} from "@\/lib\/email-content"/);
  assert.match(preview, /이메일 HTML 미리보기/);
  assert.match(preview, /일반 텍스트 fallback/);
});
