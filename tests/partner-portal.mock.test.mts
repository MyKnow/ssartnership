import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

type MockPartnerPortalModule = typeof import("../src/lib/mock/partner-portal");
type MockPartnerChangeRequestModule = typeof import("../src/lib/mock/partner-change-requests");
type OperationalNotificationsModule = typeof import("../src/lib/operational-notifications");
type PartnerPlanServiceModule = typeof import("../src/lib/partner-plan-service");
type PartnerPortalModule = typeof import("../src/lib/partner-portal");
type PartnerAuthModule = typeof import("../src/lib/partner-auth");

process.env.NEXT_PUBLIC_DATA_SOURCE = process.env.NEXT_PUBLIC_DATA_SOURCE ?? "mock";
process.env.NEXT_PUBLIC_PARTNER_PORTAL_DATA_SOURCE =
  process.env.NEXT_PUBLIC_PARTNER_PORTAL_DATA_SOURCE ?? "mock";

const mockPartnerPortalModulePromise = import(
  new URL("../src/lib/mock/partner-portal.ts", import.meta.url).href
) as Promise<MockPartnerPortalModule>;
const partnerPortalModulePromise = import(
  new URL("../src/lib/partner-portal.ts", import.meta.url).href
) as Promise<PartnerPortalModule>;
const mockPartnerChangeRequestModulePromise = import(
  new URL("../src/lib/mock/partner-change-requests.ts", import.meta.url).href
) as Promise<MockPartnerChangeRequestModule>;
const operationalNotificationsModulePromise = import(
  new URL("../src/lib/operational-notifications.ts", import.meta.url).href
) as Promise<OperationalNotificationsModule>;
const partnerPlanServiceModulePromise = import(
  new URL("../src/lib/partner-plan-service.ts", import.meta.url).href
) as Promise<PartnerPlanServiceModule>;
const partnerAuthModulePromise = import(
  new URL("../src/lib/partner-auth.ts", import.meta.url).href
) as Promise<PartnerAuthModule>;

beforeEach(async () => {
  const { resetMockPartnerPortalStore } = await mockPartnerPortalModulePromise;
  const { resetMockPartnerChangeRequestStore } =
    await mockPartnerChangeRequestModulePromise;
  resetMockPartnerPortalStore();
  resetMockPartnerChangeRequestStore();
});

test("lists seeded partner portal demo setups", async () => {
  const { listMockPartnerPortalSetups } = await mockPartnerPortalModulePromise;
  const setups = await listMockPartnerPortalSetups();

  assert.equal(setups.length, 2);
  assert.deepStrictEqual(
    setups.map((setup) => setup.companyName),
    ["카페 싸피", "어반짐 역삼"],
  );
  assert.deepStrictEqual(
    setups.map((setup) => setup.isSetupComplete),
    [false, true],
  );
});

test("returns setup context for a seeded token", async () => {
  const {
    getMockPartnerPortalSetupContext,
    mockPartnerPortalSetupTokens,
  } = await mockPartnerPortalModulePromise;
  const context = await getMockPartnerPortalSetupContext(
    mockPartnerPortalSetupTokens[0].token,
  );

  assert.ok(context);
  assert.equal(context?.company.name, "카페 싸피");
  assert.equal(context?.account.loginId, "partner@cafessafy.example");
  assert.equal(context?.company.services.length, 6);
  assert.equal(context?.isSetupComplete, false);
});

test("completes initial setup with a password only", async () => {
  const {
    completeMockPartnerPortalInitialSetup,
    getMockPartnerPortalSetupContext,
    mockPartnerPortalSetupTokens,
  } = await mockPartnerPortalModulePromise;
  const token = mockPartnerPortalSetupTokens[0].token;
  const result = await completeMockPartnerPortalInitialSetup({
    token,
    password: "Partner!123",
    confirmPassword: "Partner!123",
  });

  assert.equal(result.token, token);
  assert.equal(result.companyId, "mock-partner-company-cafe-ssafy");

  const updatedContext = await getMockPartnerPortalSetupContext(token);
  assert.equal(updatedContext?.isSetupComplete, true);
  assert.equal(updatedContext?.account.mustChangePassword, false);
  assert.ok(updatedContext?.account.emailVerifiedAt);
  assert.ok(updatedContext?.account.initialSetupCompletedAt);
});

test("rejects password mismatch", async () => {
  const {
    completeMockPartnerPortalInitialSetup,
    mockPartnerPortalSetupTokens,
  } = await mockPartnerPortalModulePromise;
  const { PartnerPortalSetupError } = await partnerPortalModulePromise;
  try {
    await completeMockPartnerPortalInitialSetup({
      token: mockPartnerPortalSetupTokens[0].token,
      password: "Partner!123",
      confirmPassword: "Partner!1234",
    });
    assert.fail("password_mismatch 오류가 발생해야 합니다.");
  } catch (error) {
    assert.ok(error instanceof PartnerPortalSetupError);
    const setupError = error as InstanceType<typeof PartnerPortalSetupError>;
    assert.equal(setupError.code, "password_mismatch");
  }
});

test("requires initial setup before partner login", async () => {
  const { authenticatePartnerPortalLogin, PartnerPortalLoginError } =
    await partnerAuthModulePromise;
  const { mockPartnerPortalSetupTokens } = await mockPartnerPortalModulePromise;

  try {
    await authenticatePartnerPortalLogin(
      mockPartnerPortalSetupTokens[0].loginId,
      "Partner!123",
    );
    assert.fail("setup_required 오류가 발생해야 합니다.");
  } catch (error) {
    assert.ok(error instanceof PartnerPortalLoginError);
    const loginError = error as InstanceType<typeof PartnerPortalLoginError>;
    assert.equal(loginError.code, "setup_required");
  }
});

test("authenticates a completed partner setup", async () => {
  const { authenticatePartnerPortalLogin } = await partnerAuthModulePromise;
  const {
    completeMockPartnerPortalInitialSetup,
    mockPartnerPortalSetupTokens,
  } = await mockPartnerPortalModulePromise;

  await completeMockPartnerPortalInitialSetup({
    token: mockPartnerPortalSetupTokens[0].token,
    password: "Partner!123",
    confirmPassword: "Partner!123",
  });

  const result = await authenticatePartnerPortalLogin(
    mockPartnerPortalSetupTokens[0].loginId,
    "Partner!123",
  );

  assert.equal(result.account.loginId, mockPartnerPortalSetupTokens[0].loginId);
  assert.equal(result.companyIds.length, 2);
  assert.equal(result.companyIds[0], "mock-partner-company-cafe-ssafy");
  assert.equal(result.companyIds[1], "mock-partner-company-urban-gym");
});

test("resets a partner password and forces change on the next login", async () => {
  const {
    completeMockPartnerPortalInitialSetup,
    requestMockPartnerPortalPasswordReset,
    changeMockPartnerPortalPassword,
    mockPartnerPortalSetupTokens,
  } = await mockPartnerPortalModulePromise;
  const { authenticatePartnerPortalLogin } = await partnerAuthModulePromise;

  const token = mockPartnerPortalSetupTokens[0].token;
  const setup = mockPartnerPortalSetupTokens[0];

  await completeMockPartnerPortalInitialSetup({
    token,
    password: "Partner!123",
    confirmPassword: "Partner!123",
  });

  const resetResult = await requestMockPartnerPortalPasswordReset(
    setup.loginId,
  );

  assert.equal(resetResult.account.mustChangePassword, true);
  assert.ok(resetResult.account.emailVerifiedAt);
  assert.ok(resetResult.temporaryPassword);

  const tempLoginResult = await authenticatePartnerPortalLogin(
    setup.loginId,
    resetResult.temporaryPassword,
  );
  assert.equal(tempLoginResult.account.mustChangePassword, true);
  assert.equal(tempLoginResult.companyIds[0], "mock-partner-company-cafe-ssafy");
  assert.equal(tempLoginResult.companyIds[1], "mock-partner-company-urban-gym");

  const changeResult = await changeMockPartnerPortalPassword({
    accountId: resetResult.account.id,
    currentPassword: resetResult.temporaryPassword,
    nextPassword: "Partner!456",
  });

  assert.equal(changeResult.account.mustChangePassword, false);
  assert.equal(changeResult.companyIds[0], "mock-partner-company-cafe-ssafy");
  assert.equal(changeResult.companyIds[1], "mock-partner-company-urban-gym");

  const finalLogin = await authenticatePartnerPortalLogin(
    setup.loginId,
    "Partner!456",
  );

  assert.equal(finalLogin.account.mustChangePassword, false);
  assert.equal(finalLogin.companyIds[0], "mock-partner-company-cafe-ssafy");
  assert.equal(finalLogin.companyIds[1], "mock-partner-company-urban-gym");
});

test("supports one partner account linked to multiple companies", async () => {
  const { authenticatePartnerPortalLogin } = await partnerAuthModulePromise;
  const {
    completeMockPartnerPortalInitialSetup,
    getMockPartnerPortalDashboard,
    mockPartnerPortalSetupTokens,
  } = await mockPartnerPortalModulePromise;

  await completeMockPartnerPortalInitialSetup({
    token: mockPartnerPortalSetupTokens[0].token,
    password: "Partner!123",
    confirmPassword: "Partner!123",
  });

  const result = await authenticatePartnerPortalLogin(
    mockPartnerPortalSetupTokens[0].loginId,
    "Partner!123",
  );
  const dashboard = await getMockPartnerPortalDashboard([result.companyIds[1] ?? ""]);

  assert.deepEqual(result.companyIds, [
    "mock-partner-company-cafe-ssafy",
    "mock-partner-company-urban-gym",
  ]);
  assert.equal(dashboard.totals.companyCount, 1);
  assert.equal(dashboard.companies[0]?.id, "mock-partner-company-urban-gym");
  assert.equal(dashboard.companies[0]?.services.length, 2);
});

test("builds a company dashboard with aggregate metrics and service statuses", async () => {
  const { getMockPartnerPortalDashboard } = await mockPartnerPortalModulePromise;
  const dashboard = await getMockPartnerPortalDashboard([
    "mock-partner-company-cafe-ssafy",
    "mock-partner-company-urban-gym",
  ]);

  assert.equal(dashboard.totals.companyCount, 2);
  assert.equal(dashboard.totals.serviceCount, 8);
  assert.equal(dashboard.totals.detailViews, 5650);
  assert.equal(dashboard.totals.totalClicks, 2096);
  assert.equal(dashboard.totals.reviewCount, 104);
  assert.equal(dashboard.companies[0]?.services.length, 6);
  assert.equal(dashboard.companies[1]?.services.length, 2);
  assert.equal(dashboard.companies[0]?.totals.detailViews, 3850);
  assert.equal(dashboard.companies[0]?.totals.detailUv, 1284);
  assert.equal(dashboard.companies[0]?.services[0]?.planTier, "basic");
  assert.equal(dashboard.companies[0]?.services[0]?.metrics.detailUv, 0);
  assert.equal(dashboard.companies[0]?.services[1]?.planTier, "partner");
  assert.equal(dashboard.companies[0]?.services[1]?.metrics.detailUv, 338);
  assert.equal(dashboard.companies[1]?.services[0]?.planTier, "boost");
  assert.equal(dashboard.companies[1]?.totals.totalClicks, 718);
  assert.equal(dashboard.companies[0]?.totals.reviewCount, 79);
  assert.equal(dashboard.companies[1]?.totals.reviewCount, 25);
  assert.equal(dashboard.companies[1]?.services[1]?.status, "pending");
});

test("loads mock partner plan portal data without Supabase UUID queries", async () => {
  const { getPartnerPlanPortalData } = await partnerPlanServiceModulePromise;
  const data = await getPartnerPlanPortalData(
    ["mock-partner-company-cafe-ssafy"],
    "mock-partner-account-cafe-ssafy",
  );

  assert.equal(data.brands.length, 6);
  assert.deepStrictEqual(
    data.brands.map((brand) => brand.planTier),
    ["basic", "partner", "basic", "boost", "partner", "basic"],
  );
  assert.equal(data.brands[0]?.companyId, "mock-partner-company-cafe-ssafy");
  assert.deepStrictEqual(data.requests, []);
  assert.deepStrictEqual(data.events, []);
});

test("uses default partner notification preferences in mock mode", async () => {
  const {
    getPartnerOperationalNotificationPreferences,
    listOperationalPushSubscriptionDevices,
    upsertPartnerOperationalNotificationPreferences,
  } = await operationalNotificationsModulePromise;

  const defaults = await getPartnerOperationalNotificationPreferences(
    "mock-partner-account-cafe-ssafy",
  );
  const updated = await upsertPartnerOperationalNotificationPreferences(
    "mock-partner-account-cafe-ssafy",
    { pushEnabled: false, planEnabled: false },
  );

  assert.equal(defaults.enabled, true);
  assert.equal(defaults.pushEnabled, true);
  assert.equal(updated.pushEnabled, false);
  assert.equal(updated.planEnabled, false);
  assert.equal(updated.portalEnabled, true);
  assert.deepStrictEqual(
    await listOperationalPushSubscriptionDevices({
      ownerType: "partner",
      ownerId: "mock-partner-account-cafe-ssafy",
    }),
    [],
  );
});

test("updates immediate partner fields without approval", async () => {
  const {
    updateMockPartnerImmediateFields,
    getMockPartnerChangeRequestContext,
  } = await mockPartnerChangeRequestModulePromise;

  const result = await updateMockPartnerImmediateFields({
    companyIds: ["mock-partner-company-cafe-ssafy"],
    partnerId: "mock-partner-service-cafe-ssafy-yeoksam",
    thumbnail: "https://example.com/cafe-ssafy-thumb.webp",
    images: [
      "https://example.com/cafe-ssafy-1.webp",
      "https://example.com/cafe-ssafy-2.webp",
    ],
    tags: ["모임", "디저트"],
    reservationLink: "https://booking.example.com/cafe-ssafy",
    inquiryLink: "02-999-1111",
  });

  assert.equal(result.partnerId, "mock-partner-service-cafe-ssafy-yeoksam");
  assert.equal(result.companyId, "mock-partner-company-cafe-ssafy");
  assert.equal(result.currentMediaUrls.length, 3);

  const updatedContext = await getMockPartnerChangeRequestContext(
    ["mock-partner-company-cafe-ssafy"],
    "mock-partner-service-cafe-ssafy-yeoksam",
  );

  assert.equal(updatedContext?.thumbnail, "https://example.com/cafe-ssafy-thumb.webp");
  assert.deepStrictEqual(updatedContext?.images, [
    "https://example.com/cafe-ssafy-1.webp",
    "https://example.com/cafe-ssafy-2.webp",
  ]);
  assert.deepStrictEqual(updatedContext?.tags, ["모임", "디저트"]);
  assert.equal(updatedContext?.reservationLink, "https://booking.example.com/cafe-ssafy");
  assert.equal(updatedContext?.inquiryLink, "02-999-1111");
});

test("creates and approves partner change requests for approval-required fields only", async () => {
  const {
    updateMockPartnerImmediateFields,
    createMockPartnerChangeRequest,
    approveMockPartnerChangeRequest,
    getMockPartnerChangeRequestContext,
  } = await mockPartnerChangeRequestModulePromise;

  await updateMockPartnerImmediateFields({
    companyIds: ["mock-partner-company-cafe-ssafy"],
    partnerId: "mock-partner-service-cafe-ssafy-yeoksam",
    thumbnail: "https://example.com/cafe-ssafy-thumb.webp",
    images: [
      "https://example.com/cafe-ssafy-1.webp",
      "https://example.com/cafe-ssafy-2.webp",
    ],
    tags: ["모임", "디저트"],
    reservationLink: "https://booking.example.com/cafe-ssafy",
    inquiryLink: "02-999-1111",
  });

  const currentContext = await getMockPartnerChangeRequestContext(
    ["mock-partner-company-cafe-ssafy"],
    "mock-partner-service-cafe-ssafy-yeoksam",
  );

  assert.ok(currentContext);

  const request = await createMockPartnerChangeRequest({
    companyIds: ["mock-partner-company-cafe-ssafy"],
    partnerId: "mock-partner-service-cafe-ssafy-yeoksam",
    requestedByAccountId: "mock-partner-account-cafe-ssafy",
    requestedByLoginId: "partner@cafessafy.example",
    requestedByDisplayName: "김도연",
    requestedPartnerName: "카페 싸피 역삼본점 리뉴얼",
    requestedPartnerLocation: "서울 강남구 역삼로 125",
    requestedMapUrl: "https://map.example.com/cafe-ssafy-renewal",
    requestedCampusSlugs: ["seoul", "gumi"],
    requestedConditions: [...(currentContext?.currentConditions ?? []), "평일만 사용"],
    requestedBenefits: [...(currentContext?.currentBenefits ?? []), "추가 혜택"],
    requestedAppliesTo: ["staff", "student", "graduate"],
    requestedTags: currentContext?.tags ?? [],
    requestedThumbnail: currentContext?.thumbnail ?? null,
    requestedImages: currentContext?.images ?? [],
    requestedReservationLink: currentContext?.reservationLink ?? null,
    requestedInquiryLink: currentContext?.inquiryLink ?? null,
    requestedPeriodStart: "2026-04-01",
    requestedPeriodEnd: "2026-10-31",
  });

  assert.equal(request.requestedPartnerName, "카페 싸피 역삼본점 리뉴얼");
  assert.equal(request.requestedPartnerLocation, "서울 강남구 역삼로 125");
  assert.equal(request.requestedMapUrl, "https://map.example.com/cafe-ssafy-renewal");
  assert.deepStrictEqual(request.requestedCampusSlugs, ["seoul", "gumi"]);
  assert.deepStrictEqual(request.requestedConditions, [
    ...(currentContext?.currentConditions ?? []),
    "평일만 사용",
  ]);
  assert.deepStrictEqual(request.requestedBenefits, [
    ...(currentContext?.currentBenefits ?? []),
    "추가 혜택",
  ]);
  assert.deepStrictEqual(request.requestedAppliesTo, ["staff", "student", "graduate"]);
  assert.equal(request.requestedPeriodStart, "2026-04-01");
  assert.equal(request.requestedPeriodEnd, "2026-10-31");

  await approveMockPartnerChangeRequest({
    requestId: request.id,
    adminId: "admin",
  });

  const updatedContext = await getMockPartnerChangeRequestContext(
    ["mock-partner-company-cafe-ssafy"],
    "mock-partner-service-cafe-ssafy-yeoksam",
  );

  assert.equal(updatedContext?.partnerName, "카페 싸피 역삼본점 리뉴얼");
  assert.equal(updatedContext?.partnerLocation, "서울 강남구 역삼로 125");
  assert.equal(updatedContext?.mapUrl, "https://map.example.com/cafe-ssafy-renewal");
  assert.deepStrictEqual(updatedContext?.currentCampusSlugs, ["seoul", "gumi"]);
  assert.deepStrictEqual(updatedContext?.currentConditions, [
    ...(currentContext?.currentConditions ?? []),
    "평일만 사용",
  ]);
  assert.deepStrictEqual(updatedContext?.currentBenefits, [
    ...(currentContext?.currentBenefits ?? []),
    "추가 혜택",
  ]);
  assert.deepStrictEqual(updatedContext?.currentAppliesTo, ["staff", "student", "graduate"]);
  assert.equal(updatedContext?.periodStart, "2026-04-01");
  assert.equal(updatedContext?.periodEnd, "2026-10-31");
  assert.equal(updatedContext?.thumbnail, "https://example.com/cafe-ssafy-thumb.webp");
  assert.deepStrictEqual(updatedContext?.images, [
    "https://example.com/cafe-ssafy-1.webp",
    "https://example.com/cafe-ssafy-2.webp",
  ]);
  assert.deepStrictEqual(updatedContext?.tags, ["모임", "디저트"]);
  assert.equal(updatedContext?.reservationLink, "https://booking.example.com/cafe-ssafy");
  assert.equal(updatedContext?.inquiryLink, "02-999-1111");
});

test("splits signed tokens from the last dot", async () => {
  const { splitSignedToken } = await import("../src/lib/hmac.js");
  const token = `{"loginId":"partner@cafessafy.example"}.abcdef123456`;
  const parts = splitSignedToken(token);

  assert.deepStrictEqual(parts, [
    '{"loginId":"partner@cafessafy.example"}',
    "abcdef123456",
  ]);
});
