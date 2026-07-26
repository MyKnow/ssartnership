import { normalizeProductEventLocation } from "@/lib/product-event-path";

const ADMIN_WEB_VITAL_NAMES = ["CLS", "FCP", "INP", "LCP", "TTFB"] as const;
const ADMIN_WEB_VITAL_TARGET_METRICS = ["INP", "LCP", "TTFB"] as const;
const ADMIN_ROUTE_TIMING_OUTCOMES = ["complete", "unknown", "error"] as const;
const ADMIN_ROUTE_TIMING_TRIGGERS = [
  "initial-load",
  "link",
  "history",
  "programmatic",
] as const;

const ADMIN_ROUTE_PATH_RULES = [
  { pattern: /^\/admin$/, path: "/admin", key: "admin" },
  { pattern: /^\/admin\/admins$/, path: "/admin/admins", key: "admin.admins" },
  { pattern: /^\/admin\/tasks$/, path: "/admin/tasks", key: "admin.tasks" },
  { pattern: /^\/admin\/search$/, path: "/admin/search", key: "admin.search" },
  { pattern: /^\/admin\/advertisement$/, path: "/admin/advertisement", key: "admin.advertisement" },
  { pattern: /^\/admin\/companies$/, path: "/admin/companies", key: "admin.companies" },
  { pattern: /^\/admin\/categories$/, path: "/admin/categories", key: "admin.categories" },
  { pattern: /^\/admin\/cycle$/, path: "/admin/cycle", key: "admin.cycle" },
  { pattern: /^\/admin\/cycle\/mock$/, path: "/admin/cycle/mock", key: "admin.cycle.mock" },
  { pattern: /^\/admin\/denied$/, path: "/admin/denied", key: "admin.denied" },
  { pattern: /^\/admin\/event$/, path: "/admin/event", key: "admin.event" },
  { pattern: /^\/admin\/event\/[^/]+$/, path: "/admin/event/[slug]", key: "admin.event.detail" },
  { pattern: /^\/admin\/logs$/, path: "/admin/logs", key: "admin.logs" },
  { pattern: /^\/admin\/members$/, path: "/admin/members", key: "admin.members" },
  { pattern: /^\/admin\/members\/mock$/, path: "/admin/members/mock", key: "admin.members.mock" },
  { pattern: /^\/admin\/members\/[^/]+$/, path: "/admin/members/[memberId]", key: "admin.members.detail" },
  { pattern: /^\/admin\/graduate-verifications$/, path: "/admin/graduate-verifications", key: "admin.graduate-verifications" },
  { pattern: /^\/admin\/profile-photos$/, path: "/admin/profile-photos", key: "admin.profile-photos" },
  { pattern: /^\/admin\/member-signup-requests$/, path: "/admin/member-signup-requests", key: "admin.member-signup-requests" },
  { pattern: /^\/admin\/member-signup-requests\/[^/]+$/, path: "/admin/member-signup-requests/[requestId]", key: "admin.member-signup-requests.detail" },
  { pattern: /^\/admin\/notifications$/, path: "/admin/notifications", key: "admin.notifications" },
  { pattern: /^\/admin\/notification-templates$/, path: "/admin/notification-templates", key: "admin.notification-templates" },
  { pattern: /^\/admin\/partner-registrations$/, path: "/admin/partner-registrations", key: "admin.partner-registrations" },
  { pattern: /^\/admin\/partner-requests$/, path: "/admin/partner-requests", key: "admin.partner-requests" },
  { pattern: /^\/admin\/partners$/, path: "/admin/partners", key: "admin.partners" },
  { pattern: /^\/admin\/partners\/new$/, path: "/admin/partners/new", key: "admin.partners.new" },
  { pattern: /^\/admin\/partners\/[^/]+$/, path: "/admin/partners/[partnerId]", key: "admin.partners.detail" },
  { pattern: /^\/admin\/push$/, path: "/admin/push", key: "admin.push" },
  { pattern: /^\/admin\/reviews$/, path: "/admin/reviews", key: "admin.reviews" },
  { pattern: /^\/admin\/setup\/[^/]+$/, path: "/admin/setup/[token]", key: "admin.setup" },
] as const;

/**
 * A release-confidence floor, not a replacement for a larger RUM cohort.
 * Smaller samples stay visible but never appear as a confirmed target pass.
 */
export const ADMIN_WEB_VITAL_MIN_SAMPLE_COUNT = 30;
export const ADMIN_ROUTE_TIMING_MIN_SAMPLE_COUNT =
  ADMIN_WEB_VITAL_MIN_SAMPLE_COUNT;
export const ADMIN_ROUTE_TIMING_TARGET_MS = 200;

export const ADMIN_WEB_VITAL_TARGETS = {
  INP: { threshold: 200, unit: "ms", label: "상호작용 응답" },
  LCP: { threshold: 2_500, unit: "ms", label: "첫 유용 콘텐츠" },
  TTFB: { threshold: 800, unit: "ms", label: "서버 응답" },
} as const;

export type AdminWebVitalName = (typeof ADMIN_WEB_VITAL_NAMES)[number];
export type AdminWebVitalTargetMetric = (typeof ADMIN_WEB_VITAL_TARGET_METRICS)[number];
export type AdminWebVitalRating = "good" | "needs-improvement" | "poor";
export type AdminRouteTimingOutcome = (typeof ADMIN_ROUTE_TIMING_OUTCOMES)[number];
export type AdminRouteTimingTrigger = (typeof ADMIN_ROUTE_TIMING_TRIGGERS)[number];
export type AdminRouteDescriptor = {
  path: string;
  key: string;
};
export type AdminWebVitalSummaryInput = {
  metric?: string | null;
  sampleCount?: number | string | null;
  p75Value?: number | string | null;
  goodCount?: number | string | null;
  needsImprovementCount?: number | string | null;
  poorCount?: number | string | null;
};
export type AdminWebVitalSummaryMetric = {
  metric: AdminWebVitalTargetMetric;
  label: string;
  threshold: number;
  sampleCount: number;
  p75Value: number | null;
  goodCount: number;
  needsImprovementCount: number;
  poorCount: number;
  status: "unknown" | "insufficient_sample" | "met" | "exceeded";
};

export type AdminRouteTimingSummaryInput = {
  routeKey?: string | null;
  sampleCount?: number | string | null;
  p75DurationMs?: number | string | null;
  completeCount?: number | string | null;
  unknownCount?: number | string | null;
  errorCount?: number | string | null;
};

export type AdminRouteTimingSummaryMetric = {
  routeKey: string;
  label: string;
  threshold: number;
  sampleCount: number;
  p75DurationMs: number | null;
  completeCount: number;
  unknownCount: number;
  errorCount: number;
  status: "unknown" | "insufficient_sample" | "met" | "exceeded";
};

type AdminWebVitalInput = {
  name: string;
  rating: string;
  value: number;
};

type AdminRouteTimingInput = {
  durationMs: number;
  outcome: string;
  trigger: string;
};

function extractPathname(value: string) {
  if (value.includes("://")) {
    try {
      return new URL(value).pathname;
    } catch {
      return null;
    }
  }
  return value.split(/[?#]/, 1)[0] ?? null;
}

/**
 * Returns a route template rather than a raw admin URL. Dynamic identifiers
 * are intentionally replaced with fixed templates before client telemetry is
 * sent, and unknown admin paths collapse to the admin root.
 */
export function getAdminRouteDescriptor(
  value?: string | null,
): AdminRouteDescriptor | null {
  const normalized = normalizeProductEventLocation(value);
  const pathname = normalized ? extractPathname(normalized) : null;
  if (!pathname?.startsWith("/admin")) {
    return null;
  }

  const rule = ADMIN_ROUTE_PATH_RULES.find((candidate) => candidate.pattern.test(pathname));
  return rule ? { path: rule.path, key: rule.key } : { path: "/admin", key: "admin.unknown" };
}

export function toAdminRouteTimingProperties({
  durationMs,
  outcome,
  trigger,
}: AdminRouteTimingInput) {
  return {
    durationMs:
      Number.isFinite(durationMs)
        ? Math.min(120_000, Math.max(0, Math.round(durationMs)))
        : 0,
    outcome: (ADMIN_ROUTE_TIMING_OUTCOMES as readonly string[]).includes(outcome)
      ? (outcome as AdminRouteTimingOutcome)
      : "unknown",
    trigger: (ADMIN_ROUTE_TIMING_TRIGGERS as readonly string[]).includes(trigger)
      ? (trigger as AdminRouteTimingTrigger)
      : "programmatic",
  } as const;
}

export function isAdminWebVitalName(value: string): value is AdminWebVitalName {
  return (ADMIN_WEB_VITAL_NAMES as readonly string[]).includes(value);
}

export function isAdminWebVitalTargetMetric(
  value: string,
): value is AdminWebVitalTargetMetric {
  return (ADMIN_WEB_VITAL_TARGET_METRICS as readonly string[]).includes(value);
}

function toNonNegativeNumber(value: number | string | null | undefined) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function toOptionalNonNegativeNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : null;
}

/**
 * Normalizes the database aggregate into the three release targets. Missing
 * metrics remain unknown instead of being presented as passing performance.
 */
export function toAdminWebVitalSummary(
  rows: AdminWebVitalSummaryInput[] | null | undefined,
): AdminWebVitalSummaryMetric[] {
  const rowsByMetric = new Map(
    (rows ?? [])
      .filter((row) => isAdminWebVitalTargetMetric(row.metric ?? ""))
      .map((row) => [row.metric as AdminWebVitalTargetMetric, row]),
  );

  return ADMIN_WEB_VITAL_TARGET_METRICS.map((metric) => {
    const row = rowsByMetric.get(metric);
    const sampleCount = Math.round(toNonNegativeNumber(row?.sampleCount));
    const p75Value = toOptionalNonNegativeNumber(row?.p75Value);
    const threshold = ADMIN_WEB_VITAL_TARGETS[metric].threshold;

    return {
      metric,
      label: ADMIN_WEB_VITAL_TARGETS[metric].label,
      threshold,
      sampleCount,
      p75Value,
      goodCount: Math.round(toNonNegativeNumber(row?.goodCount)),
      needsImprovementCount: Math.round(toNonNegativeNumber(row?.needsImprovementCount)),
      poorCount: Math.round(toNonNegativeNumber(row?.poorCount)),
      status:
        sampleCount === 0 || p75Value === null
          ? "unknown"
          : sampleCount < ADMIN_WEB_VITAL_MIN_SAMPLE_COUNT
            ? "insufficient_sample"
            : p75Value <= threshold
              ? "met"
              : "exceeded",
    };
  });
}

const ADMIN_ROUTE_TIMING_LABELS: Record<string, string> = {
  admin: "관리 홈",
  "admin.admins": "관리자 관리",
  "admin.tasks": "작업함",
  "admin.search": "통합 검색",
  "admin.advertisement": "홈 광고 관리",
  "admin.companies": "파트너사·계정",
  "admin.categories": "카테고리",
  "admin.cycle": "기수 관리",
  "admin.cycle.mock": "기수 미리보기",
  "admin.denied": "접근 안내",
  "admin.event": "이벤트 관리",
  "admin.event.detail": "이벤트 상세",
  "admin.logs": "운영 로그",
  "admin.members": "회원 관리",
  "admin.members.mock": "회원 목록 미리보기",
  "admin.members.detail": "회원 상세",
  "admin.graduate-verifications": "수료생 인증",
  "admin.profile-photos": "프로필 사진",
  "admin.member-signup-requests": "가입 승인",
  "admin.member-signup-requests.detail": "가입 승인 상세",
  "admin.notifications": "내 알림",
  "admin.notification-templates": "알림 템플릿",
  "admin.partner-registrations": "등록 신청",
  "admin.partner-requests": "변경 요청",
  "admin.partners": "제휴처",
  "admin.partners.new": "제휴처 추가",
  "admin.partners.detail": "제휴처 상세",
  "admin.push": "발송 관리",
  "admin.reviews": "리뷰 관리",
  "admin.setup": "초기 설정",
  "admin.unknown": "기타 관리자 화면",
};

export function getAdminRouteTimingLabel(routeKey: string) {
  return ADMIN_ROUTE_TIMING_LABELS[routeKey] ?? "기타 관리자 화면";
}

export function toAdminRouteTimingSummary(
  rows: AdminRouteTimingSummaryInput[] | null | undefined,
): AdminRouteTimingSummaryMetric[] {
  return (rows ?? [])
    .map((row) => {
      const routeKey =
        typeof row.routeKey === "string" &&
        Object.prototype.hasOwnProperty.call(
          ADMIN_ROUTE_TIMING_LABELS,
          row.routeKey,
        )
          ? row.routeKey
          : "admin.unknown";
      const sampleCount = Math.round(toNonNegativeNumber(row.sampleCount));
      const p75DurationMs = toOptionalNonNegativeNumber(row.p75DurationMs);

      return {
        routeKey,
        label: getAdminRouteTimingLabel(routeKey),
        threshold: ADMIN_ROUTE_TIMING_TARGET_MS,
        sampleCount,
        p75DurationMs,
        completeCount: Math.round(toNonNegativeNumber(row.completeCount)),
        unknownCount: Math.round(toNonNegativeNumber(row.unknownCount)),
        errorCount: Math.round(toNonNegativeNumber(row.errorCount)),
        status:
          sampleCount === 0 || p75DurationMs === null
            ? "unknown"
            : sampleCount < ADMIN_ROUTE_TIMING_MIN_SAMPLE_COUNT
              ? "insufficient_sample"
              : p75DurationMs <= ADMIN_ROUTE_TIMING_TARGET_MS
                ? "met"
                : "exceeded",
      } satisfies AdminRouteTimingSummaryMetric;
    })
    .sort((left, right) => {
      if (left.p75DurationMs === null) {
        return 1;
      }
      if (right.p75DurationMs === null) {
        return -1;
      }
      return right.p75DurationMs - left.p75DurationMs;
    });
}

function normalizeRating(value: string): AdminWebVitalRating {
  if (value === "good" || value === "poor") {
    return value;
  }
  return "needs-improvement";
}

export function toAdminWebVitalProperties({
  name,
  rating,
  value,
}: AdminWebVitalInput) {
  return {
    metric: isAdminWebVitalName(name) ? name : "TTFB",
    rating: normalizeRating(rating),
    value: Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0,
  };
}
