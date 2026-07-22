import assert from "node:assert/strict";
import test from "node:test";
import {
  getMemberPushPreferences,
  getPushPreferencesOrDefault,
  upsertMemberPushPreferences,
} from "../src/lib/push/preferences.ts";

import {
  MOCK_MEMBER_ID,
  getMockMemberById,
  getMockMemberPolicyState,
  getMockMemberProfileImageUrl,
  isMockMemberAuthEnabled,
  recordMockMarketingPolicyConsent,
  recordMockRequiredPolicyConsent,
  resetMockMemberStore,
  verifyMockMemberCredentials,
} from "../src/lib/mock/member.ts";

test.afterEach(() => {
  resetMockMemberStore();
});

test("mock demo member is 정민호 in SSAFY 15기 서울 캠퍼스", () => {
  const member = getMockMemberById(MOCK_MEMBER_ID);

  assert.deepEqual(
    {
      id: member?.id,
      displayName: member?.displayName,
      generation: member?.generation,
      campus: member?.campus,
    },
    {
      id: MOCK_MEMBER_ID,
      displayName: "정민호",
      generation: 15,
      campus: "서울",
    },
  );
});

test("mock member auth requires an explicit non-production flag", () => {
  assert.equal(
    isMockMemberAuthEnabled({
      NODE_ENV: "development",
      NEXT_PUBLIC_DATA_SOURCE: "mock",
      MOCK_MEMBER_AUTH: "1",
    }),
    true,
  );
  assert.equal(
    isMockMemberAuthEnabled({
      NODE_ENV: "production",
      NEXT_PUBLIC_DATA_SOURCE: "mock",
      MOCK_MEMBER_AUTH: "1",
    }),
    false,
  );
  assert.equal(
    isMockMemberAuthEnabled({
      NODE_ENV: "development",
      NEXT_PUBLIC_DATA_SOURCE: "mock",
      MOCK_MEMBER_AUTH: "0",
    }),
    false,
  );
});

test("mock member credentials are read from environment values", () => {
  const fixturePassword = "fixture-password-123!";
  const environment = {
    NODE_ENV: "development",
    NEXT_PUBLIC_DATA_SOURCE: "mock",
    MOCK_MEMBER_AUTH: "1",
    MOCK_ID: "myknow",
    MOCK_PW: fixturePassword,
  };

  assert.equal(
    verifyMockMemberCredentials("myknow", fixturePassword, environment),
    true,
  );
  assert.equal(
    verifyMockMemberCredentials("MYKNOW", "wrong-password", environment),
    false,
  );
  assert.equal(
    verifyMockMemberCredentials("myknow", fixturePassword, {
      ...environment,
      NODE_ENV: "production",
    }),
    false,
  );
});

test("mock member consent starts pending and records required plus marketing consent", () => {
  assert.deepEqual(getMockMemberPolicyState(MOCK_MEMBER_ID), {
    service: null,
    privacy: null,
    marketing: null,
    marketingEnabled: false,
  });

  recordMockRequiredPolicyConsent(MOCK_MEMBER_ID, {
    service: 1,
    privacy: 1,
  });
  recordMockMarketingPolicyConsent(MOCK_MEMBER_ID, 1, true);

  assert.deepEqual(getMockMemberPolicyState(MOCK_MEMBER_ID), {
    service: 1,
    privacy: 1,
    marketing: 1,
    marketingEnabled: true,
  });
});

test("mock member profile image path is local and safely falls back", () => {
  assert.equal(
    getMockMemberProfileImageUrl({ MOCK_MEMBER_PROFILE_IMAGE_URL: "//attacker.example/image" }),
    "/avatar-default.svg",
  );
  assert.equal(
    getMockMemberProfileImageUrl({ MOCK_MEMBER_PROFILE_IMAGE_URL: "/mock/members/jung-minho.jpg" }),
    "/mock/members/jung-minho.jpg",
  );
});

test("mock member push preferences do not query UUID-backed storage", async () => {
  const previousDataSource = process.env.NEXT_PUBLIC_DATA_SOURCE;
  process.env.NEXT_PUBLIC_DATA_SOURCE = "mock";

  try {
    assert.deepEqual(
      await getMemberPushPreferences(MOCK_MEMBER_ID),
      getPushPreferencesOrDefault(),
    );
    assert.deepEqual(
      await upsertMemberPushPreferences(MOCK_MEMBER_ID, { enabled: true }),
      getPushPreferencesOrDefault({ enabled: true }),
    );
  } finally {
    if (previousDataSource === undefined) {
      delete process.env.NEXT_PUBLIC_DATA_SOURCE;
    } else {
      process.env.NEXT_PUBLIC_DATA_SOURCE = previousDataSource;
    }
  }
});
