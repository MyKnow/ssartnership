import assert from "node:assert/strict";
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
