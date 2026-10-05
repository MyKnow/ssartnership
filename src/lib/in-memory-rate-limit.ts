/**
 * 프로세스 로컬 고정 창 레이트리밋 버킷.
 *
 * 앱은 단일 replica를 기준으로 운영하므로(자체 호스팅 계획), 요청마다 DB를 왕복할
 * 필요가 없는 공개 경로의 best-effort 보호에 쓴다. 재시작하면 상태가 사라지고
 * replica 사이에서 공유되지 않으므로, 인증 시도처럼 지속성이 필요한 제한에는
 * DB 기반 `rate-limit.ts`를 쓴다.
 */

export type InMemoryRateLimitConfig = {
  readonly windowMs: number;
  readonly maxAttempts: number;
  readonly blockMs: number;
  readonly maxBuckets: number;
};

export type InMemoryRateLimitResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly retryAfterSeconds: number };

type Bucket = {
  count: number;
  windowStartedAt: number;
  blockedUntil: number;
};

function assertPositiveInteger(name: string, value: number) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`in_memory_rate_limit_${name}_invalid`);
  }
}

function toRetryAfterSeconds(blockedUntil: number, now: number) {
  return Math.max(1, Math.ceil((blockedUntil - now) / 1_000));
}

export function createInMemoryRateLimiter(config: InMemoryRateLimitConfig) {
  assertPositiveInteger("window", config.windowMs);
  assertPositiveInteger("max_attempts", config.maxAttempts);
  assertPositiveInteger("block", config.blockMs);
  assertPositiveInteger("max_buckets", config.maxBuckets);

  const buckets = new Map<string, Bucket>();

  function isExpired(bucket: Bucket, now: number) {
    // 차단이 끝나면 창 경과와 무관하게 새 창에서 다시 센다.
    if (bucket.blockedUntil > 0) {
      return bucket.blockedUntil <= now;
    }
    return now - bucket.windowStartedAt >= config.windowMs;
  }

  function prune(now: number) {
    if (buckets.size < config.maxBuckets) {
      return;
    }
    for (const [key, bucket] of buckets) {
      if (isExpired(bucket, now)) {
        buckets.delete(key);
      }
    }
    // Map은 삽입 순서를 유지하므로 가장 오래 갱신되지 않은 버킷부터 버린다.
    while (buckets.size >= config.maxBuckets) {
      const oldestKey = buckets.keys().next().value;
      if (oldestKey === undefined) {
        return;
      }
      buckets.delete(oldestKey);
    }
  }

  function consume(key: string, now = Date.now()): InMemoryRateLimitResult {
    const current = buckets.get(key);
    if (current && current.blockedUntil > now) {
      return {
        ok: false,
        retryAfterSeconds: toRetryAfterSeconds(current.blockedUntil, now),
      };
    }

    if (!current || isExpired(current, now)) {
      if (current) {
        buckets.delete(key);
      }
      prune(now);
      buckets.set(key, { count: 1, windowStartedAt: now, blockedUntil: 0 });
      return { ok: true };
    }

    current.count += 1;
    // 최근 사용한 키를 Map 끝으로 옮겨 용량 초과 시 먼저 버려지지 않게 한다.
    buckets.delete(key);
    buckets.set(key, current);

    if (current.count > config.maxAttempts) {
      current.blockedUntil = now + config.blockMs;
      return {
        ok: false,
        retryAfterSeconds: toRetryAfterSeconds(current.blockedUntil, now),
      };
    }
    return { ok: true };
  }

  return {
    consume,
    reset() {
      buckets.clear();
    },
    size() {
      return buckets.size;
    },
  };
}
