import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server.js";
import { z } from "zod";
import type {
  MemberWalletPass,
  UpdatedAppleWalletPass,
} from "@/lib/repositories/wallet-pass-repository";
import {
  deriveAppleWalletAuthenticationToken,
} from "@/lib/wallet/wallet-pass-token";
import { hashAppleDeviceLibraryIdentifier } from "./apple-wallet-device-token";
import { getAppleWalletConfigStatus } from "./config";
import type { AppleWalletConfig } from "./types";

const APPLE_PASS_AUTHORIZATION_PREFIX = "ApplePass ";
const CACHE_CONTROL_VALUE = "private, no-store";
const UPDATED_SINCE_QUERY_PARAM = "passesUpdatedSince";
const MAX_UPDATED_PASS_COUNT = 100;

const registrationRequestSchema = z
  .object({
    pushToken: z
      .string()
      .trim()
      .min(16)
      .max(512)
      .regex(/^[A-Za-z0-9._~-]+$/),
  })
  .strict();

const logRequestSchema = z
  .object({
    logs: z.array(z.string().trim().min(1).max(1000)).max(100),
  })
  .strict();

function createNoStoreHeaders(init?: HeadersInit) {
  const headers = new Headers(init);
  headers.set("cache-control", CACHE_CONTROL_VALUE);
  headers.set("x-content-type-options", "nosniff");
  return headers;
}

function safeEqualText(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function readApplePassAuthorizationToken(request: Request) {
  const authorization = request.headers.get("authorization")?.trim();
  if (!authorization?.startsWith(APPLE_PASS_AUTHORIZATION_PREFIX)) {
    return null;
  }
  const token = authorization
    .slice(APPLE_PASS_AUTHORIZATION_PREFIX.length)
    .trim();
  return token || null;
}

function normalizePathParam(value: string, maxLength: number) {
  try {
    const normalized = decodeURIComponent(value).trim();
    return normalized.length > 0 && normalized.length <= maxLength
      ? normalized
      : null;
  } catch {
    return null;
  }
}

export function appleWalletJsonResponse(
  body: unknown,
  status = 200,
  init?: HeadersInit,
) {
  return NextResponse.json(body, {
    status,
    headers: createNoStoreHeaders(init),
  });
}

export function appleWalletEmptyResponse(status = 200, init?: HeadersInit) {
  return new NextResponse(null, {
    status,
    headers: createNoStoreHeaders(init),
  });
}

export function getAppleWalletWebServiceConfig() {
  const status = getAppleWalletConfigStatus();
  if (!status.ok) {
    return {
      ok: false as const,
      response: appleWalletJsonResponse(
        { message: "Apple Wallet 웹서비스를 사용할 수 없습니다." },
        503,
      ),
    };
  }
  return { ok: true as const, config: status.config };
}

export function isExpectedAppleWalletPassTypeIdentifier(
  actualValue: string,
  expectedValue: string,
) {
  return normalizePathParam(actualValue, 255) === expectedValue.trim();
}

export function normalizeAppleWalletSerialNumber(value: string) {
  const normalized = normalizePathParam(value, 128);
  return normalized && /^sp-[A-Za-z0-9_-]{43}$/.test(normalized)
    ? normalized
    : null;
}

export function getAppleWalletPublicIdFromSerialNumber(value: string) {
  const serialNumber = normalizeAppleWalletSerialNumber(value);
  return serialNumber ? serialNumber.slice(3) : null;
}

export function verifyAppleWalletPassAuthorizationByPublicId(
  request: Request,
  publicId: string,
  config: Pick<
    AppleWalletConfig,
    "passTypeIdentifier" | "deviceTokenEncryptionKey"
  >,
) {
  const providedToken = readApplePassAuthorizationToken(request);
  if (!providedToken) {
    return false;
  }
  const expectedToken = deriveAppleWalletAuthenticationToken(
    publicId,
    config.passTypeIdentifier,
    config.deviceTokenEncryptionKey,
  );
  return safeEqualText(providedToken, expectedToken);
}

export function verifyAppleWalletPassAuthorization(
  request: Request,
  pass: Pick<MemberWalletPass, "publicId">,
  config: Pick<
    AppleWalletConfig,
    "passTypeIdentifier" | "deviceTokenEncryptionKey"
  >,
) {
  return verifyAppleWalletPassAuthorizationByPublicId(
    request,
    pass.publicId,
    config,
  );
}

export function hashAppleWalletDeviceIdentifier(
  deviceLibraryIdentifier: string,
  deviceTokenEncryptionKey: Buffer,
) {
  return hashAppleDeviceLibraryIdentifier(
    normalizePathParam(deviceLibraryIdentifier, 128) ?? "",
    deviceTokenEncryptionKey,
  );
}

export async function parseAppleWalletRegistrationBody(request: Request) {
  const body = await request.json().catch(() => null);
  return registrationRequestSchema.safeParse(body);
}

export async function parseAppleWalletLogBody(request: Request) {
  const body = await request.json().catch(() => null);
  return logRequestSchema.safeParse(body);
}

export function parseAppleWalletUpdatedSince(request: Request) {
  const rawValue = new URL(request.url).searchParams
    .get(UPDATED_SINCE_QUERY_PARAM)
    ?.trim();
  if (!rawValue) {
    return { ok: true as const, value: null };
  }
  const parsedDate = new Date(rawValue);
  if (Number.isNaN(parsedDate.getTime())) {
    return { ok: false as const };
  }
  return { ok: true as const, value: parsedDate.toISOString() };
}

export function parseAppleWalletIfModifiedSince(request: Request) {
  const value = request.headers.get("if-modified-since")?.trim();
  if (!value) {
    return { ok: true as const, value: null };
  }
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return { ok: false as const };
  }
  return { ok: true as const, value: parsedDate };
}

export function isAppleWalletPassModifiedAfter(
  pass: Pick<MemberWalletPass, "updatedAt">,
  ifModifiedSince: Date | null,
) {
  if (!ifModifiedSince) {
    return true;
  }
  const updatedAt = new Date(pass.updatedAt);
  if (Number.isNaN(updatedAt.getTime())) {
    return true;
  }
  return (
    Math.floor(updatedAt.getTime() / 1000) >
    Math.floor(ifModifiedSince.getTime() / 1000)
  );
}

export function buildAppleWalletUpdatedPassesResponse(
  updatedPasses: readonly UpdatedAppleWalletPass[],
) {
  const serialNumbers = updatedPasses.map(({ pass }) => pass.serialNumber);
  const lastUpdated = updatedPasses.reduce<string | null>((latest, entry) => {
    const updatedAt = new Date(entry.pass.updatedAt);
    const entryLatest = Number.isNaN(updatedAt.getTime())
      ? null
      : updatedAt.toISOString();
    if (!entryLatest) {
      return latest;
    }
    if (!latest) {
      return entryLatest;
    }
    return entryLatest > latest ? entryLatest : latest;
  }, null);

  return {
    serialNumbers,
    lastUpdated,
  };
}

export function getAppleWalletUpdateQueryLimit() {
  return MAX_UPDATED_PASS_COUNT;
}

export function createAppleWalletPkPassResponse(
  buffer: Buffer,
  lastModified: string,
  status = 200,
) {
  return new NextResponse(buffer, {
    status,
    headers: createNoStoreHeaders({
      "content-type": "application/vnd.apple.pkpass",
      "content-length": String(buffer.byteLength),
      "last-modified": lastModified,
    }),
  });
}
