import { beforeEach, expect, test, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { NotificationPolicyConflictError } from "@/lib/notifications/preference-patch";

const { update, auth, origin, log } = vi.hoisted(() => ({
  update: vi.fn(), auth: vi.fn(), origin: vi.fn(), log: vi.fn(),
}));
vi.mock("@/lib/notification-preferences", () => ({ updateMemberNotificationPreferences: update }));
vi.mock("@/lib/member-api-session", () => ({ requireMemberApiSession: auth }));
vi.mock("@/lib/request-guards", () => ({ isTrustedSameOriginRequest: origin }));
vi.mock("@/lib/activity-logs", () => ({
  getRequestLogContext: () => ({ ipAddress: null, userAgent: "fixture" }),
  scheduleProductEventLog: log,
}));
vi.mock("@/lib/server-log", () => ({ logServerError: vi.fn() }));
import { PATCH, POST } from "@/app/api/notifications/preferences/route";
import { PATCH as legacyPatch, POST as legacyPost } from "@/app/api/push/preferences/route";

const request = (body: unknown, extraHeaders = {}) => new NextRequest("https://example.test/api/notifications/preferences", {
  method: "PATCH", headers: { "content-type": "application/json", ...extraHeaders }, body: JSON.stringify(body),
});
beforeEach(() => {
  vi.clearAllMocks(); origin.mockReturnValue(true);
  auth.mockResolvedValue({ session: { userId: "member-1" } });
  update.mockResolvedValue({ enabled: false, mmEnabled: false, marketingEnabled: false });
});

test("PATCH and both legacy entrypoints preserve only the supplied preference", async () => {
  expect(POST).toBe(PATCH); expect(legacyPatch).toBe(PATCH); expect(legacyPost).toBe(PATCH);
  const response = await PATCH(request({ mmEnabled: false }));
  expect(response.status).toBe(200);
  expect(update).toHaveBeenCalledWith("member-1", { mmEnabled: false }, { ipAddress: null, userAgent: "fixture" });
});

test.each([null, [], {}, { mmEnabled: "false" }, { marketingEnabled: true },
  { marketingEnabled: false, marketingPolicyId: "70000000-0000-4000-8000-000000000001" },
])("invalid raw patch is rejected before any write or success log: %j", async (body) => {
  expect((await PATCH(request(body))).status).toBe(400);
  expect(update).not.toHaveBeenCalled(); expect(log).not.toHaveBeenCalled();
});

test("known policy race returns reload guidance with 409, not a success", async () => {
  update.mockRejectedValue(new NotificationPolicyConflictError());
  const response = await PATCH(request({ marketingEnabled: true,
    marketingPolicyId: "70000000-0000-4000-8000-000000000001", marketingPolicyVersion: 2 }));
  expect(response.status).toBe(409);
  expect((await response.json()).message).toContain("새로고침");
  expect(log).not.toHaveBeenCalled();
});

test("origin, member authentication and declared body limits guard all writes", async () => {
  origin.mockReturnValue(false); expect((await PATCH(request({ mmEnabled: false }))).status).toBe(403);
  origin.mockReturnValue(true); auth.mockResolvedValue({ response: NextResponse.json({}, { status: 401 }) });
  expect((await PATCH(request({ mmEnabled: false }))).status).toBe(401);
  auth.mockResolvedValue({ session: { userId: "member-1" } });
  expect((await PATCH(request({ mmEnabled: false }, { "content-length": "4097" }))).status).toBe(413);
  expect(update).not.toHaveBeenCalled();
});
