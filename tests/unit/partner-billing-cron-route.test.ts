import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { revalidatePathMock, runPartnerBillingOverdueDowngradesMock } = vi.hoisted(() => ({
  revalidatePathMock: vi.fn(),
  runPartnerBillingOverdueDowngradesMock: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock("@/lib/partner-plan-service", () => ({
  runPartnerBillingOverdueDowngrades: runPartnerBillingOverdueDowngradesMock,
}));

import { GET } from "../../src/app/api/cron/partner-billing/route";

const ORIGINAL_CRON_SECRET = process.env.CRON_SECRET;
// The cron guard rejects secrets shorter than the runtime minimum (32).
const TEST_CRON_SECRET = "test-cron-secret-at-least-32-characters";

describe("partner billing cron route", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = TEST_CRON_SECRET;
    revalidatePathMock.mockReset();
    runPartnerBillingOverdueDowngradesMock.mockReset();
  });

  afterEach(() => {
    if (ORIGINAL_CRON_SECRET === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = ORIGINAL_CRON_SECRET;
    }
    vi.restoreAllMocks();
  });

  it("logs the original failure without exposing it in the HTTP response", async () => {
    const originalError = new Error(
      "relation partner_billing_invoices does not exist at database.internal",
    );
    runPartnerBillingOverdueDowngradesMock.mockRejectedValueOnce(originalError);
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await GET(
      new NextRequest("http://localhost/api/cron/partner-billing", {
        headers: {
          authorization: `Bearer ${TEST_CRON_SECRET}`,
        },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      ok: false,
      message: "Partner billing cron failed",
    });
    expect(JSON.stringify(body)).not.toContain(originalError.message);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    const entry = JSON.parse(String(consoleErrorSpy.mock.calls[0]?.[0]));
    expect(entry).toMatchObject({
      level: "error",
      event: "[partner-billing-cron] failed",
      error: { name: "Error", message: originalError.message },
    });
  });
});
