export type RedirectRoute = {
  path: string;
  expectedPath: string;
};

export const memberProtectedRoutes: RedirectRoute[] = [
  { path: "/certification", expectedPath: "/auth/login" },
  { path: "/certification/photo", expectedPath: "/auth/login" },
  { path: "/coupons", expectedPath: "/auth/login" },
  { path: "/notifications", expectedPath: "/auth/login" },
];

export const partnerProtectedRoutes: RedirectRoute[] = [
  { path: "/partner", expectedPath: "/partner/login" },
  { path: "/partner/account", expectedPath: "/partner/login" },
  { path: "/partner/notifications", expectedPath: "/partner/login" },
  { path: "/partner/plans", expectedPath: "/partner/login" },
  { path: "/partner/support", expectedPath: "/partner/login" },
  {
    path: "/partner/companies/mock-partner-company-cafe-ssafy",
    expectedPath: "/partner/login",
  },
  {
    path: "/partner/services/mock-partner-service-cafe-ssafy-yeoksam",
    expectedPath: "/partner/login",
  },
  {
    path: "/partner/services/mock-partner-service-cafe-ssafy-yeoksam/request",
    expectedPath: "/partner/login",
  },
];

export const adminProtectedRoutes: RedirectRoute[] = [
  { path: "/admin", expectedPath: "/auth/login" },
  { path: "/admin/admins", expectedPath: "/auth/login" },
  { path: "/admin/advertisement", expectedPath: "/auth/login" },
  { path: "/admin/categories", expectedPath: "/auth/login" },
  { path: "/admin/companies", expectedPath: "/auth/login" },
  { path: "/admin/cycle", expectedPath: "/auth/login" },
  { path: "/admin/event", expectedPath: "/auth/login" },
  { path: "/admin/event/signup-reward", expectedPath: "/auth/login" },
  { path: "/admin/graduate-verifications", expectedPath: "/auth/login" },
  { path: "/admin/logs", expectedPath: "/auth/login" },
  { path: "/admin/members", expectedPath: "/auth/login" },
  { path: "/admin/members/mock", expectedPath: "/auth/login" },
  { path: "/admin/notifications", expectedPath: "/auth/login" },
  { path: "/admin/partner-registrations", expectedPath: "/auth/login" },
  { path: "/admin/partner-requests", expectedPath: "/auth/login" },
  { path: "/admin/partners", expectedPath: "/auth/login" },
  {
    path: "/admin/partners/mock-partner-service-cafe-ssafy-yeoksam",
    expectedPath: "/auth/login",
  },
  { path: "/admin/partners/new", expectedPath: "/auth/login" },
  { path: "/admin/promotions", expectedPath: "/auth/login" },
  { path: "/admin/push", expectedPath: "/auth/login" },
  { path: "/admin/reviews", expectedPath: "/auth/login" },
];

export const adminGuardRoutes = [
  { path: "/admin/login" },
  ...adminProtectedRoutes.map((route) => ({ path: route.path })),
];
