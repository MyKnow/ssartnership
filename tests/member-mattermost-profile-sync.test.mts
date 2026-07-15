import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { decodeMemberProfileImageData } from "@/lib/member-profile-images";

test("Mattermost data URI는 서버 변환용 바이트와 콘텐츠 타입으로만 해석한다", () => {
  const decoded = decodeMemberProfileImageData(
    "data:image/png;base64,aGVsbG8=",
    null,
  );

  assert.equal(decoded?.contentType, "image/png");
  assert.equal(decoded?.source.toString("utf8"), "hello");
});

test("허용되지 않은 형식과 손상된 base64는 프로필 이미지로 사용하지 않는다", () => {
  assert.equal(decodeMemberProfileImageData("data:image/svg+xml;base64,PHN2Zy8+", null), null);
  assert.equal(decodeMemberProfileImageData("not base64", "image/png"), null);
});

test("Mattermost 사진 활성화는 이미지 원장의 review_reason 컬럼을 사용한다", async () => {
  const source = await readFile(
    new URL("../src/lib/member-profile-images.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /status: "approved",[\s\S]*review_reason: null/);
  assert.doesNotMatch(source, /status: "approved",[\s\S]*review_note: null/);
});
