type ProductEventThrottleInput = {
  eventName: string;
  ipAddress?: string | null;
  sessionId?: string | null;
};

type Bucket = {
  count: number;
  windowStartedAt: number;
};

const WINDOW_MS = 60_000;
const MAX_EVENTS_PER_WINDOW = 120;
const MAX_SAME_EVENT_PER_WINDOW = 30;
const MAX_BUCKETS = 2_000;

const buckets = new Map<string, Bucket>();

function normalizeKeyPart(value: string | null | undefined, fallback: string) {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, 128) : fallback;
}

function buildActorKey(input: ProductEventThrottleInput) {
  const ipKey = normalizeKeyPart(input.ipAddress, 'unknown-ip');
  const sessionKey = normalizeKeyPart(input.sessionId, 'anonymous-session');
  return `${ipKey}:${sessionKey}`;
}

function pruneBuckets(now: number) {
  if (buckets.size <= MAX_BUCKETS) {
    return;
  }

  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStartedAt > WINDOW_MS) {
      buckets.delete(key);
    }
  }

  while (buckets.size > MAX_BUCKETS) {
    const oldestKey = buckets.keys().next().value as string | undefined;
    if (!oldestKey) {
      return;
    }
    buckets.delete(oldestKey);
  }
}

function consumeBucket(key: string, limit: number, now: number) {
  const current = buckets.get(key);
  if (!current || now - current.windowStartedAt > WINDOW_MS) {
    buckets.set(key, {
      count: 1,
      windowStartedAt: now,
    });
    return true;
  }

  if (current.count >= limit) {
    return false;
  }

  buckets.set(key, {
    ...current,
    count: current.count + 1,
  });
  return true;
}

export function consumeProductEventQuota(
  input: ProductEventThrottleInput,
  now = Date.now(),
) {
  pruneBuckets(now);

  const actorKey = buildActorKey(input);
  const eventName = normalizeKeyPart(input.eventName, 'unknown-event');
  const allEventsAllowed = consumeBucket(
    `all:${actorKey}`,
    MAX_EVENTS_PER_WINDOW,
    now,
  );
  const sameEventAllowed = consumeBucket(
    `event:${actorKey}:${eventName}`,
    MAX_SAME_EVENT_PER_WINDOW,
    now,
  );

  return allEventsAllowed && sameEventAllowed;
}

export function resetProductEventThrottleForTests() {
  buckets.clear();
}
