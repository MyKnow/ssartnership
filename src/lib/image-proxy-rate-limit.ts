import { createHash } from "node:crypto";
import { createInMemoryRateLimiter } from "@/lib/in-memory-rate-limit";
import { normalizeClientIp } from "@/lib/client-ip";
import { isPublicIpAddress } from "@/lib/image-proxy/ip";

const ROUTE_KEY = "public-image-proxy";

/**
 * 공개 이미지 프록시의 IP별 프로세스 로컬 쿼터.
 *
 * - 요청마다 DB를 왕복하던 지속 저장 쿼터를 대신한다(요청당 DB 0회).
 * - 자체 호스팅에는 공유 캐시가 없어 브라우저 직접 요청이 모두 앱에 닿고, 캠퍼스
 *   공용 NAT 뒤 다수 회원이 같은 IP를 쓰므로 한도는 넉넉히, 차단은 짧게 둔다.
 * - IP 쿼터는 공개 주소로 판정된 클라이언트에만 적용한다. IP를 판정할 수 없는
 *   요청(null)과 공개 주소가 아닌 내부 홉 주소는 건너뛴다. Next 이미지 옵티마이저의
 *   내부 호출은 전달 헤더 없이 만들어지고, Next 서버가 원 요청 소켓의 접속 상대
 *   주소(relay 컨테이너)로 X-Forwarded-For를 채운다. 그래서 모든 옵티마이저 호출이
 *   내부 주소 하나로 모이며, 이를 버킷으로 세면 공개 이미지 전체가 함께 차단된다.
 *   대신 원격 fetch 크기·시간 한도(`PUBLIC_IMAGE_PROXY_FETCH_LIMITS`)로 요청당
 *   비용을 바운드한다.
 */
export const IMAGE_PROXY_RATE_LIMIT = {
  windowMs: 60 * 1000,
  maxAttempts: 240,
  blockMs: 60 * 1000,
  maxBuckets: 5_000,
} as const;

const limiter = createInMemoryRateLimiter(IMAGE_PROXY_RATE_LIMIT);

export type ImageProxyRateLimitResult =
  | { readonly ok: true; readonly scope: "ip" | "untracked" }
  | {
      readonly ok: false;
      readonly code: "blocked";
      readonly retryAfterSeconds: number;
    };

function hashClientIp(value: string) {
  return createHash("sha256")
    .update(`${ROUTE_KEY}:ip:${value}`)
    .digest("hex");
}

/** 메모리에도 원문 IP를 남기지 않도록 해시 키를 쓴다. */
export function getImageProxyRateLimitKey(ipAddress: string) {
  const normalized = normalizeClientIp(ipAddress) ?? ipAddress.trim().toLowerCase();
  return `${ROUTE_KEY}:ip:${hashClientIp(normalized)}`;
}

export function consumeImageProxyRequestQuota(
  input: { ipAddress?: string | null },
  now = Date.now(),
): ImageProxyRateLimitResult {
  const ipAddress = normalizeClientIp(input.ipAddress);
  if (!ipAddress || !isPublicIpAddress(ipAddress)) {
    return { ok: true, scope: "untracked" };
  }

  const result = limiter.consume(getImageProxyRateLimitKey(ipAddress), now);
  return result.ok
    ? { ok: true, scope: "ip" }
    : { ok: false, code: "blocked", retryAfterSeconds: result.retryAfterSeconds };
}

export function resetImageProxyRateLimitForTests() {
  limiter.reset();
}
