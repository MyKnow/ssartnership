import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

type MockPartnerPortalModule = typeof import("../src/lib/mock/partner-portal");
type PartnerPortalModule = typeof import("../src/lib/partner-portal");
type PartnerAuthModule = typeof import("../src/lib/partner-auth");

const mockPartnerPortalModulePromise = import(
  new URL("../src/lib/mock/partner-portal.ts", import.meta.url).href
) as Promise<MockPartnerPortalModule>;
const partnerPortalModulePromise = import(
  new URL("../src/lib/partner-portal.ts", import.meta.url).href
) as Promise<PartnerPortalModule>;
const partnerAuthModulePromise = import(
  new URL("../src/lib/partner-auth.ts", import.meta.url).href
) as Promise<PartnerAuthModule>;

beforeEach(async () => {
  const { resetMockPartnerPortalStore } = await mockPartnerPortalModulePromise;
  resetMockPartnerPortalStore();
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
