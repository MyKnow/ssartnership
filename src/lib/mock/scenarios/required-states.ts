import type {
  MockRequiredStateKey,
  MockRouteInventoryItem,
  MockViewportKey,
} from "./types.ts";

export type MockRequiredStateDefinition = {
  key: MockRequiredStateKey;
  label: string;
  description: string;
};

export const mockViewportPolicy = [
  {
    key: "mobile-320",
    width: 320,
    label: "320px 모바일",
    requiredForCapture: true,
  },
  {
    key: "mobile-360",
    width: 360,
    label: "360px 모바일",
    requiredForCapture: true,
  },
  {
    key: "mobile-390",
    width: 390,
    label: "390px 모바일",
    requiredForCapture: true,
  },
  {
    key: "tablet-768",
    width: 768,
    label: "768px 태블릿",
    requiredForCapture: true,
  },
  {
    key: "tablet-820",
    width: 820,
    label: "820px 태블릿",
    requiredForCapture: true,
  },
  {
    key: "tablet-1024",
    width: 1024,
    label: "1024px 태블릿",
    requiredForCapture: true,
  },
  {
    key: "desktop-1366",
    width: 1366,
    label: "1366px 데스크탑",
    requiredForCapture: true,
  },
  {
    key: "desktop-1440",
    width: 1440,
    label: "1440px 데스크탑",
    requiredForCapture: true,
  },
  {
    key: "desktop-1536",
    width: 1536,
    label: "1536px 데스크탑",
    requiredForCapture: true,
  },
] as const satisfies Array<{
  key: MockViewportKey;
  width: number;
  label: string;
  requiredForCapture: boolean;
}>;

export const mockRequiredStateDefinitions = [
  {
    key: "default",
    label: "기본",
    description: "대표 데이터가 정상 표시되는 기본 상태입니다.",
  },
  {
    key: "empty",
    label: "빈 상태",
    description: "목록, 검색 결과, 연결 데이터가 없을 때의 상태입니다.",
  },
  {
    key: "many",
    label: "다건 데이터",
    description: "여러 행/카드/섹션이 반복될 때의 스캔성과 간격을 봅니다.",
  },
  {
    key: "loading",
    label: "로딩",
    description: "초기 로딩, refetch, skeleton, 비활성 컨트롤 상태입니다.",
  },
  {
    key: "error",
    label: "오류",
    description: "데이터 조회나 서버 작업 실패 시 사용자 메시지 상태입니다.",
  },
  {
    key: "validation-error",
    label: "검증 오류",
    description: "필수값, 형식 오류, 첫 오류 focus/scroll 상태입니다.",
  },
  {
    key: "unauthorized",
    label: "비로그인",
    description: "로그인이 필요한 화면에 세션 없이 접근한 상태입니다.",
  },
  {
    key: "forbidden",
    label: "권한 없음",
    description: "로그인은 되었지만 접근 권한이 없는 상태입니다.",
  },
  {
    key: "expired",
    label: "만료",
    description: "토큰, 기간, 플랜, 이벤트가 만료된 상태입니다.",
  },
  {
    key: "pending",
    label: "대기",
    description: "승인 대기, 요청 처리 중, 검토 중 상태입니다.",
  },
  {
    key: "rejected",
    label: "반려",
    description: "관리자/파트너 검토가 반려된 상태입니다.",
  },
  {
    key: "success",
    label: "성공",
    description: "저장, 제출, 승인, 완료 상태입니다.",
  },
  {
    key: "redirect",
    label: "리다이렉트",
    description: "호환 URL이나 권한 흐름에서 다른 경로로 이동하는 상태입니다.",
  },
  {
    key: "long-korean",
    label: "긴 한국어",
    description: "실제 한국어 문장 길이에서 줄바꿈과 line clamp를 확인합니다.",
  },
  {
    key: "long-url",
    label: "긴 URL",
    description: "긴 링크, 이메일, 식별자가 컨테이너를 밀지 않는지 확인합니다.",
  },
  {
    key: "mobile-overflow",
    label: "모바일 오버플로",
    description: "320/360/390px 폭에서 overflow-x와 비정상 줄바꿈을 확인합니다.",
  },
  {
    key: "image-gallery",
    label: "이미지",
    description: "대표 이미지, 추가 이미지, 캐러셀, crop dialog 상태입니다.",
  },
  {
    key: "broken-image",
    label: "이미지 오류",
    description: "깨진 이미지, 미지원 파일, 업로드 실패 상태입니다.",
  },
  {
    key: "async-pending",
    label: "동작 중",
    description: "클릭, 저장, 필터, 페이지 이동 직후 pending feedback입니다.",
  },
  {
    key: "pagination",
    label: "페이지네이션",
    description: "더보기, 페이지 이동, 느린 목록 갱신 상태입니다.",
  },
  {
    key: "filter",
    label: "필터",
    description: "검색, 정렬, 세그먼트 필터, 결과 없음 상태입니다.",
  },
  {
    key: "locked-metric",
    label: "잠긴 지표",
    description: "플랜 권한에 따라 일부 지표가 숨겨지거나 잠긴 상태입니다.",
  },
  {
    key: "payment-pending",
    label: "결제 대기",
    description: "계좌이체 입금 확인, 미납, 승인 대기 상태입니다.",
  },
  {
    key: "billing-profile",
    label: "증빙 프로필",
    description: "세금계산서/증빙 정보 저장과 재사용 상태입니다.",
  },
  {
    key: "setup-token",
    label: "설정 토큰",
    description: "초기 설정/초대 토큰이 유효하거나 만료된 상태입니다.",
  },
] as const satisfies MockRequiredStateDefinition[];

const defaultRequiredStateKeys = [
  "default",
  "long-korean",
  "mobile-overflow",
] as const satisfies MockRequiredStateKey[];

const storybookViewportKeys = [
  "mobile-360",
  "tablet-820",
  "desktop-1366",
] as const satisfies MockViewportKey[];

const routeOwnedStateOverrides: Partial<
  Record<string, MockRequiredStateKey[]>
> = {
  "/auth/signup/graduate": [
    "default",
    "validation-error",
    "pending",
    "success",
    "rejected",
    "expired",
    "long-korean",
    "mobile-overflow",
    "image-gallery",
    "broken-image",
    "async-pending",
  ],
  "/auth/graduate/setup": [
    "default",
    "validation-error",
    "expired",
    "success",
    "long-korean",
    "mobile-overflow",
    "async-pending",
  ],
  "/certification/photo": [
    "default",
    "validation-error",
    "pending",
    "rejected",
    "success",
    "long-korean",
    "mobile-overflow",
    "image-gallery",
    "broken-image",
    "async-pending",
  ],
  "/admin/graduate-verifications": [
    "default",
    "empty",
    "pending",
    "rejected",
    "success",
    "long-korean",
    "mobile-overflow",
    "forbidden",
  ],
  // Category lookup fails soft and has no route loading/error surface. Submitted
  // request review states belong to admin queues, while action feedback remains here.
  "/partner-registration": [
    "default",
    "long-korean",
    "mobile-overflow",
    "validation-error",
    "error",
    "success",
    "async-pending",
    "image-gallery",
    "broken-image",
  ],
  // Auth redirects/not-found and route skeletons are server-boundary concerns.
  // Billing/payment states belong to the company plans screen, not the flat dashboard.
  "/partner/companies/[companyId]": [
    "default",
    "empty",
    "many",
    "pending",
    "rejected",
    "long-korean",
    "mobile-overflow",
    "locked-metric",
  ],
};

const collectionRoutes = new Set([
  "/admin/logs",
  "/admin/members",
  "/admin/partners",
  "/admin/partner-requests",
  "/admin/categories",
  "/admin/reviews",
  "/admin/notifications",
  "/partner/notifications",
]);

export const requiredCaptureViewportKeys = mockViewportPolicy
  .filter((viewport) => viewport.requiredForCapture)
  .map((viewport) => viewport.key);

function uniqueStateKeys(keys: MockRequiredStateKey[]) {
  return [...new Set(keys)];
}

export function getPolicyViewportKeysForRoute(
  route: Pick<MockRouteInventoryItem, "dataSources">,
): MockViewportKey[] {
  if (route.dataSources.includes("storybook")) {
    return [...storybookViewportKeys];
  }
  return [...requiredCaptureViewportKeys];
}

export function getRequiredStateKeysForRoute(
  route: Pick<
    MockRouteInventoryItem,
    "routePath" | "routeKind" | "authScope" | "dataSources"
  >,
): MockRequiredStateKey[] {
  if (route.routeKind === "compat-redirect") {
    return ["redirect"];
  }

  const routeOwnedStates = routeOwnedStateOverrides[route.routePath];
  if (routeOwnedStates) {
    return [...routeOwnedStates];
  }

  const keys: MockRequiredStateKey[] = [...defaultRequiredStateKeys];

  if (route.authScope !== "public") {
    keys.push("unauthorized", "forbidden");
  }
  if (route.authScope === "setup-token" || route.routePath.includes("[token]")) {
    keys.push("setup-token", "expired");
  }
  if (
    route.dataSources.includes("repository") ||
    route.dataSources.includes("service") ||
    route.dataSources.includes("api-route")
  ) {
    keys.push("loading", "error");
  }
  if (route.dataSources.includes("redirect")) {
    keys.push("redirect");
  }
  if (
    route.routePath.includes("registration") ||
    route.routePath.includes("suggest") ||
    route.routePath.includes("request") ||
    route.routePath.includes("new") ||
    route.routePath.includes("setup")
  ) {
    keys.push("validation-error", "success", "async-pending");
  }
  if (
    route.routePath.includes("partners") ||
    route.routePath.includes("services") ||
    route.routePath.includes("reviews") ||
    route.routePath.includes("registration")
  ) {
    keys.push("image-gallery", "broken-image");
  }
  if (collectionRoutes.has(route.routePath)) {
    keys.push("many", "empty", "filter", "pagination");
  }
  if (
    route.routePath.includes("registration") ||
    route.routePath.includes("partner-requests")
  ) {
    keys.push("pending", "rejected");
  }
  if (route.routePath.includes("plans") || route.routePath.includes("companies")) {
    keys.push("locked-metric", "payment-pending", "billing-profile");
  }
  if (route.routePath.includes("notifications") || route.routePath.includes("push")) {
    keys.push("async-pending");
  }
  if (route.routePath.includes("login") || route.routePath.includes("reset")) {
    keys.push("validation-error", "async-pending");
  }
  if (route.routePath.includes("[id]") || route.routePath.includes("[partnerId]")) {
    keys.push("long-url");
  }
  if (route.routePath.includes("event")) {
    keys.push("expired", "success");
  }
  if (route.routePath.includes("support")) {
    keys.push("success", "long-url");
  }

  return uniqueStateKeys(keys);
}

export function listMockRequiredStateDefinitions() {
  return mockRequiredStateDefinitions.map((definition) => ({ ...definition }));
}
