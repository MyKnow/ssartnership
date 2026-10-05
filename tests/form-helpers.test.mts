import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
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

function listSourceFiles(directory: URL): URL[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const child = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, directory);
    if (entry.isDirectory()) return listSourceFiles(child);
    return /\.(?:ts|tsx)$/u.test(entry.name) && !/\.stories\.tsx$/u.test(entry.name) ? [child] : [];
  });
}

test("server action은 FormData 문자열 읽기 helper를 로컬로 다시 만들지 않고 readString을 쓴다", () => {
  const sourceRoot = new URL("../src/", import.meta.url);
  const localReader =
    /(?:function \w+|const \w+ = )\(\s*formData: FormData,\s*(?:key|name|field): string\s*\)(?:\s*:\s*string)?\s*(?:=>\s*|\{\s*return\s+)String\(formData\.get\((?:key|name|field)\)/u;
  const offenders = listSourceFiles(sourceRoot)
    .map((file) => ({
      relative: decodeURIComponent(file.href.slice(sourceRoot.href.length)),
      source: readFileSync(file, "utf8"),
    }))
    .filter(({ relative, source }) => relative !== "lib/form-data.ts" && localReader.test(source))
    .map(({ relative }) => relative);

  assert.deepEqual(offenders, []);
});
