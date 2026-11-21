/**
 * 공개 응답의 Cache-Control 정책.
 *
 * 자체 호스팅 경로(edge Caddy → relay Caddy → 앱)에는 공유 HTTP 캐시가 없다. 그래서
 * `s-maxage`·`stale-while-revalidate`는 소비자가 없고, 실효가 있는 것은 브라우저와
 * Next 이미지 옵티마이저(원본 응답의 max-age를 캐시 TTL로 쓴다)가 읽는 `max-age`뿐이다.
 * 공유 캐시를 도입하면 이 모듈과 docs/performance/index.md를 함께 갱신한다.
 */

const HOUR_SECONDS = 60 * 60;
const DAY_SECONDS = 24 * HOUR_SECONDS;

/** `/api/image` 프록시: 옵티마이저·브라우저가 하루 동안 원본을 다시 받지 않는다. */
export const PUBLIC_IMAGE_PROXY_CACHE_CONTROL = `public, max-age=${DAY_SECONDS}`;

/** `rss.xml`: 피드 리더 폴링을 한 시간 단위로 흡수한다. 본문은 force-dynamic으로 매번 생성한다. */
export const RSS_FEED_CACHE_CONTROL = `public, max-age=${HOUR_SECONDS}`;

const SHARED_CACHE_ONLY_DIRECTIVES = /\b(?:s-maxage|stale-while-revalidate|stale-if-error)\b/i;

/** 공유 캐시 전용 지시어가 섞였는지 확인한다(계약 테스트용). */
export function hasSharedCacheOnlyDirective(cacheControl: string) {
  return SHARED_CACHE_ONLY_DIRECTIVES.test(cacheControl);
}
