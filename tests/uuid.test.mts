import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

import { isUuid, isUuidFormat, normalizeUuidList } from "@/lib/uuid";

test("isUuid accepts canonical UUID values", () => {
  assert.equal(isUuid("d46d0f71-fb92-4a73-b0b6-40c44e5e18d6"), true);
  assert.equal(isUuid(" D46D0F71-FB92-4A73-B0B6-40C44E5E18D6 "), true);
});

test("isUuid rejects public mock slugs before Supabase queries", () => {
  assert.equal(isUuid("health-001"), false);
  assert.equal(isUuid("mock-partner-service-cafe-ssafy-yeoksam"), false);
  assert.equal(isUuid(""), false);
});

test("isUuid rejects loose 36-character identifier shapes", () => {
  assert.equal(isUuid("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"), false);
  assert.equal(isUuid("------------------------------------"), false);
});

test("normalizeUuidList trims, dedupes, and drops non-UUID values", () => {
  assert.deepEqual(
    normalizeUuidList([
      " health-001 ",
      "d46d0f71-fb92-4a73-b0b6-40c44e5e18d6",
      "D46D0F71-FB92-4A73-B0B6-40C44E5E18D6",
      "00000000-0000-4000-8000-000000000000",
    ]),
    [
      "d46d0f71-fb92-4a73-b0b6-40c44e5e18d6",
      "00000000-0000-4000-8000-000000000000",
    ],
  );
});

test("isUuid는 RFC 9562 버전 1~8과 variant 10xx만 허용한다", () => {
  // v4 (gen_random_uuid, crypto.randomUUID)
  assert.equal(isUuid("d46d0f71-fb92-4a73-b0b6-40c44e5e18d6"), true);
  // v7 (Postgres 18 uuidv7)
  assert.equal(isUuid("01928c3e-6b1a-7cc2-9f1e-3c9d2a7b5e10"), true);
  // v1, v6, v8
  assert.equal(isUuid("c232ab00-9414-11ec-b3c8-9f6bdeced846"), true);
  assert.equal(isUuid("1ec9414c-232a-6b00-b3c8-9f6bdeced846"), true);
  assert.equal(isUuid("320c3d4d-cc00-875b-8ec9-32d5f69181c0"), true);

  // version 0·9, nil/max UUID
  assert.equal(isUuid("d46d0f71-fb92-0a73-b0b6-40c44e5e18d6"), false);
  assert.equal(isUuid("d46d0f71-fb92-9a73-b0b6-40c44e5e18d6"), false);
  assert.equal(isUuid("00000000-0000-0000-0000-000000000000"), false);
  assert.equal(isUuid("ffffffff-ffff-ffff-ffff-ffffffffffff"), false);
  // variant 0xxx·110x
  assert.equal(isUuid("d46d0f71-fb92-4a73-70b6-40c44e5e18d6"), false);
  assert.equal(isUuid("d46d0f71-fb92-4a73-c0b6-40c44e5e18d6"), false);
});

test("isUuidFormat은 공백을 허용하지 않고 비문자열을 거부한다", () => {
  assert.equal(isUuidFormat("d46d0f71-fb92-4a73-b0b6-40c44e5e18d6"), true);
  assert.equal(isUuidFormat("D46D0F71-FB92-4A73-B0B6-40C44E5E18D6"), true);
  assert.equal(isUuidFormat(" d46d0f71-fb92-4a73-b0b6-40c44e5e18d6"), false);
  assert.equal(isUuidFormat("d46d0f71-fb92-4a73-b0b6-40c44e5e18d6\n"), false);
  assert.equal(isUuidFormat(null), false);
  assert.equal(isUuidFormat(undefined), false);
  assert.equal(isUuidFormat(42), false);
});

function listSourceFiles(directory: URL): URL[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const child = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, directory);
    if (entry.isDirectory()) return listSourceFiles(child);
    return /\.(?:ts|tsx)$/u.test(entry.name) && !/\.stories\.tsx$/u.test(entry.name) ? [child] : [];
  });
}

test("버전 검사 UUID 정규식은 @/lib/uuid 밖에서 다시 정의하지 않는다", () => {
  const sourceRoot = new URL("../src/", import.meta.url);
  const sharedModule = new URL("lib/uuid.ts", sourceRoot).href;
  const versionedUuidLiteral = /\[0-9a-f\]\{8\}-\[0-9a-f\]\{4\}-\[1-[0-9]\]/u;
  const offenders = listSourceFiles(sourceRoot)
    .filter((file) => file.href !== sharedModule)
    .filter((file) => versionedUuidLiteral.test(readFileSync(file, "utf8")))
    .map((file) => file.href.slice(sourceRoot.href.length));

  assert.deepEqual(offenders, []);
});
