import assert from "node:assert/strict";
import test from "node:test";

import { firstInvalidField, hasFieldErrors } from "@/lib/field-errors";
import { readRawString, readString } from "@/lib/form-data";

test("hasFieldErrors는 비어 있지 않은 오류 문구가 있을 때만 true다", () => {
  assert.equal(hasFieldErrors({}), false);
  assert.equal(hasFieldErrors({ title: undefined }), false);
  assert.equal(hasFieldErrors({ title: "" }), false);
  assert.equal(hasFieldErrors({ title: "제목을 입력해 주세요." }), true);
});

test("firstInvalidField는 화면 필드 순서에서 첫 오류 필드를 고른다", () => {
  const order = ["name", "email", "message"] as const;
  assert.equal(firstInvalidField({}, order), null);
  assert.equal(firstInvalidField({ message: "내용", email: "이메일" }, order), "email");
  assert.equal(firstInvalidField({ message: "내용", name: "" }, order), "message");
});

test("readString은 문자열만 trim해서 읽고 파일·누락 키는 빈 문자열이다", () => {
  const formData = new FormData();
  formData.set("title", "  제휴 혜택  ");
  formData.set("password", "  keep spaces  ");
  formData.set("upload", new Blob(["x"]), "photo.png");

  assert.equal(readString(formData, "title"), "제휴 혜택");
  assert.equal(readString(formData, "missing"), "");
  assert.equal(readString(formData, "upload"), "");
  assert.equal(readRawString(formData, "password"), "  keep spaces  ");
  assert.equal(readRawString(formData, "upload"), "");
});
