import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { challengeMock, sessionMock, submitMock } = vi.hoisted(() => ({
  challengeMock: vi.fn(),
  sessionMock: vi.fn(),
  submitMock: vi.fn(),
}));

vi.mock("@/lib/activity-logs", () => ({
  getRequestLogContext: vi.fn(() => ({ ipAddress: "127.0.0.1" })),
  logAuthSecurity: vi.fn(),
}));
vi.mock("@/lib/graduate-verification-security", () => ({
  getGraduateApplicationSession: sessionMock,
  hashGraduateEmailIdentifier: vi.fn(() => "email-hash"),
}));
vi.mock("@/lib/graduate-verification-rate-limit", () => ({
  isGraduateVerificationBlocked: vi.fn(() => ({ ok: true, blocked: false })),
  recordGraduateVerificationAttempt: vi.fn(),
}));
vi.mock("@/lib/graduate-verification-service", () => ({
  GraduateVerificationServiceError: class extends Error { code = "submission_invalid"; },
  getVerifiedGraduateApplicationChallenge: challengeMock,
  submitGraduateVerificationRequest: submitMock,
}));
vi.mock("@/lib/request-guards", () => ({ isTrustedSameOriginRequest: vi.fn(() => true) }));

import { POST } from "../../src/app/api/graduate-verification/submit/route";

function request(body: unknown) {
  return new NextRequest("https://ssartnership.example.com/api/graduate-verification/submit", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://ssartnership.example.com" },
    body: JSON.stringify(body),
  });
}

describe("graduate verification generation-only submit route", () => {
  beforeEach(() => {
    sessionMock.mockReset().mockResolvedValue({ challengeId: "challenge", requestKind: "graduate_signup" });
    challengeMock.mockReset().mockResolvedValue({ request_kind: "graduate_signup", email_normalized: "graduate@example.com" });
    submitMock.mockReset().mockResolvedValue({ requestId: "request", status: "submitted", inferredGeneration: 15 });
  });

  it("passes a generation-only payload to the authenticated matching request kind", async () => {
    const response = await POST(request({ email: "graduate@example.com", legalName: "홍길동", generation: 15, campus: "서울", consented: true }));
    expect(response.status).toBe(200);
    expect(submitMock).toHaveBeenCalledWith(expect.objectContaining({ generation: 15, challengeId: "challenge" }));
  });

  it("fails closed when a legacy period key is supplied", async () => {
    const response = await POST(request({ email: "graduate@example.com", legalName: "홍길동", generation: 15, campus: "서울", consented: true, educationStartYear: 2026 }));
    expect(response.status).toBe(400);
    expect(submitMock).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({ message: expect.stringMatching(/새로고침/) });
  });

  it.each([null, 42, true, "invalid", []].map((body) => ({ body })))("rejects a non-object JSON body: $body", async ({ body }) => {
    expect((await POST(request(body))).status).toBe(400);
    expect(submitMock).not.toHaveBeenCalled();
  });

  it("rejects a session whose request kind does not match its verified challenge", async () => {
    challengeMock.mockResolvedValue({ request_kind: "existing_member_recovery", email_normalized: "graduate@example.com" });
    const response = await POST(request({ email: "graduate@example.com", legalName: "홍길동", generation: 15, campus: "서울", consented: true }));
    expect(response.status).toBe(401);
    expect(submitMock).not.toHaveBeenCalled();
  });
});
