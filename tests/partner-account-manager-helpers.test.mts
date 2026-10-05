import assert from "node:assert/strict";
import test from "node:test";

type AccountHelpersModule =
  typeof import("../src/components/admin/partner-account-manager/helpers.ts");

const accountHelpersPromise = import(
  new URL(
    "../src/components/admin/partner-account-manager/helpers.ts",
    import.meta.url,
  ).href,
) as Promise<AccountHelpersModule>;

test("partner account helper formats empty datetime consistently", async () => {
  const { formatPartnerAccountDateTime } = await accountHelpersPromise;

  assert.equal(formatPartnerAccountDateTime(null), "없음");
});

test("partner account helper builds initial setup URL with fallback host", async () => {
  const { buildPartnerInitialSetupUrl } = await accountHelpersPromise;

  assert.equal(
    buildPartnerInitialSetupUrl("token-123"),
    "https://ssartnership.vercel.app/partner/setup/token-123",
  );
  assert.equal(
    buildPartnerInitialSetupUrl("token-123", "https://ssartnership.myknow.xyz"),
    "https://ssartnership.myknow.xyz/partner/setup/token-123",
  );
});

test("partner account helper treats generated setup expiry as prepared URL state", async () => {
  const {
    getPartnerInitialSetupBadge,
    hasIssuedPartnerInitialSetupLink,
    hasUsablePartnerInitialSetupLink,
  } = await accountHelpersPromise;

  const now = new Date("2026-05-07T00:00:00.000Z");
  const account = {
    initial_setup_completed_at: null,
    initial_setup_link_sent_at: null,
    initial_setup_expires_at: "2026-05-08T00:00:00.000Z",
  };

  assert.equal(hasIssuedPartnerInitialSetupLink(account), true);
  assert.equal(hasUsablePartnerInitialSetupLink(account, now), true);
  assert.deepEqual(getPartnerInitialSetupBadge(account, now), {
    variant: "primary",
    label: "초기설정 URL 준비됨",
  });
});

test("partner account helper shows a setup URL sent without an expiry as expired", async () => {
  const {
    getPartnerInitialSetupBadge,
    hasIssuedPartnerInitialSetupLink,
    hasUsablePartnerInitialSetupLink,
  } = await accountHelpersPromise;

  const now = new Date("2026-05-07T00:00:00.000Z");
  const account = {
    initial_setup_completed_at: null,
    initial_setup_link_sent_at: "2026-05-06T23:00:00.000Z",
    initial_setup_expires_at: null,
  };

  // The setup page no longer extends a link from its send time, so the admin
  // must see it as expired and reissue it instead of "sent".
  assert.equal(hasIssuedPartnerInitialSetupLink(account), true);
  assert.equal(hasUsablePartnerInitialSetupLink(account, now), false);
  assert.deepEqual(getPartnerInitialSetupBadge(account, now), {
    variant: "warning",
    label: "초기설정 URL 만료됨",
  });
});

test("partner account setup badge follows the setup page expiry rule", async () => {
  const { hasUsablePartnerInitialSetupLink } = await accountHelpersPromise;
  const { getPartnerSetupLinkState } = await import(
    "../src/lib/partner-auth/setup-link.ts"
  );

  const now = new Date("2026-05-07T00:00:00.000Z");
  for (const expiresAt of [
    null,
    "",
    "not-a-date",
    "2026-05-06T23:59:59.000Z",
    "2026-05-07T00:00:00.000Z",
    "2026-05-07T00:00:01.000Z",
  ]) {
    const setupPageAccepts =
      getPartnerSetupLinkState(
        { isActive: true, hasToken: true, expiresAt, completedAt: null },
        now.getTime(),
      ) === "usable";
    assert.equal(
      hasUsablePartnerInitialSetupLink(
        {
          initial_setup_completed_at: null,
          initial_setup_link_sent_at: "2026-05-01T00:00:00.000Z",
          initial_setup_expires_at: expiresAt,
        },
        now,
      ),
      setupPageAccepts,
      String(expiresAt),
    );
  }
});

test("partner account helper marks expired setup URL separately from missing state", async () => {
  const {
    getPartnerInitialSetupBadge,
    hasIssuedPartnerInitialSetupLink,
    hasUsablePartnerInitialSetupLink,
  } = await accountHelpersPromise;

  const now = new Date("2026-05-07T00:00:00.000Z");
  const account = {
    initial_setup_completed_at: null,
    initial_setup_link_sent_at: null,
    initial_setup_expires_at: "2026-05-06T00:00:00.000Z",
  };

  assert.equal(hasIssuedPartnerInitialSetupLink(account), true);
  assert.equal(hasUsablePartnerInitialSetupLink(account, now), false);
  assert.deepEqual(getPartnerInitialSetupBadge(account, now), {
    variant: "warning",
    label: "초기설정 URL 만료됨",
  });
});
