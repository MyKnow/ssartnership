import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  getAdminPersonalNotificationApiSessionMock,
  invalidateAdminNotificationSettingsCacheMock,
  isTrustedSameOriginRequestMock,
  upsertAdminOperationalNotificationPreferencesMock,
  withServerTimingMock,
} = vi.hoisted(() => ({
  getAdminPersonalNotificationApiSessionMock: vi.fn(),
  invalidateAdminNotificationSettingsCacheMock: vi.fn(),
  isTrustedSameOriginRequestMock: vi.fn(),
  upsertAdminOperationalNotificationPreferencesMock: vi.fn(),
  withServerTimingMock: vi.fn(),
}));

vi.mock("@/lib/admin-access", () => ({
  getAdminPersonalNotificationApiSession:
    getAdminPersonalNotificationApiSessionMock,
}));

vi.mock("@/lib/admin-notifications.server", () => ({
  invalidateAdminNotificationSettingsCache:
    invalidateAdminNotificationSettingsCacheMock,
}));

vi.mock("@/lib/operational-notifications", () => ({
  getAdminOperationalNotificationPreferences: vi.fn(),
  upsertAdminOperationalNotificationPreferences:
    upsertAdminOperationalNotificationPreferencesMock,
}));

vi.mock("@/lib/request-guards", () => ({
  isTrustedSameOriginRequest: isTrustedSameOriginRequestMock,
}));

vi.mock("@/lib/server-timing", () => ({
  withServerTiming: withServerTimingMock,
}));

import { POST } from "../../src/app/api/admin/notifications/preferences/route";

const URL =
  "https://ssartnership.example.com/api/admin/notifications/preferences";

function createRequest(body: string, headers: Record<string, string> = {}) {
  return new NextRequest(URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://ssartnership.example.com",
      ...headers,
    },
    body,
  });
}

describe("admin notification preferences route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isTrustedSameOriginRequestMock.mockReturnValue(true);
    getAdminPersonalNotificationApiSessionMock.mockResolvedValue({
      session: { adminId: "admin-1" },
    });
    withServerTimingMock.mockImplementation(
      async (
        handler: (timing: {
          measure: <T>(
            label: string,
            operation: () => Promise<T> | T,
          ) => Promise<T>;
        }) => Promise<Response>,
      ) =>
        handler({
          measure: async <T>(
            _label: string,
            operation: () => Promise<T> | T,
          ) => operation(),
        }),
    );
  });

  it("malformed JSON을 성공 처리하지 않고 400으로 거부한다", async () => {
    const response = await POST(createRequest("{"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      message: "요청 본문 형식을 확인해 주세요.",
    });
    expect(
      upsertAdminOperationalNotificationPreferencesMock,
    ).not.toHaveBeenCalled();
    expect(invalidateAdminNotificationSettingsCacheMock).not.toHaveBeenCalled();
  });

  it("선언된 본문 제한을 넘으면 저장 전에 413으로 거부한다", async () => {
    const response = await POST(
      createRequest("{}", { "content-length": String(4 * 1024 + 1) }),
    );

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({
      message: "알림 설정 요청이 너무 큽니다.",
    });
    expect(
      upsertAdminOperationalNotificationPreferencesMock,
    ).not.toHaveBeenCalled();
  });
});
