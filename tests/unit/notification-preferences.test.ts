import { afterEach, describe, expect, test, vi } from "vitest";

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

    const { updateMemberNotificationPreferences } = await loadModule();
    await expect(
      updateMemberNotificationPreferences(
        "member-1",
        {
          enabled: true,
          announcementEnabled: false,
          reviewEnabled: false,
          marketingEnabled: true,
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
      "update_member_push_preferences_atomic",
      {
        input_member_id: "member-1",
        input_enabled: true,
        input_announcement_enabled: false,
        input_new_partner_enabled: null,
        input_expiring_partner_enabled: null,
        input_review_enabled: false,
        input_mm_enabled: null,
        input_marketing_enabled: true,
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

    const { updateMemberNotificationPreferences } = await loadModule();
    await expect(
      updateMemberNotificationPreferences("member-1", {}),
    ).rejects.toMatchObject({
      name: "PushError",
      code: "db_error",
      message: "알림 설정을 저장하지 못했습니다.",
    });
  });
});
