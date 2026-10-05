import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSignedUserSession: vi.fn(),
  setUserSession: vi.fn(),
  getPartnerSession: vi.fn(),
  setPartnerSession: vi.fn(),
  changePartnerPortalPassword: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
  verifyPassword: vi.fn(),
}));

vi.mock("@/lib/activity-logs", () => ({
  getRequestLogContext: () => ({ ipAddress: null }),
  logAuthSecurity: vi.fn(),
}));
vi.mock("@/lib/member-gate-revalidation", () => ({ revalidateMemberGatePaths: vi.fn() }));
vi.mock("@/lib/user-auth", () => ({
  getSignedUserSession: mocks.getSignedUserSession,
  setUserSession: mocks.setUserSession,
}));
vi.mock("@/lib/partner-session", () => ({
  getPartnerSession: mocks.getPartnerSession,
  setPartnerSession: mocks.setPartnerSession,
}));
vi.mock("@/lib/partner-auth", () => ({ changePartnerPortalPassword: mocks.changePartnerPortalPassword }));
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseAdminClient: () => ({ from: mocks.from, rpc: mocks.rpc }),
}));
vi.mock("@/lib/password", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/lib/password")>();
  return {
    isValidPassword: actual.isValidPassword,
    hashPassword: () => ({ hash: "next-hash", salt: "next-salt" }),
    verifyPassword: mocks.verifyPassword,
  };
});
vi.mock("@/lib/request-guards", () => ({ isTrustedSameOriginRequest: () => true }));
vi.mock("@/lib/member-auth-security", () => ({
  delayMemberAuthAttempt: vi.fn(),
  getMemberAuthAttemptScope: vi.fn(),
  getMemberAuthBlockingState: async () => ({ ok: true, blocked: false }),
  recordMemberAuthAttempt: vi.fn(async () => undefined),
}));
vi.mock("@/lib/partner-auth-security", () => ({
  delayPartnerAuthAttempt: vi.fn(),
  getPartnerAuthAttemptScope: vi.fn(),
  getPartnerAuthBlockingState: async () => ({ ok: true, blocked: false }),
  recordPartnerAuthAttempt: vi.fn(async () => undefined),
}));

import { POST as changeMemberPassword } from "../../src/app/api/mm/change-password/route";
import { POST as changePartnerPassword } from "../../src/app/api/partner/change-password/route";
import { validateAuthPasswordChangeDraft } from "../../src/lib/auth-form-validation";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSignedUserSession.mockResolvedValue({ userId: "member-1", authenticationMethod: "email" });
  mocks.getPartnerSession.mockResolvedValue({ accountId: "account-1", loginId: "partner", companyIds: ["company-1"] });
  mocks.verifyPassword.mockReturnValue(true);
  const query = {
    select: () => query,
    eq: () => query,
    is: () => query,
    maybeSingle: async () => ({ data: { id: "member-1", password_hash: "old-hash", password_salt: "old-salt" } }),
  };
  mocks.from.mockReturnValue(query);
  mocks.rpc.mockResolvedValue({ data: "member-1", error: null });
  mocks.changePartnerPortalPassword.mockResolvedValue({
    account: { id: "account-1", loginId: "partner", displayName: "파트너", mustChangePassword: false },
    companyIds: ["company-1"],
  });
});

describe.each([
  { label: "회원", route: changeMemberPassword },
  { label: "파트너", route: changePartnerPassword },
])("$label 비밀번호 변경 입력", ({ route }) => {
  function request(nextPassword: unknown) {
    return new Request("https://example.test/api/change-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ currentPassword: " Current!123 ", nextPassword }),
    });
  }

  test.each([" Valid!123", "Valid!123 ", "Valid!123\n", "\tValid!123", ` ${"a".repeat(61)}A1!`])(
    "화면이 거부하는 새 비밀번호 원문을 서버도 변경 없이 거부한다: %j",
    async (nextPassword) => {
      expect(validateAuthPasswordChangeDraft({ currentPassword: "Current!123", nextPassword, validatePolicy: true }).firstInvalidField).toBe("nextPassword");
      const response = await route(request(nextPassword));
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ error: "invalid_password" });
      expect(mocks.from).not.toHaveBeenCalled();
      expect(mocks.rpc).not.toHaveBeenCalled();
      expect(mocks.changePartnerPortalPassword).not.toHaveBeenCalled();
      expect(mocks.setUserSession).not.toHaveBeenCalled();
      expect(mocks.setPartnerSession).not.toHaveBeenCalled();
    },
  );

  test.each([["Valid!123"], { password: "Valid!123" }, 12345678].map((nextPassword) => ({ nextPassword })))("문자열이 아닌 새 비밀번호를 거부한다: $nextPassword", async ({ nextPassword }) => {
    const response = await route(request(nextPassword));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "invalid_password" });
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.changePartnerPortalPassword).not.toHaveBeenCalled();
    expect(mocks.setUserSession).not.toHaveBeenCalled();
    expect(mocks.setPartnerSession).not.toHaveBeenCalled();
  });

  test("유효한 새 비밀번호는 처리하고 기존 현재 비밀번호 정규화는 유지한다", async () => {
    const response = await route(request("Valid!123"));
    expect(response.status).toBe(200);
    if (route === changeMemberPassword) {
      expect(mocks.verifyPassword).toHaveBeenCalledWith("Current!123", "old-salt", "old-hash");
      expect(mocks.rpc).toHaveBeenCalledOnce();
      expect(mocks.setUserSession).toHaveBeenCalledOnce();
    } else {
      expect(mocks.changePartnerPortalPassword).toHaveBeenCalledWith({ accountId: "account-1", currentPassword: "Current!123", nextPassword: "Valid!123" });
      expect(mocks.setPartnerSession).toHaveBeenCalledOnce();
    }
  });
});
