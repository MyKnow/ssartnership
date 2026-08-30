import dns from "node:dns/promises";
import { isPublicIpAddress } from "@/lib/image-proxy/ip";
import { sanitizeHttpUrl } from "@/lib/validation";
import { PushError } from "./types";
import type { SubscriptionInput } from "./types";

const TRUST_CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_PUSH_ENDPOINT_LENGTH = 4_096;
const MAX_PUSH_P256DH_LENGTH = 512;
const MAX_PUSH_AUTH_LENGTH = 256;

const TRUSTED_PUSH_HOSTS = new Set([
  "android.googleapis.com",
  "fcm.googleapis.com",
  "push.services.mozilla.com",
  "updates.push.services.mozilla.com",
  "web.push.apple.com",
]);

const TRUSTED_PUSH_HOST_SUFFIXES = [
  ".push.apple.com",
  ".notify.windows.com",
] as const;

const trustedPushHostCache = new Map<string, number>();
const trustedPushHostPendingLookups = new Map<string, Promise<void>>();

type HostLookupResult = {
  address: string;
};

export type ValidatedPushSubscription = {
  endpoint: string;
  p256dh: string;
  auth: string;
  expirationTime: string | null;
};

type ValidationOptions = {
  resolveHostname?: (hostname: string) => Promise<HostLookupResult[]>;
  now?: Date;
};

function getInvalidSubscriptionError() {
  return new PushError(
    "invalid_request",
    "지원되지 않는 Push 구독 정보입니다.",
  );
}

function isEmptyOrTooLong(value: string, maxLength: number) {
  return value.length === 0 || value.length > maxLength;
}

function normalizeHostname(hostname: string) {
  return hostname.trim().toLowerCase();
}

function isTrustedPushHostname(hostname: string) {
  const normalized = normalizeHostname(hostname);
  if (TRUSTED_PUSH_HOSTS.has(normalized)) {
    return true;
  }

  return TRUSTED_PUSH_HOST_SUFFIXES.some((suffix) => normalized.endsWith(suffix));
}

async function defaultResolveHostname(hostname: string) {
  return dns.lookup(hostname, {
    all: true,
    verbatim: true,
  });
}

async function assertTrustedPushEndpoint(
  endpoint: string,
  options: ValidationOptions = {},
) {
  const parsed = new URL(endpoint);
  const hostname = normalizeHostname(parsed.hostname);
  if (!isTrustedPushHostname(hostname)) {
    throw getInvalidSubscriptionError();
  }

  const now = options.now ?? new Date();
  const cachedUntil = trustedPushHostCache.get(hostname);
  if (cachedUntil && cachedUntil > now.getTime()) {
    return;
  }

  const pendingLookup = trustedPushHostPendingLookups.get(hostname);
  if (pendingLookup) {
    return pendingLookup;
  }

  const lookupPromise = (async () => {
    let lookupResults: HostLookupResult[];
    try {
      lookupResults = await (options.resolveHostname ?? defaultResolveHostname)(hostname);
    } catch {
      throw new PushError(
        "push_unavailable",
        "Push 구독 경로를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      );
    }

    if (lookupResults.length === 0) {
      throw getInvalidSubscriptionError();
    }

    if (lookupResults.some((entry) => !isPublicIpAddress(entry.address))) {
      throw getInvalidSubscriptionError();
    }

    trustedPushHostCache.set(hostname, now.getTime() + TRUST_CACHE_TTL_MS);
  })();

  trustedPushHostPendingLookups.set(hostname, lookupPromise);

  try {
    await lookupPromise;
  } catch (error) {
    trustedPushHostPendingLookups.delete(hostname);
    throw error;
  }

  trustedPushHostPendingLookups.delete(hostname);
}

export async function validateTrustedPushSubscription(
  input: SubscriptionInput,
  options: ValidationOptions = {},
): Promise<ValidatedPushSubscription> {
  const endpoint = sanitizeHttpUrl(input.endpoint);
  if (!endpoint?.startsWith("https://") || endpoint.length > MAX_PUSH_ENDPOINT_LENGTH) {
    throw new PushError("invalid_request", "유효한 Push 구독 정보를 찾을 수 없습니다.");
  }

  const p256dh = input.keys?.p256dh?.trim();
  const auth = input.keys?.auth?.trim();
  if (
    !p256dh ||
    !auth ||
    isEmptyOrTooLong(p256dh, MAX_PUSH_P256DH_LENGTH) ||
    isEmptyOrTooLong(auth, MAX_PUSH_AUTH_LENGTH)
  ) {
    throw new PushError("invalid_request", "Push 구독 키가 누락되었습니다.");
  }

  await assertTrustedPushEndpoint(endpoint, options);

  return {
    endpoint,
    p256dh,
    auth,
    expirationTime:
      typeof input.expirationTime === "number" && Number.isFinite(input.expirationTime)
        ? new Date(input.expirationTime).toISOString()
        : null,
  };
}

export async function buildTrustedPushSubscriptionRequest(input: {
  endpoint: string;
  p256dh: string;
  auth: string;
}, options: ValidationOptions = {}) {
  const validated = await validateTrustedPushSubscription({
    endpoint: input.endpoint,
    expirationTime: null,
    keys: {
      p256dh: input.p256dh,
      auth: input.auth,
    },
  }, options);

  return {
    endpoint: validated.endpoint,
    expirationTime: null,
    keys: {
      p256dh: validated.p256dh,
      auth: validated.auth,
    },
  };
}
