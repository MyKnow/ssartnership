import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const createClient = vi.fn((url: string, key: string, options: object) => ({
  url,
  key,
  options,
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient,
}));

const originalEnv = { ...process.env };

beforeEach(() => {
  vi.resetModules();
  createClient.mockClear();
  process.env = { ...originalEnv };
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("supabase server clients", () => {
  test("getSupabaseAdminClient validates env and caches the client", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";

    const supabaseServer = await import("../../src/lib/supabase/server");
    const first = supabaseServer.getSupabaseAdminClient();
    const second = supabaseServer.getSupabaseAdminClient();

    expect(first).toBe(second);
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(createClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "service-role",
      expect.objectContaining({
        auth: { persistSession: false },
        global: expect.objectContaining({
          fetch: expect.any(Function),
        }),
      }),
    );
  });

  test("getSupabaseAdminClient throws without required env", async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const supabaseServer = await import("../../src/lib/supabase/server");
    expect(() => supabaseServer.getSupabaseAdminClient()).toThrow(
      "SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 필요합니다.",
    );
  });

  test("getSupabasePublicClient validates env and caches by ttl", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_ANON_KEY = "anon-key";

    const supabaseServer = await import("../../src/lib/supabase/server");
    const first = supabaseServer.getSupabasePublicClient();
    const second = supabaseServer.getSupabasePublicClient();
    const third = supabaseServer.getSupabasePublicClient(60);

    expect(first).toBe(second);
    expect(third).not.toBe(first);
    expect(createClient).toHaveBeenCalledTimes(2);
    expect(createClient).toHaveBeenNthCalledWith(
      1,
      "https://example.supabase.co",
      "anon-key",
      expect.objectContaining({
        auth: { persistSession: false },
        global: expect.objectContaining({
          fetch: expect.any(Function),
        }),
      }),
    );
  });

  test("getSupabasePublicClient throws when anon env is missing", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    delete process.env.SUPABASE_ANON_KEY;

    const supabaseServer = await import("../../src/lib/supabase/server");
    expect(() => supabaseServer.getSupabasePublicClient()).toThrow(
      "SUPABASE_ANON_KEY 환경 변수가 필요합니다.",
    );
  });
});
