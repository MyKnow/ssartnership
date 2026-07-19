import assert from "node:assert/strict";
import { describe, it } from "node:test";

const modulePromise = import(
  new URL("../src/lib/partner-visibility.ts", import.meta.url).href,
);

describe("partner visibility period state", () => {
  it("distinguishes a future start from an ended partnership", async () => {
    const {
      getPartnerVisibilityLabel,
      getPartnerVisibilityState,
    } = await modulePromise;

    assert.equal(
      getPartnerVisibilityState("public", "2026-07-20", "2026-07-31", "2026-07-19"),
      "upcoming",
    );
    assert.equal(
      getPartnerVisibilityState("public", "2026-07-01", "2026-07-18", "2026-07-19"),
      "expired",
    );
    assert.equal(getPartnerVisibilityLabel("upcoming"), "시작 전");
    assert.equal(getPartnerVisibilityLabel("expired"), "기간 만료");
  });

  it("keeps private partners private even when their period is future or ended", async () => {
    const { getPartnerVisibilityState } = await modulePromise;

    assert.equal(
      getPartnerVisibilityState("private", "2026-07-20", "2026-07-31", "2026-07-19"),
      "private",
    );
    assert.equal(
      getPartnerVisibilityState("private", "2026-07-01", "2026-07-18", "2026-07-19"),
      "private",
    );
  });

  it("notifies only when a partner becomes publicly available", async () => {
    const { shouldNotifyPartnerBecamePublic } = await modulePromise;

    assert.equal(shouldNotifyPartnerBecamePublic("upcoming", "public"), true);
    assert.equal(shouldNotifyPartnerBecamePublic("private", "public"), true);
    assert.equal(shouldNotifyPartnerBecamePublic("public", "public"), false);
    assert.equal(shouldNotifyPartnerBecamePublic("public", "upcoming"), false);
  });
});
