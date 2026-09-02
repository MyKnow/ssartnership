import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  consumeQuotaMock,
  getPartnerSessionMock,
  isCompanyAllowedMock,
  isTrustedSameOriginRequestMock,
  lookupNtsBusinessStatusMock,
} = vi.hoisted(() => ({
  consumeQuotaMock: vi.fn(),
  getPartnerSessionMock: vi.fn(),
  isCompanyAllowedMock: vi.fn(),
  isTrustedSameOriginRequestMock: vi.fn(),
  lookupNtsBusinessStatusMock: vi.fn(),
}));

vi.mock("@/lib/nts-business-status", () => ({
  lookupNtsBusinessStatus: lookupNtsBusinessStatusMock,
}));

vi.mock("@/lib/request-guards", () => ({
  isTrustedSameOriginRequest: isTrustedSameOriginRequestMock,
}));

vi.mock("@/lib/partner-portal-scope", () => ({
  isPartnerPortalCompanyAllowed: isCompanyAllowedMock,
}));

vi.mock("@/lib/partner-session", () => ({
  getPartnerSession: getPartnerSessionMock,
}));

vi.mock("@/lib/partner-business-status-rate-limit", () => ({
  consumePartnerBusinessStatusLookupQuota: consumeQuotaMock,
}));

import { POST } from "../../src/app/api/partner/billing/business-status/route";

const routeUrl = "https://ssartnership.example.com/api/partner/billing/business-status";

function createJsonRequest(
  body: BodyInit,
  headers: Record<string, string> = {},
) {
  return new Request(routeUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://ssartnership.example.com",
      ...headers,
    },
    body,
  });
}

describe("partner business status route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isTrustedSameOriginRequestMock.mockReturnValue(true);
    getPartnerSessionMock.mockResolvedValue({
      accountId: "account-1",
      loginId: "partner-one",
      displayName: "파트너 1",
      companyIds: ["company-1"],
      mustChangePassword: false,
    });
    isCompanyAllowedMock.mockReturnValue(true);
    consumeQuotaMock.mockResolvedValue({ ok: true });
    lookupNtsBusinessStatusMock.mockResolvedValue({
      ok: true,
      businessRegistrationNumber: "2208162517",
      businessStatus: "계속사업자",
      businessStatusCode: "01",
      taxType: "부가가치세 일반과세자",
      taxTypeCode: "01",
      closedAt: null,
      raw: {},
    });
  });

  it("returns 429 for a repeated authenticated lookup before another upstream call", async () => {
    consumeQuotaMock
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false, code: "blocked" });

    const payload = JSON.stringify({
      companyId: "company-1",
      businessRegistrationNumber: "220-81-62517",
    });
    const firstResponse = await POST(createJsonRequest(payload));
    const secondResponse = await POST(createJsonRequest(payload));

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(429);
    await expect(secondResponse.json()).resolves.toEqual({
      message: "사업자 상태조회 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
    });
    expect(consumeQuotaMock).toHaveBeenNthCalledWith(1, {
      accountId: "account-1",
      companyId: "company-1",
    });
    expect(consumeQuotaMock).toHaveBeenNthCalledWith(2, {
      accountId: "account-1",
      companyId: "company-1",
    });
    expect(lookupNtsBusinessStatusMock).toHaveBeenCalledTimes(1);
  });

  it("keeps origin, authentication, and company scope ahead of quota work", async () => {
    const payload = JSON.stringify({
      companyId: "company-1",
      businessRegistrationNumber: "220-81-62517",
    });

    isTrustedSameOriginRequestMock.mockReturnValueOnce(false);
    expect((await POST(createJsonRequest(payload))).status).toBe(403);
    expect(getPartnerSessionMock).not.toHaveBeenCalled();

    getPartnerSessionMock.mockResolvedValueOnce(null);
    expect((await POST(createJsonRequest(payload))).status).toBe(401);
    expect(isCompanyAllowedMock).not.toHaveBeenCalled();

    isCompanyAllowedMock.mockReturnValueOnce(false);
    expect((await POST(createJsonRequest(payload))).status).toBe(403);
    expect(consumeQuotaMock).not.toHaveBeenCalled();
    expect(lookupNtsBusinessStatusMock).not.toHaveBeenCalled();
  });

  it("rejects an oversized declared content length with 413 before quota or upstream work", async () => {
    const response = await POST(
      createJsonRequest("{}", { "content-length": String(4 * 1024 + 1) }),
    );

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({
      message: "요청 본문이 너무 큽니다.",
    });
    expect(consumeQuotaMock).not.toHaveBeenCalled();
    expect(lookupNtsBusinessStatusMock).not.toHaveBeenCalled();
  });

  it("rejects a streamed body that crosses the byte limit with 413", async () => {
    const chunk = new TextEncoder().encode("x".repeat(2_100));
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(chunk);
        controller.enqueue(chunk);
        controller.close();
      },
    });
    const request = new Request(routeUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://ssartnership.example.com",
      },
      body,
      duplex: "half",
    } as RequestInit & { duplex: "half" });

    const response = await POST(request);

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({
      message: "요청 본문이 너무 큽니다.",
    });
    expect(consumeQuotaMock).not.toHaveBeenCalled();
    expect(lookupNtsBusinessStatusMock).not.toHaveBeenCalled();
  });
});
