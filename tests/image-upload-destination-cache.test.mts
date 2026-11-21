import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  PRIVATE_IMAGE_OBJECT_CACHE_CONTROL,
  PUBLIC_IMAGE_OBJECT_CACHE_CONTROL,
  resolveImageDestinationCacheControl,
} from "../src/lib/image-upload/repository.ts";

test("최종 이미지 객체 캐시는 명시값이 없으면 공개 여부로 정한다", () => {
  assert.equal(PUBLIC_IMAGE_OBJECT_CACHE_CONTROL, "31536000");
  assert.equal(PRIVATE_IMAGE_OBJECT_CACHE_CONTROL, "private, no-store");
  assert.equal(resolveImageDestinationCacheControl({ isPublic: true }), "31536000");
  // 비공개 목적지가 cacheControl을 빠뜨려도 1년 공개 캐시로 저장되지 않는다.
  assert.equal(resolveImageDestinationCacheControl({ isPublic: false }), "private, no-store");
  assert.equal(
    resolveImageDestinationCacheControl({ isPublic: true, cacheControl: "3600" }),
    "3600",
  );
});

test("업로드 저장소는 처리본·최종본 캐시 값을 공용 규칙에서 가져온다", async () => {
  const source = await readFile(
    new URL("../src/lib/image-upload/repository.supabase.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /cacheControl: resolveImageDestinationCacheControl\(input\.destination\)/);
  assert.match(source, /cacheControl: PRIVATE_IMAGE_OBJECT_CACHE_CONTROL/);
  assert.doesNotMatch(source, /"31536000"/);
});
