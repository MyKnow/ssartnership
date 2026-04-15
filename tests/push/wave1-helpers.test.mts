import assert from "node:assert/strict";
import test from "node:test";

type PushModule = typeof import("../../src/lib/push.ts");
type PushSelectorModule = typeof import("../../src/components/admin/push-manager/selectors.ts");
type PushStatusModule = typeof import("../../src/components/push/push-settings/status.ts");

const pushModulePromise = import(
  new URL("../../src/lib/push.ts", import.meta.url).href
) as Promise<PushModule>;
const pushSelectorModulePromise = import(
  new URL("../../src/components/admin/push-manager/selectors.ts", import.meta.url).href
) as Promise<PushSelectorModule>;
const pushStatusModulePromise = import(
  new URL("../../src/components/push/push-settings/status.ts", import.meta.url).href
) as Promise<PushStatusModule>;

test("push audience parser validates scope-specific inputs", async () => {
  const { parsePushAudience, PushError } = await pushModulePromise;

  assert.deepStrictEqual(parsePushAudience(null), { scope: "all" });
  assert.deepStrictEqual(parsePushAudience({ scope: "year", year: "15" }), {
    scope: "year",
    year: 15,
  });
  assert.deepStrictEqual(parsePushAudience({ scope: "campus", campus: "서울" }), {
    scope: "campus",
    campus: "서울",
  });
  assert.deepStrictEqual(parsePushAudience({ scope: "member", memberId: "member-1" }), {
    scope: "member",
    memberId: "member-1",
  });

  assert.throws(() => parsePushAudience({ scope: "year", year: "" }), (error) => {
    assert.ok(error instanceof PushError);
    assert.equal(error.code, "invalid_request");
    return true;
  });
});

test("push payload helpers validate inputs and normalize destinations", async () => {
  const {
    createAnnouncementPayload,
    getPushDestinationLabel,
    PushError,
  } = await pushModulePromise;

  const payload = createAnnouncementPayload({
    title: " 공지 ",
    body: " 내용 ",
    url: "/partners/test",
  });
  assert.equal(payload.type, "announcement");
  assert.equal(payload.title, "공지");
  assert.equal(payload.body, "내용");
  assert.equal(payload.url, "/partners/test");
  assert.match(payload.tag ?? "", /^announcement-/);

  assert.match(
    getPushDestinationLabel("/partners/test"),
    /^https:\/\/[^/]+\/partners\/test$/,
  );

  assert.throws(
    () => createAnnouncementPayload({ title: "", body: "내용", url: null }),
    (error) => {
      assert.ok(error instanceof PushError);
      assert.equal(error.code, "invalid_request");
      return true;
    },
  );
});

test("admin push selectors derive options, counts, and filtered logs", async () => {
  const {
    countTargetableMembers,
    createAudienceYearOptions,
    createCampusOptions,
    createYearOptions,
    filterPushLogs,
  } = await pushSelectorModulePromise;

  const members = [
    { id: "m1", display_name: "홍길동", mm_username: "hong", year: 15, campus: "서울" },
    { id: "m2", display_name: "김싸피", mm_username: "kim", year: 16, campus: "부울경" },
    { id: "m3", display_name: null, mm_username: "lee", year: 15, campus: "서울" },
  ];
  const logs = [
    {
      id: "log-1",
      type: "announcement" as const,
      source: "manual" as const,
      target_scope: "all" as const,
      target_label: "전체",
      target_year: null,
      target_campus: null,
      target_member_id: null,
      title: "전체 공지",
      body: "안내",
      url: "/partners/1",
      status: "sent" as const,
      targeted: 10,
      delivered: 8,
      failed: 2,
      created_at: "2026-04-15T01:00:00.000Z",
      completed_at: "2026-04-15T01:01:00.000Z",
    },
    {
      id: "log-2",
      type: "new_partner" as const,
      source: "automatic" as const,
      target_scope: "year" as const,
      target_label: "SSAFY 15기",
      target_year: 15,
      target_campus: null,
      target_member_id: null,
      title: "신규 제휴",
      body: "소식",
      url: "/partners/2",
      status: "failed" as const,
      targeted: 3,
      delivered: 0,
      failed: 3,
      created_at: "2026-04-14T01:00:00.000Z",
      completed_at: "2026-04-14T01:01:00.000Z",
    },
  ];

  assert.deepStrictEqual(createCampusOptions(members), ["부울경", "서울"]);
  assert.deepStrictEqual(createYearOptions(members), [16, 15]);
  assert.deepStrictEqual(createAudienceYearOptions("17", [16, 15]), [17, 16, 15]);
  assert.equal(
    countTargetableMembers({
      audienceScope: "year",
      members,
      selectedYear: "15",
      selectedCampus: "",
      selectedMemberId: "",
    }),
    2,
  );

  const filtered = filterPushLogs({
    logs,
    search: "공지",
    typeFilter: "all",
    sourceFilter: "manual",
    statusFilter: "all",
    audienceFilter: "all",
    sort: "newest",
  });
  assert.deepStrictEqual(filtered.map((log) => log.id), ["log-1"]);
});

test("push settings status derives stable labels and tones", async () => {
  const { derivePushSettingsStatus } = await pushStatusModulePromise;

  assert.deepStrictEqual(
    derivePushSettingsStatus({
      configured: false,
      supported: true,
      iosNeedsInstall: false,
      isReceivingOnThisDevice: false,
      accountEnabled: false,
    }),
    { label: "서버 설정 필요", tone: "warn" },
  );

  assert.deepStrictEqual(
    derivePushSettingsStatus({
      configured: true,
      supported: true,
      iosNeedsInstall: false,
      isReceivingOnThisDevice: true,
      accountEnabled: true,
    }),
    { label: "알림 수신 중", tone: "success" },
  );
});
