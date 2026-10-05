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

  test("does not expose an anon-key public client factory", async () => {
    const supabaseServer = await import("../../src/lib/supabase/server");
    expect("getSupabasePublicClient" in supabaseServer).toBe(false);
  });

  test("admin and public clients attach a request deadline to every SDK fetch", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
    process.env.SUPABASE_ANON_KEY = "anon-key";
    delete process.env.SUPABASE_INTERNAL_URL;
    delete process.env.SUPABASE_FETCH_TIMEOUT_MS;
    delete process.env.SUPABASE_STORAGE_FETCH_TIMEOUT_MS;
    const fetchMock = vi.fn<typeof fetch>(async () => new Response("[]"));
    vi.stubGlobal("fetch", fetchMock);

    try {
      const supabaseServer = await import("../../src/lib/supabase/server");
      const admin = supabaseServer.getSupabaseAdminClient() as unknown as {
        options: { global: { fetch: typeof fetch } };
      };
      const publicClient = supabaseServer.getSupabasePublicClient(60) as unknown as {
        options: { global: { fetch: typeof fetch } };
      };

      await admin.options.global.fetch("https://example.supabase.co/rest/v1/partners");
      await publicClient.options.global.fetch(
        "https://example.supabase.co/storage/v1/object/public/partner-media/a.webp",
      );

      expect(fetchMock).toHaveBeenCalledTimes(2);
      const adminInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
      expect(adminInit.signal).toBeInstanceOf(AbortSignal);
      expect(adminInit.signal?.aborted).toBe(false);
      expect(adminInit.cache).toBe("no-store");
      const publicInit = fetchMock.mock.calls[1]?.[1] as RequestInit & {
        next?: unknown;
      };
      expect(publicInit.signal).toBeInstanceOf(AbortSignal);
      expect(publicInit.next).toEqual({ revalidate: 60 });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  test("an invalid timeout env keeps the default and reports only the env name", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
    process.env.SUPABASE_FETCH_TIMEOUT_MS = "thirty-seconds";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    try {
      const supabaseServer = await import("../../src/lib/supabase/server");
      supabaseServer.getSupabaseAdminClient();

      expect(warn).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(warn.mock.calls[0])).toContain("SUPABASE_FETCH_TIMEOUT_MS");
      expect(JSON.stringify(warn.mock.calls[0])).not.toContain("thirty-seconds");
    } finally {
      warn.mockRestore();
    }
  });
});
