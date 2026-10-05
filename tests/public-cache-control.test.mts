import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  PUBLIC_IMAGE_PROXY_CACHE_CONTROL,
  RSS_FEED_CACHE_CONTROL,
  hasSharedCacheOnlyDirective,
} from "../src/lib/public-cache-control.ts";

const root = new URL("..", import.meta.url);

function maxAgeSeconds(cacheControl: string) {
  const match = cacheControl.match(/\bmax-age=(\d+)\b/);
  assert.ok(match, cacheControl);
  return Number(match[1]);
}

test("공개 캐시 정책은 공유 캐시 없는 자체 호스팅 엣지에서 실효가 있는 max-age만 쓴다", () => {
  for (const value of [PUBLIC_IMAGE_PROXY_CACHE_CONTROL, RSS_FEED_CACHE_CONTROL]) {
    assert.equal(hasSharedCacheOnlyDirective(value), false, value);
    assert.match(value, /^public, max-age=\d+$/);
  }
  // 옵티마이저가 원본 max-age를 TTL로 쓰므로 5분 간격 재조회로 돌아가지 않게 하루 이상을 유지한다.
  assert.ok(maxAgeSeconds(PUBLIC_IMAGE_PROXY_CACHE_CONTROL) >= 86_400);
  assert.equal(maxAgeSeconds(RSS_FEED_CACHE_CONTROL), 3_600);
});

test("공유 캐시 전용 지시어 판정은 대소문자와 위치에 무관하다", () => {
  assert.equal(hasSharedCacheOnlyDirective("public, max-age=0, s-maxage=3600"), true);
  assert.equal(hasSharedCacheOnlyDirective("public, Stale-While-Revalidate=60"), true);
  assert.equal(hasSharedCacheOnlyDirective("max-age=60, stale-if-error=600"), true);
  assert.equal(hasSharedCacheOnlyDirective("private, no-cache"), false);
});

test("이미지 프록시와 RSS 라우트는 공용 정책 상수를 쓰고 s-maxage를 직접 쓰지 않는다", async () => {
  const [imageRoute, rssRoute] = await Promise.all([
    readFile(new URL("src/app/api/image/route.ts", root), "utf8"),
    readFile(new URL("src/app/rss.xml/route.ts", root), "utf8"),
  ]);

  assert.match(imageRoute, /"cache-control": PUBLIC_IMAGE_PROXY_CACHE_CONTROL/);
  assert.match(rssRoute, /"Cache-Control": RSS_FEED_CACHE_CONTROL/);
  assert.match(rssRoute, /export const dynamic = "force-dynamic"/);
  for (const source of [imageRoute, rssRoute]) {
    assert.equal(hasSharedCacheOnlyDirective(source), false);
  }
});
