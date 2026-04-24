export type SmokeRoute = {
  path: string;
  expected: RegExp;
};

export type RedirectRoute = {
  path: string;
  expectedPath: string;
};

export const publicSmokeRoutes: SmokeRoute[] = [
  { path: "/", expected: /카테고리별 혜택|Directory/ },
  { path: "/campuses/seoul", expected: /서울 캠퍼스|제휴 혜택/ },
  { path: "/events/signup-reward", expected: /이벤트|가입|리워드/ },
  { path: "/events/review-reward", expected: /이벤트|리뷰|리워드/ },
  { path: "/legal/service", expected: /서비스 이용약관/ },
  { path: "/legal/privacy", expected: /개인정보/ },
  { path: "/legal/marketing", expected: /마케팅/ },
  { path: "/partners/health-001", expected: /바디라인 피트니스|혜택/ },
  { path: "/suggest", expected: /제휴 제안|제안/ },
  { path: "/support/bug-report", expected: /버그|문의|제보/ },
  { path: "/verify/invalid-token", expected: /SSAFY QR 검증|검증 실패/ },
];

export const authSmokeRoutes: SmokeRoute[] = [
  { path: "/auth/login", expected: /로그인/ },
  { path: "/auth/signup", expected: /회원가입/ },
  { path: "/auth/reset", expected: /비밀번호|재설정/ },
  { path: "/auth/reset/complete", expected: /비밀번호|재설정|토큰/ },
  { path: "/auth/change-password", expected: /로그인|비밀번호/ },
  { path: "/auth/consent", expected: /로그인|약관|동의/ },
  { path: "/partner/login", expected: /협력사|로그인|포털/ },
  { path: "/partner/reset", expected: /비밀번호|재설정/ },
  { path: "/partner/change-password", expected: /협력사|로그인|비밀번호/ },
  { path: "/partner/setup", expected: /초기 설정|협력사|포털/ },
  {
    path: "/partner/setup/mock-partner-setup-cafe-haeon",
    expected: /카페해온|초기 설정/,
  },
  { path: "/partner/support", expected: /문의|지원|협력사/ },
  { path: "/admin/login", expected: /관리자 로그인/ },
];

export const memberProtectedRoutes: RedirectRoute[] = [
  { path: "/certification", expectedPath: "/auth/login" },
  { path: "/notifications", expectedPath: "/auth/login" },
];

export const partnerProtectedRoutes: RedirectRoute[] = [
  { path: "/partner", expectedPath: "/partner/login" },
  { path: "/partner/notifications", expectedPath: "/partner/login" },
  {
    path: "/partner/services/mock-partner-service-cafe-haeon-main",
    expectedPath: "/partner/login",
  },
  {
    path: "/partner/services/mock-partner-service-cafe-haeon-main/request",
    expectedPath: "/partner/login",
  },
];

export const adminProtectedRoutes: RedirectRoute[] = [
  { path: "/admin", expectedPath: "/admin/login" },
  { path: "/admin/advertisement", expectedPath: "/admin/login" },
  { path: "/admin/companies", expectedPath: "/admin/login" },
  { path: "/admin/cycle", expectedPath: "/admin/login" },
  { path: "/admin/event", expectedPath: "/admin/login" },
  { path: "/admin/event/signup-reward", expectedPath: "/admin/login" },
  { path: "/admin/logs", expectedPath: "/admin/login" },
  { path: "/admin/members", expectedPath: "/admin/login" },
  { path: "/admin/members/mock", expectedPath: "/admin/login" },
  { path: "/admin/notifications", expectedPath: "/admin/login" },
  { path: "/admin/partners", expectedPath: "/admin/login" },
  {
    path: "/admin/partners/mock-partner-service-cafe-haeon-main",
    expectedPath: "/admin/login",
  },
  { path: "/admin/partners/new", expectedPath: "/admin/login" },
  { path: "/admin/promotions", expectedPath: "/admin/login" },
  { path: "/admin/push", expectedPath: "/admin/login" },
  { path: "/admin/reviews", expectedPath: "/admin/login" },
  { path: "/admin/style-guide", expectedPath: "/admin/login" },
];
