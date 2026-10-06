import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const { from, rpc } = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseAdminClient: () => ({ from, rpc }) }));
vi.mock("@/lib/member-api-session", () => ({ requireMemberApiSession: async () => ({ session: { userId: "member-1" } }) }));
vi.mock("@/lib/request-guards", () => ({ isTrustedSameOriginRequest: () => true }));
vi.mock("@/lib/activity-logs", () => ({ getRequestLogContext: () => ({}), scheduleProductEventLog: vi.fn() }));
vi.mock("@/lib/server-log", () => ({ logServerError: vi.fn() }));
vi.mock("@/lib/push/subscription-trust", () => ({ validateTrustedPushSubscription: async (value: unknown) => value }));
vi.mock("@/lib/push/config", async (original) => ({
  ...await original<typeof import("@/lib/push/config")>(), isPushConfigured: () => true,
}));

beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_DATA_SOURCE", "supabase");
  vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "fixture-service-role");
  const query = {
    upsert: vi.fn().mockResolvedValue({ error: null }),
    update: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(),
    then: (resolve: (value: unknown) => void) => Promise.resolve({ count: 0, error: null }).then(resolve),
  };
  from.mockImplementation((table: string) => {
    // A stale full-row preference read/write must never be part of a device change.
    if (table !== "push_subscriptions") throw new Error("unexpected preference snapshot/write");
    return query;
  });
  rpc.mockResolvedValue({ data: [{ enabled: false, marketing_enabled: false, mm_enabled: false }], error: null });
});
afterEach(() => vi.unstubAllEnvs());

test.each(["subscribe", "device", "all"])("%s route changes only device preferences and preserves a committed marketing withdrawal", async (kind) => {
  const route = kind === "subscribe"
    ? await import("@/app/api/push/subscribe/route")
    : await import("@/app/api/push/unsubscribe/route");
  const body = kind === "subscribe"
    ? { subscription: { endpoint: "https://example.test/push", p256dh: "fixture", auth: "fixture" } }
    : { scope: kind, subscriptionId: "device-1" };
  const response = await route.POST(new NextRequest("https://example.test/api/push", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  }));
  expect(response.status).toBe(200);
  expect((await response.json()).preferences.marketingEnabled).toBe(false);
  expect(rpc).toHaveBeenCalledOnce();
  expect(rpc).toHaveBeenCalledWith("patch_member_notification_preferences_atomic", expect.objectContaining({
    input_enabled: kind === "subscribe", input_marketing_enabled: null, input_mm_enabled: null,
    input_marketing_policy_id: null, input_marketing_policy_version: null,
  }));
});
