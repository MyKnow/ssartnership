import { z } from "zod";
import { type ProductEventName } from "@/lib/event-catalog";
import { normalizeProductEventLocation } from "@/lib/product-event-path";
import { PRODUCT_EVENT_SCHEMA_VERSION } from "@/lib/product-event-schema";

export { PRODUCT_EVENT_SCHEMA_VERSION } from "@/lib/product-event-schema";
export const MAX_PRODUCT_EVENT_BODY_BYTES = 12 * 1024;
export const CLIENT_PRODUCT_EVENT_NAMES = [
  "page_view",
  "partner_detail_view",
  "partner_card_click",
  "category_filter_change",
  "directory_view_change",
  "search_execute",
  "sort_change",
  "partner_map_click",
  "reservation_click",
  "inquiry_click",
  "share_link_copy",
  "push_settings_view",
  "pwa_install_click",
  "certification_view",
  "certification_qr_open",
  "certification_qr_verify",
  "home_banner_click",
  "coupon_view",
  "coupon_copy",
] as const satisfies readonly ProductEventName[];

export type ClientProductEventName = (typeof CLIENT_PRODUCT_EVENT_NAMES)[number];

const MAX_TEXT_LENGTH = 128;
const MAX_LOCATION_LENGTH = 2_048;

const nullableText = z.string().trim().min(1).max(MAX_TEXT_LENGTH).nullable().optional();
const nullableLocation = z
  .string()
  .trim()
  .min(1)
  .max(MAX_LOCATION_LENGTH)
  .nullable()
  .optional();
const shortText = z.string().trim().min(1).max(MAX_TEXT_LENGTH);
const nullableShortText = shortText.nullable().optional();
const nonNegativeInteger = z.number().int().min(0).max(100_000);

const productEventRequestSchema = z
  .object({
    eventId: z.string().uuid(),
    schemaVersion: z.literal(PRODUCT_EVENT_SCHEMA_VERSION),
    occurredAt: z
      .string()
      .max(64)
      .refine((value) => !Number.isNaN(Date.parse(value)), "Invalid occurredAt."),
    eventName: z.enum(CLIENT_PRODUCT_EVENT_NAMES),
    sessionId: nullableText,
    path: nullableLocation,
    referrer: nullableLocation,
    targetType: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .regex(/^[a-z][a-z0-9_:-]*$/)
      .nullable()
      .optional(),
    targetId: nullableText,
    properties: z.record(z.string(), z.unknown()).nullable().optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.targetId && !value.targetType) {
      context.addIssue({
        code: "custom",
        path: ["targetId"],
        message: "targetType is required when targetId is present.",
      });
    }
  });

function parseProperties(
  eventName: ClientProductEventName,
  properties: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const rawProperties = properties ?? {};

  switch (eventName) {
    case "page_view":
      return z
        .object({ area: z.enum(["site", "admin", "auth", "partner"]).optional() })
        .strip()
        .parse(rawProperties);
    case "partner_detail_view":
      return z
        .object({
          categoryKey: nullableShortText,
          isActive: z.boolean().optional(),
        })
        .strip()
        .parse(rawProperties);
    case "partner_card_click":
      return z
        .object({
          categoryKey: nullableShortText,
          source: shortText.optional(),
        })
        .strip()
        .parse(rawProperties);
    case "category_filter_change":
      return z.object({ categoryKey: shortText.optional() }).strip().parse(rawProperties);
    case "directory_view_change":
      return z.object({ viewMode: shortText.optional() }).strip().parse(rawProperties);
    case "search_execute":
      return z
        .object({
          hasQuery: z.boolean().optional(),
          queryLength: nonNegativeInteger.optional(),
          categoryKey: nullableShortText,
          campusFilter: nullableShortText,
          appliesToFilter: nullableShortText,
          sortValue: nullableShortText,
          resultCount: nonNegativeInteger.optional(),
        })
        .strip()
        .parse(rawProperties);
    case "sort_change":
      return z.object({ sortValue: shortText.optional() }).strip().parse(rawProperties);
    case "partner_map_click":
    case "reservation_click":
    case "inquiry_click":
    case "share_link_copy":
      return z.object({ source: shortText.optional() }).strip().parse(rawProperties);
    case "push_settings_view":
      return z.object({ configured: z.boolean().optional() }).strip().parse(rawProperties);
    case "pwa_install_click":
      return z
        .object({
          iosInstallHint: z.boolean().optional(),
          hasDeferredPrompt: z.boolean().optional(),
        })
        .strip()
        .parse(rawProperties);
    case "certification_view":
      return z
        .object({
          generation: nonNegativeInteger.optional(),
          campus: nullableShortText,
          role: nullableShortText,
        })
        .strip()
        .parse(rawProperties);
    case "certification_qr_verify":
      return z
        .object({
          valid: z.boolean().optional(),
          reason: nullableShortText,
          generation: nonNegativeInteger.optional(),
          campus: nullableShortText,
          role: nullableShortText,
        })
        .strip()
        .parse(rawProperties);
    case "home_banner_click":
      return z
        .object({
          slideId: shortText.optional(),
          campaignId: nullableShortText,
          sponsorLabel: z.string().trim().max(MAX_TEXT_LENGTH).optional(),
        })
        .strip()
        .parse(rawProperties);
    case "coupon_view":
    case "coupon_copy":
      return z
        .object({
          campaignId: nullableShortText,
          partnerId: nullableShortText,
        })
        .strip()
        .parse(rawProperties);
    default:
      return {};
  }
}

type ProductEventTarget = {
  targetType: string | null;
  targetId: string | null;
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const mockPartnerIdPattern =
  /^(?:mock-partner-[a-z0-9-]{1,96}|(?:health|restaurant|cafe|space)-\d{3})$/;
const categoryKeyPattern = /^[a-z0-9][a-z0-9_-]{0,63}$/i;
const safeTargetIdPattern = /^[a-z0-9][a-z0-9._:-]{0,127}$/i;

function rejectTarget(eventName: ClientProductEventName): never {
  throw new Error(`Invalid target for product event: ${eventName}`);
}

function parseNoTarget(
  eventName: ClientProductEventName,
  targetType: string | null,
  targetId: string | null,
): ProductEventTarget {
  if (targetType || targetId) {
    return rejectTarget(eventName);
  }
  return { targetType: null, targetId: null };
}

function parseFixedTarget(
  eventName: ClientProductEventName,
  targetType: string | null,
  targetId: string | null,
  expectedTargetType: string,
  options: { targetId?: "none" | "uuid" | "partner" | "category" | "safe" } = {},
): ProductEventTarget {
  if (targetType !== expectedTargetType) {
    return rejectTarget(eventName);
  }

  switch (options.targetId ?? "none") {
    case "none":
      if (targetId) {
        return rejectTarget(eventName);
      }
      break;
    case "uuid":
      if (!targetId || !uuidPattern.test(targetId)) {
        return rejectTarget(eventName);
      }
      break;
    case "partner":
      if (!targetId || (!uuidPattern.test(targetId) && !mockPartnerIdPattern.test(targetId))) {
        return rejectTarget(eventName);
      }
      break;
    case "category":
      if (targetId && !categoryKeyPattern.test(targetId)) {
        return rejectTarget(eventName);
      }
      break;
    case "safe":
      if (!targetId || !safeTargetIdPattern.test(targetId)) {
        return rejectTarget(eventName);
      }
      break;
  }

  return { targetType, targetId };
}

function parseProductEventTarget(
  eventName: ClientProductEventName,
  targetType: string | null,
  targetId: string | null,
): ProductEventTarget {
  switch (eventName) {
    case "page_view":
      return parseNoTarget(eventName, targetType, targetId);
    case "partner_detail_view":
    case "partner_card_click":
    case "partner_map_click":
    case "reservation_click":
    case "inquiry_click":
      return parseFixedTarget(eventName, targetType, targetId, "partner", {
        targetId: "partner",
      });
    case "share_link_copy":
      if (targetType === "share_target" && !targetId) {
        return { targetType, targetId: null };
      }
      return parseFixedTarget(eventName, targetType, targetId, "partner", {
        targetId: "partner",
      });
    case "category_filter_change":
      return parseFixedTarget(eventName, targetType, targetId, "category", {
        targetId: "category",
      });
    case "directory_view_change":
      if (
        targetType !== "partner_directory" ||
        (targetId !== "card" && targetId !== "list")
      ) {
        return rejectTarget(eventName);
      }
      return { targetType, targetId };
    case "search_execute":
      return parseFixedTarget(eventName, targetType, targetId, "partner_search");
    case "sort_change":
      if (
        targetType !== "partner_sort" ||
        (targetId !== "popular" && targetId !== "recent" && targetId !== "endingSoon")
      ) {
        return rejectTarget(eventName);
      }
      return { targetType, targetId };
    case "push_settings_view":
      return parseFixedTarget(eventName, targetType, targetId, "push_settings");
    case "pwa_install_click":
      return parseFixedTarget(eventName, targetType, targetId, "pwa");
    case "certification_view":
      return parseFixedTarget(eventName, targetType, targetId, "member");
    case "certification_qr_open":
    case "certification_qr_verify":
      return parseFixedTarget(eventName, targetType, targetId, "certification_qr");
    case "home_banner_click":
      if (
        (targetType !== "ad_campaign" && targetType !== "home_banner") ||
        !targetId ||
        !safeTargetIdPattern.test(targetId)
      ) {
        return rejectTarget(eventName);
      }
      return { targetType, targetId };
    case "coupon_view":
    case "coupon_copy":
      return parseFixedTarget(eventName, targetType, targetId, "ad_coupon", {
        targetId: "safe",
      });
  }
}

export type ParsedProductEventRequest = {
  eventId: string;
  schemaVersion: typeof PRODUCT_EVENT_SCHEMA_VERSION;
  occurredAt: string;
  eventName: ClientProductEventName;
  sessionId: string | null;
  path: string | null;
  referrer: string | null;
  targetType: string | null;
  targetId: string | null;
  properties: Record<string, unknown>;
};

export function parseProductEventRequest(input: unknown): ParsedProductEventRequest {
  const parsed = productEventRequestSchema.parse(input);
  const target = parseProductEventTarget(
    parsed.eventName,
    parsed.targetType ?? null,
    parsed.targetId ?? null,
  );

  return {
    eventId: parsed.eventId,
    schemaVersion: parsed.schemaVersion,
    occurredAt: new Date(parsed.occurredAt).toISOString(),
    eventName: parsed.eventName,
    sessionId: parsed.sessionId ?? null,
    path: normalizeProductEventLocation(parsed.path),
    referrer: normalizeProductEventLocation(parsed.referrer),
    targetType: target.targetType,
    targetId: target.targetId,
    properties: parseProperties(parsed.eventName, parsed.properties),
  };
}
