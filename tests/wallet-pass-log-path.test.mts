import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeProductEventLocation } from "../src/lib/product-event-path.ts";

describe("wallet pass log path redaction", () => {
  it("redacts verification, device, pass type, and serial identifiers", () => {
    assert.equal(
      normalizeProductEventLocation("/wallet/verify/opaque.signature?source=wallet"),
      "/wallet/verify/[token]",
    );
    assert.equal(
      normalizeProductEventLocation(
        "/api/wallet/apple/v1/devices/device-secret/registrations/pass.com.secret/serial-secret",
      ),
      "/api/wallet/apple/v1/devices/[deviceId]/registrations/[passTypeId]/[serialNumber]",
    );
    assert.equal(
      normalizeProductEventLocation(
        "https://example.com/api/wallet/apple/v1/passes/pass.com.secret/serial-secret",
      ),
      "https://example.com/api/wallet/apple/v1/passes/[passTypeId]/[serialNumber]",
    );
  });
});
