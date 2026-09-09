import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { getAdminSessionMock, logAuthSecurityMock } = vi.hoisted(() => ({
  getAdminSessionMock: vi.fn(),
  logAuthSecurityMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));
vi.mock("@/lib/activity-logs", () => ({
  getRequestLogContext: () => ({}),
  getServerActionLogContext: async () => ({}),
  logAuthSecurity: logAuthSecurityMock,
}));
vi.mock("@/lib/auth", () => ({
  getAdminSession: getAdminSessionMock,
}));
vi.mock("@/lib/admin-session-bridge", () => ({
  sanitizeAdminReturnTo: (path: string) => path,
}));
vi.mock("@/lib/admin-permissions", () => ({
  canAdmin: (
    permissions: Record<string, Record<string, boolean> | undefined>,
    resource: string,
    action: string,
  ) => permissions[resource]?.[action] === true,
}));
vi.mock("@/lib/mattermost-senders/access", () => ({
  canManageMattermostSenders: () => false,
}));
vi.mock("@/lib/user-auth", () => ({
  getSignedUserSession: vi.fn(),
}));

import { getNotificationTemplateAdminApiSession } from "../../src/lib/admin-access";

function getRequest() {
  return new NextRequest(
    "https://example.com/api/admin/notification-templates/detail",
  );
}

function getSession(permissionId: string, read: boolean) {
  return {
    adminId: "admin-id",
    loginId: "admin@example.com",
    account: {
      permissionId,
      permissions: {
        notification_templates: { read },
      },
    },
  };
}

describe("notification template admin API access", () => {
  beforeEach(() => {
    getAdminSessionMock.mockReset();
    logAuthSecurityMock.mockReset().mockResolvedValue(undefined);
  });

  it("rejects a delegated permission bit without the Super Admin template", async () => {
    getAdminSessionMock.mockResolvedValue(getSession("operations", true));

    const result = await getNotificationTemplateAdminApiSession(
      getRequest(),
      "read",
    );

    expect("response" in result).toBe(true);
    if (!("response" in result)) throw new Error("expected denied response");
    expect(result.response.status).toBe(403);
    await expect(result.response.json()).resolves.toEqual({
      message: "관리자 권한이 필요합니다.",
    });
    expect(logAuthSecurityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "blocked",
        properties: {
          reason: "super_admin_required",
          resource: "notification_templates",
          action: "read",
        },
      }),
    );
  });

  it("preserves access for a Super Admin with the matching permission", async () => {
    const session = getSession("super_admin", true);
    getAdminSessionMock.mockResolvedValue(session);

    const result = await getNotificationTemplateAdminApiSession(
      getRequest(),
      "read",
    );

    expect(result).toEqual({ session });
    expect(logAuthSecurityMock).not.toHaveBeenCalled();
  });
});
