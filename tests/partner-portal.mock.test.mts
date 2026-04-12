import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

type MockPartnerPortalModule = typeof import("../src/lib/mock/partner-portal");
type MockPartnerChangeRequestModule = typeof import("../src/lib/mock/partner-change-requests");
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
    ["카페 해온", "어반짐 역삼"],
  );
  assert.deepStrictEqual(
    setups.map((setup) => setup.demoVerificationCode),
    ["HAEON-2041", "URBAN-7782"],
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
  assert.equal(context?.company.name, "카페 해온");
  assert.equal(context?.account.loginId, "partner@cafehaeon.example");
  assert.equal(context?.company.services.length, 3);
  assert.equal(context?.isSetupComplete, false);
  assert.equal(context?.demoVerificationCode, "HAEON-2041");
});

test("completes initial setup with a matching code and password", async () => {
  const {
    completeMockPartnerPortalInitialSetup,
    getMockPartnerPortalSetupContext,
    mockPartnerPortalSetupTokens,
  } = await mockPartnerPortalModulePromise;
  const token = mockPartnerPortalSetupTokens[0].token;
  const setup = mockPartnerPortalSetupTokens[0];
  const result = await completeMockPartnerPortalInitialSetup({
    token,
    verificationCode: setup.demoVerificationCode ?? "",
    password: "Partner!123",
    confirmPassword: "Partner!123",
  });

  assert.equal(result.token, token);
  assert.equal(result.companyId, "mock-partner-company-cafe-haeon");

  const updatedContext = await getMockPartnerPortalSetupContext(token);
  assert.equal(updatedContext?.isSetupComplete, true);
  assert.equal(updatedContext?.account.mustChangePassword, false);
  assert.ok(updatedContext?.account.emailVerifiedAt);
  assert.ok(updatedContext?.account.initialSetupCompletedAt);
});

test("rejects invalid verification code", async () => {
  const {
    completeMockPartnerPortalInitialSetup,
    mockPartnerPortalSetupTokens,
  } = await mockPartnerPortalModulePromise;
  const { PartnerPortalSetupError } = await partnerPortalModulePromise;
  try {
    await completeMockPartnerPortalInitialSetup({
      token: mockPartnerPortalSetupTokens[1].token,
      verificationCode: "WRONG-CODE",
      password: "Partner!123",
      confirmPassword: "Partner!123",
    });
    assert.fail("invalid_code 오류가 발생해야 합니다.");
  } catch (error) {
    assert.ok(error instanceof PartnerPortalSetupError);
    const setupError = error as InstanceType<typeof PartnerPortalSetupError>;
    assert.equal(setupError.code, "invalid_code");
  }
});

test("rejects password mismatch", async () => {
  const {
    completeMockPartnerPortalInitialSetup,
    mockPartnerPortalSetupTokens,
  } = await mockPartnerPortalModulePromise;
  const { PartnerPortalSetupError } = await partnerPortalModulePromise;
  try {
    await completeMockPartnerPortalInitialSetup({
      token: mockPartnerPortalSetupTokens[1].token,
      verificationCode:
        mockPartnerPortalSetupTokens[1].demoVerificationCode ?? "",
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
    verificationCode: mockPartnerPortalSetupTokens[0].demoVerificationCode ?? "",
    password: "Partner!123",
    confirmPassword: "Partner!123",
  });

  const result = await authenticatePartnerPortalLogin(
    mockPartnerPortalSetupTokens[0].loginId,
    "Partner!123",
  );

  assert.equal(result.account.loginId, mockPartnerPortalSetupTokens[0].loginId);
  assert.equal(result.companyIds.length, 1);
  assert.equal(result.companyIds[0], "mock-partner-company-cafe-haeon");
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
    verificationCode: setup.demoVerificationCode ?? "",
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
  assert.equal(tempLoginResult.companyIds[0], "mock-partner-company-cafe-haeon");

  const changeResult = await changeMockPartnerPortalPassword({
    accountId: resetResult.account.id,
    currentPassword: resetResult.temporaryPassword,
    nextPassword: "Partner!456",
  });

  assert.equal(changeResult.account.mustChangePassword, false);
  assert.equal(changeResult.companyIds[0], "mock-partner-company-cafe-haeon");

  const finalLogin = await authenticatePartnerPortalLogin(
    setup.loginId,
    "Partner!456",
  );

  assert.equal(finalLogin.account.mustChangePassword, false);
  assert.equal(finalLogin.companyIds[0], "mock-partner-company-cafe-haeon");
});

test("builds a company dashboard with aggregate metrics only", async () => {
  const { getMockPartnerPortalDashboard } = await mockPartnerPortalModulePromise;
  const dashboard = await getMockPartnerPortalDashboard([
    "mock-partner-company-cafe-haeon",
    "mock-partner-company-urban-gym",
  ]);

  assert.equal(dashboard.totals.companyCount, 2);
  assert.equal(dashboard.totals.serviceCount, 5);
  assert.equal(dashboard.totals.detailViews, 3750);
  assert.equal(dashboard.totals.totalClicks, 1460);
  assert.equal(dashboard.companies[0]?.services.length, 3);
  assert.equal(dashboard.companies[1]?.services.length, 2);
  assert.equal(dashboard.companies[0]?.totals.detailViews, 1950);
  assert.equal(dashboard.companies[1]?.totals.totalClicks, 718);
});

test("creates and approves partner change requests with media and period changes", async () => {
  const {
    createMockPartnerChangeRequest,
    approveMockPartnerChangeRequest,
    getMockPartnerChangeRequestContext,
  } = await mockPartnerChangeRequestModulePromise;

  const currentContext = await getMockPartnerChangeRequestContext(
    ["mock-partner-company-cafe-haeon"],
    "mock-partner-service-cafe-haeon-main",
  );

  assert.ok(currentContext);

  const request = await createMockPartnerChangeRequest({
    companyIds: ["mock-partner-company-cafe-haeon"],
    partnerId: "mock-partner-service-cafe-haeon-main",
    requestedByAccountId: "mock-partner-account-cafe-haeon",
    requestedByLoginId: "partner@cafehaeon.example",
    requestedByDisplayName: "김도연",
    requestedPartnerName: "카페 해온 본점 리뉴얼",
    requestedPartnerLocation: "서울 강남구 역삼로 125",
    requestedMapUrl: "https://map.example.com/cafe-haeon-renewal",
    requestedConditions: currentContext?.currentConditions ?? [],
    requestedBenefits: currentContext?.currentBenefits ?? [],
    requestedAppliesTo: currentContext?.currentAppliesTo ?? [],
    requestedTags: ["모임", "디저트"],
    requestedThumbnail: "https://example.com/cafe-haeon-thumb.webp",
    requestedImages: [
      "https://example.com/cafe-haeon-1.webp",
      "https://example.com/cafe-haeon-2.webp",
    ],
    requestedReservationLink: "https://booking.example.com/cafe-haeon",
    requestedInquiryLink: "02-999-1111",
    requestedPeriodStart: "2026-04-01",
    requestedPeriodEnd: "2026-10-31",
  });

  assert.equal(request.requestedThumbnail, "https://example.com/cafe-haeon-thumb.webp");
  assert.equal(request.requestedImages.length, 2);
  assert.deepStrictEqual(request.requestedTags, ["모임", "디저트"]);
  assert.equal(request.requestedPartnerName, "카페 해온 본점 리뉴얼");
  assert.equal(request.requestedPartnerLocation, "서울 강남구 역삼로 125");
  assert.equal(request.requestedMapUrl, "https://map.example.com/cafe-haeon-renewal");
  assert.equal(request.requestedReservationLink, "https://booking.example.com/cafe-haeon");
  assert.equal(request.requestedInquiryLink, "02-999-1111");
  assert.equal(request.requestedPeriodStart, "2026-04-01");
  assert.equal(request.requestedPeriodEnd, "2026-10-31");

  await approveMockPartnerChangeRequest({
    requestId: request.id,
    adminId: "admin",
  });

  const updatedContext = await getMockPartnerChangeRequestContext(
    ["mock-partner-company-cafe-haeon"],
    "mock-partner-service-cafe-haeon-main",
  );

  assert.equal(updatedContext?.thumbnail, "https://example.com/cafe-haeon-thumb.webp");
  assert.deepStrictEqual(updatedContext?.images, [
    "https://example.com/cafe-haeon-1.webp",
    "https://example.com/cafe-haeon-2.webp",
  ]);
  assert.equal(updatedContext?.partnerName, "카페 해온 본점 리뉴얼");
  assert.equal(updatedContext?.partnerLocation, "서울 강남구 역삼로 125");
  assert.equal(updatedContext?.mapUrl, "https://map.example.com/cafe-haeon-renewal");
  assert.deepStrictEqual(updatedContext?.tags, ["모임", "디저트"]);
  assert.equal(updatedContext?.reservationLink, "https://booking.example.com/cafe-haeon");
  assert.equal(updatedContext?.inquiryLink, "02-999-1111");
  assert.equal(updatedContext?.periodStart, "2026-04-01");
  assert.equal(updatedContext?.periodEnd, "2026-10-31");
});

test("splits signed tokens from the last dot", async () => {
  const { splitSignedToken } = await import("../src/lib/hmac.js");
  const token = `{"loginId":"partner@cafehaeon.example"}.abcdef123456`;
  const parts = splitSignedToken(token);

  assert.deepStrictEqual(parts, [
    '{"loginId":"partner@cafehaeon.example"}',
    "abcdef123456",
  ]);
});
