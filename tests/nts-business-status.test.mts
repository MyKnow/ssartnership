import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  isNtsBusinessStatusLookupConfigured,
  lookupNtsBusinessStatus,
} from "../src/lib/nts-business-status.ts";

const originalFetch = globalThis.fetch;
const originalServiceKey = process.env.NTS_BUSINESS_STATUS_SERVICE_KEY;
const originalDataGoKrServiceKey = process.env.DATA_GO_KR_SERVICE_KEY;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalServiceKey === undefined) {
    delete process.env.NTS_BUSINESS_STATUS_SERVICE_KEY;
  } else {
    process.env.NTS_BUSINESS_STATUS_SERVICE_KEY = originalServiceKey;
  }
  if (originalDataGoKrServiceKey === undefined) {
    delete process.env.DATA_GO_KR_SERVICE_KEY;
  } else {
    process.env.DATA_GO_KR_SERVICE_KEY = originalDataGoKrServiceKey;
  }
});

describe("NTS business status lookup", () => {
  it("returns a non-fatal not configured result without a service key", async () => {
    delete process.env.NTS_BUSINESS_STATUS_SERVICE_KEY;
    delete process.env.DATA_GO_KR_SERVICE_KEY;

    assert.equal(isNtsBusinessStatusLookupConfigured(), false);
    assert.deepEqual(await lookupNtsBusinessStatus("220-81-62517"), {
      ok: false,
      code: "not_configured",
      message: "사업자 상태조회 API 키가 설정되지 않았습니다.",
    });
  });

  it("maps the official business status response without exposing the service key", async () => {
    process.env.NTS_BUSINESS_STATUS_SERVICE_KEY = "service-key";
    delete process.env.DATA_GO_KR_SERVICE_KEY;
    let requestedUrl = "";
    let requestedBody = "";
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      requestedUrl = String(input);
      requestedBody = String(init?.body ?? "");
      return new Response(
        JSON.stringify({
          data: [
            {
              b_no: "2208162517",
              b_stt: "계속사업자",
              b_stt_cd: "01",
              tax_type: "부가가치세 일반과세자",
              tax_type_cd: "01",
              end_dt: "",
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch;

    assert.equal(isNtsBusinessStatusLookupConfigured(), true);
    assert.deepEqual(await lookupNtsBusinessStatus("220-81-62517"), {
      ok: true,
      businessRegistrationNumber: "2208162517",
      businessStatus: "계속사업자",
      businessStatusCode: "01",
      taxType: "부가가치세 일반과세자",
      taxTypeCode: "01",
      closedAt: null,
      raw: {
        b_no: "2208162517",
        b_stt: "계속사업자",
        b_stt_cd: "01",
        tax_type: "부가가치세 일반과세자",
        tax_type_cd: "01",
        end_dt: "",
      },
    });
    assert.equal(
      requestedUrl,
      "https://api.odcloud.kr/api/nts-businessman/v1/status?serviceKey=service-key",
    );
    assert.equal(requestedBody, JSON.stringify({ b_no: ["2208162517"] }));
  });
});
