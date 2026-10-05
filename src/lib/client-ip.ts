import net from 'node:net';

/**
 * 클라이언트 IP 신뢰 계약 (리팩토링 기본 결정 21)
 *
 * - 앱은 `SELF_HOST_MODE === 'real'`일 때만 `x-forwarded-for`의 첫 값을 신뢰한다.
 *   첫 값은 128자 상한과 `net.isIP` 검증을 통과해야 하며, 통과하지 못하면 null이다.
 * - 그 외 환경(로컬 mock, 테스트, 미설정)은 언제나 null이다. `x-real-ip`,
 *   플랫폼 전용 헤더 등 다른 전달 헤더는 어떤 모드에서도 읽지 않는다.
 * - 이 신뢰는 배포 체인이 보장한다.
 *   1. 공개 엣지 Caddy는 클라이언트가 보낸 X-Forwarded-For/X-Real-IP를 믿지 않고
 *      접속 상대(`{remote_host}`) 기준으로 덮어써 전달한다(`trusted_proxies` 없음).
 *   2. 앱 VM의 relay Caddy는 `trusted_proxies`로 엣지 단일 홉만 신뢰해 값을 이어 붙인다.
 *   3. 앱 컨테이너 포트는 loopback과 relay 외에는 공개하지 않는다.
 * - null은 "판정 불가"다. 호출부는 null을 다른 클라이언트와 공유하는 단일 버킷으로
 *   바꿀지(익명 폼의 보수적 차단) 또는 IP 쿼터를 건너뛸지(공개 이미지 프록시)
 *   경로별로 명시한다.
 * - 전달 헤더 없이 앱에 닿은 요청(loopback 호출, Next 이미지 옵티마이저의 내부 호출)은
 *   라우트 처리 단계에서 Next 서버가 접속 상대 주소로 `x-forwarded-for`를 채운다.
 *   그래서 신뢰 프록시 모드에서도 이런 요청의 첫 값은 클라이언트가 아니라 relay
 *   컨테이너·Docker gateway 같은 내부 홉 주소다. 여러 요청이 내부 주소 하나로 모이는
 *   경로(공개 이미지 프록시)는 공개 주소에만 IP 쿼터를 적용한다.
 * - 체인이 바뀌면(CDN·추가 프록시 도입 등) 이 함수와
 *   `tests/client-ip-trust-contract.test.mts`를 같은 변경에서 갱신한다.
 */

type HeaderSource = {
  get(name: string): string | null;
};

export const CLIENT_IP_HEADER = 'x-forwarded-for';
export const MAX_CLIENT_IP_LENGTH = 128;

const IPV4_MAPPED_IPV6_PREFIX = '::ffff:';

export function isTrustedClientIpMode(
  mode: string | undefined = process.env.SELF_HOST_MODE,
) {
  return mode === 'real';
}

/**
 * 형식이 올바른 IP 문자열만 비교·키 생성에 쓰기 좋은 정규형으로 바꾼다.
 * IPv6는 소문자로, IPv4-mapped IPv6(`::ffff:a.b.c.d`)는 IPv4로 바꾼다.
 */
export function normalizeClientIp(value: string | null | undefined) {
  const candidate = value?.trim();
  if (!candidate || candidate.length > MAX_CLIENT_IP_LENGTH) {
    return null;
  }

  const version = net.isIP(candidate);
  if (version === 4) {
    return candidate;
  }
  if (version !== 6) {
    return null;
  }

  const lowered = candidate.toLowerCase();
  if (lowered.startsWith(IPV4_MAPPED_IPV6_PREFIX)) {
    const embedded = lowered.slice(IPV4_MAPPED_IPV6_PREFIX.length);
    if (net.isIP(embedded) === 4) {
      return embedded;
    }
  }
  return lowered;
}

function getFirstForwardedValue(value: string | null) {
  if (!value) {
    return null;
  }
  const separatorIndex = value.indexOf(',');
  const first = separatorIndex === -1 ? value : value.slice(0, separatorIndex);
  return first.trim() || null;
}

export function getClientIp(headerStore: HeaderSource) {
  if (!isTrustedClientIpMode()) {
    return null;
  }
  return normalizeClientIp(
    getFirstForwardedValue(headerStore.get(CLIENT_IP_HEADER)),
  );
}

/**
 * 익명 폼 레이트리밋용 식별자. IP를 판정할 수 없으면 모든 미판정 요청이 공유하는
 * 보수적 버킷으로 묶는다. 신뢰 프록시 모드에서는 relay가 x-forwarded-for를 붙이고
 * 헤더 없이 들어온 요청도 Next 서버가 접속 상대 주소로 채우므로, 이 버킷은 주로
 * 신뢰 프록시 모드가 아닌 환경(로컬·테스트)에서 쓰인다.
 */
export const UNRESOLVED_CLIENT_BUCKET = 'unknown';

export function getClientRateLimitIdentifier(headerStore: HeaderSource) {
  return getClientIp(headerStore) ?? UNRESOLVED_CLIENT_BUCKET;
}
