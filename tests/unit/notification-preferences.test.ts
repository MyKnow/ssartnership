import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const getSupabaseAdminClient = vi.fn();

vi.mock("../../src/lib/supabase/server", () => ({
  getSupabaseAdminClient,
}));

const ENV_KEYS = [
  "NEXT_PUBLIC_DATA_SOURCE",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

const originalEnv = Object.fromEntries(
  ENV_KEYS.map((key) => [key, process.env[key]]),
) as Record<(typeof ENV_KEYS)[number], string | undefined>;

async function loadModule() {
  vi.resetModules();
  process.env.NEXT_PUBLIC_DATA_SOURCE = "supabase";
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
  return import("../../src/lib/notification-preferences");
}

let preferences: Awaited<ReturnType<typeof loadModule>>;
beforeEach(async () => {
  // Initialize the environment-specific module before a test mutates its RPC
  // mock. A failed import must not resume inside a later case's mock state.
  preferences = await loadModule();
});

afterEach(() => {
  vi.clearAllMocks();
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originalEnv[key];
    }
  }
});

describe("notification preferences", () => {
  test("mock opt-in validates the active version and withdrawal retains its consent evidence", async () => {
    vi.resetModules(); process.env.NEXT_PUBLIC_DATA_SOURCE = "mock";
    const mock = await import("../../src/lib/mock/member"); mock.resetMockMemberStore();
    const preferenceModule = await import("../../src/lib/notification-preferences");
    const policies = await import("../../src/lib/policy-documents.server");
    const policy = await policies.getPolicyDocumentByKind("marketing");
    const input = { marketingEnabled: true, marketingPolicyId: policy!.id, marketingPolicyVersion: policy!.version };
    await expect(preferenceModule.updateMemberNotificationPreferences(mock.MOCK_MEMBER_ID, {
      ...input, marketingPolicyVersion: policy!.version + 1,
    })).rejects.toMatchObject({ name: "NotificationPolicyConflictError" });
    await preferenceModule.updateMemberNotificationPreferences(mock.MOCK_MEMBER_ID, input);
    await preferenceModule.updateMemberNotificationPreferences(mock.MOCK_MEMBER_ID, { marketingEnabled: false });
    await preferenceModule.updateMemberNotificationPreferences(mock.MOCK_MEMBER_ID, { mmEnabled: false });
    expect(mock.getMockMemberPolicyState(mock.MOCK_MEMBER_ID)).toMatchObject({
      marketing: policy!.version, marketingEnabled: false,
    });
    expect((await preferenceModule.getMemberNotificationPreferences(mock.MOCK_MEMBER_ID)).marketingEnabled).toBe(false);
  });

  test("omitted marketing is null and never creates consent evidence", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { mm_enabled: false, marketing_enabled: false }, error: null });
    getSupabaseAdminClient.mockReturnValue({ rpc });
    await preferences.updateMemberNotificationPreferences("member-1", { mmEnabled: false });
    expect(rpc.mock.calls[0][1]).toMatchObject({
      input_mm_enabled: false, input_marketing_enabled: null,
      input_marketing_policy_id: null, input_marketing_policy_version: null,
    });
  });

  test("direct callers cannot opt in without reviewed policy evidence", async () => {
    const rpc = vi.fn();
    getSupabaseAdminClient.mockReturnValue({ rpc });
    await expect(preferences.updateMemberNotificationPreferences("member-1", { marketingEnabled: true }))
      .rejects.toMatchObject({ code: "invalid_request" });
    expect(rpc).not.toHaveBeenCalled();
  });

  test("policy race is a safe conflict and never falls back to an old writer", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null,
      error: { code: "P0001", message: "marketing_policy_changed" } });
    getSupabaseAdminClient.mockReturnValue({ rpc });
    await expect(preferences.updateMemberNotificationPreferences("member-1", {
      marketingEnabled: true,
      marketingPolicyId: "70000000-0000-4000-8000-000000000001", marketingPolicyVersion: 2,
    })).rejects.toMatchObject({ name: "NotificationPolicyConflictError" });
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  test("updates member notification preferences through the atomic rpc", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          enabled: true,
          announcement_enabled: false,
          new_partner_enabled: true,
          expiring_partner_enabled: true,
          review_enabled: false,
          mm_enabled: true,
          marketing_enabled: true,
        },
      ],
      error: null,
    });
    getSupabaseAdminClient.mockReturnValue({ rpc });

    const { updateMemberNotificationPreferences } = preferences;
    await expect(
      updateMemberNotificationPreferences(
        "member-1",
        {
          enabled: true,
          announcementEnabled: false,
          reviewEnabled: false,
          marketingEnabled: true,
          marketingPolicyId: "70000000-0000-4000-8000-000000000001",
          marketingPolicyVersion: 2,
        },
        {
          ipAddress: "127.0.0.1",
          userAgent: "Vitest",
        },
      ),
    ).resolves.toEqual({
      enabled: true,
      announcementEnabled: false,
      newPartnerEnabled: true,
      expiringPartnerEnabled: true,
      reviewEnabled: false,
      mmEnabled: true,
      marketingEnabled: true,
    });

    expect(rpc).toHaveBeenCalledWith(
      "patch_member_notification_preferences_atomic",
      {
        input_member_id: "member-1",
        input_enabled: true,
        input_announcement_enabled: false,
        input_new_partner_enabled: null,
        input_expiring_partner_enabled: null,
        input_review_enabled: false,
        input_mm_enabled: null,
        input_marketing_enabled: true,
        input_marketing_policy_id: "70000000-0000-4000-8000-000000000001",
        input_marketing_policy_version: 2,
        input_ip_address: "127.0.0.1",
        input_user_agent: "Vitest",
      },
    );
  });

  test("surfaces rpc failures as stable push storage errors", async () => {
    getSupabaseAdminClient.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "rpc failed" },
      }),
    });

    const { updateMemberNotificationPreferences } = preferences;
    await expect(
      updateMemberNotificationPreferences("member-1", { mmEnabled: false }),
    ).rejects.toMatchObject({
      name: "PushError",
      code: "db_error",
      message: "알림 설정을 저장하지 못했습니다.",
    });
  });
});
