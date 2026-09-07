import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/web-vitals/route";

describe("self-host Web Vitals HTTP boundary", () => {
  beforeEach(() => {
    vi.stubEnv("SELF_HOST_MODE", "real");
    vi.stubEnv("SELF_HOST_VITALS_ENABLED", "1");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://ssartnership.test");
    vi.stubEnv("SELF_HOST_VITALS_TOKEN", randomBytes(32).toString("hex"));
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  const sample = { name: "LCP", route: "home", value: 2100 };
  const request = (body: unknown, origin = "https://ssartnership.test") => new Request("http://app:3000/api/web-vitals", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  it("is disabled by default and exposes no server configuration", async () => {
    vi.stubEnv("SELF_HOST_VITALS_ENABLED", "0");
    expect((await GET().json()).enabled).toBe(false);
    expect((await POST(request(sample))).status).toBe(404);
  });
  it("rejects forged origin, oversized bodies and added identifiers before transport", async () => {
    const transport = vi.fn();
    vi.stubGlobal("fetch", transport);
    expect((await POST(request(sample, "https://attacker.test"))).status).toBe(403);
    expect((await POST(request({ ...sample, url: "x".repeat(600) }))).status).toBe(413);
    expect((await POST(request({ ...sample, memberId: "42" }))).status).toBe(400);
    expect(transport).not.toHaveBeenCalled();
  });
  it("only forwards validated samples to the fixed internal collector", async () => {
    const transport = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", transport);
    expect((await POST(request(sample))).status).toBe(204);
    expect(transport).toHaveBeenCalledWith("http://telemetry:9464/vitals", expect.objectContaining({ redirect: "error", body: JSON.stringify(sample) }));
  });
  it("collector errors return a safe unavailable status, not a false success", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("private failure"); }));
    const response = await POST(request(sample));
    expect(response.status).toBe(503);
    expect(await response.text()).toBe("");
  });
});
