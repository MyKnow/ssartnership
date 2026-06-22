import assert from "node:assert/strict";
import test from "node:test";

import {
  getSsafyVerifyServerApiConfig,
  isSsafyVerifyServerApiConfigured,
} from "../../src/lib/ssafy-verify/config.ts";
import {
  createSsafyVerifyServerApiClient,
  isValidMattermostId,
  SsafyVerifyServerApiError,
  type SsafyVerifyServerApiClient,
} from "../../src/lib/ssafy-verify/server-api.ts";
import {
  extractSsafyVerifyMemberProfiles,
  type SsafyVerifyMemberProfile,
} from "../../src/lib/ssafy-verify/profile.ts";

type UnknownRecord = Record<string, unknown>;

const LIVE_SMOKE_ENV = "SSAFY_VERIFY_LIVE_SMOKE";
const SEND_MM_ENV = "SSAFY_VERIFY_SMOKE_SEND_MM";
const DEFAULT_TARGET_USERNAME = "myknow";
const DEFAULT_TARGET_COHORT = "15";
const DEFAULT_NOTIFICATION_TEMPLATE_ID = "ssartnership_admin_notification";
const DEFAULT_NOTIFICATION_PURPOSE = "announcement";
const DEFAULT_SINGLE_NOTIFICATION_TEMPLATE_ID = "ssartnership_manual_member_temp_password";
const DEFAULT_SINGLE_NOTIFICATION_PURPOSE = "manual_member_temp_password";
const DEFAULT_SMOKE_URL =
  "https://ssartnership-git-dev-myknows-projects.vercel.app/auth/signup";

let liveClient: SsafyVerifyServerApiClient | null = null;
let smokeTargetPromise: Promise<SsafyVerifyMemberProfile> | null = null;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function payloadShape(payload: unknown) {
  if (!isRecord(payload)) {
    return {
      type: Array.isArray(payload) ? "array" : typeof payload,
    };
  }

  const data = isRecord(payload.data) ? payload.data : {};
  const users = Array.isArray(payload.users) ? payload.users : null;
  const items = Array.isArray(payload.items) ? payload.items : null;
  const events = Array.isArray(payload.events) ? payload.events : null;

  return {
    topLevelKeys: Object.keys(payload).sort(),
    dataKeys: Object.keys(data).sort(),
    usersLength: users?.length ?? null,
    itemsLength: items?.length ?? null,
    eventsLength: events?.length ?? null,
  };
}

function liveSkipReason() {
  if (process.env[LIVE_SMOKE_ENV] !== "1") {
    return `Set ${LIVE_SMOKE_ENV}=1 to run SSAFY Verify live smoke tests.`;
  }
  if (!isSsafyVerifyServerApiConfigured()) {
    return "SSAFY Verify Server API credentials are not configured.";
  }
  return false;
}

function getTargetUsername() {
  const rawUsername =
    process.env.SSAFY_VERIFY_SMOKE_USERNAME?.trim() || DEFAULT_TARGET_USERNAME;
  const username = rawUsername.replace(/^@/, "");
  assert.ok(
    isValidMattermostId(username),
    "SSAFY_VERIFY_SMOKE_USERNAME must be a Mattermost username without spaces.",
  );
  return username;
}

function getTargetCohort() {
  if (process.env.SSAFY_VERIFY_SMOKE_COHORT === undefined) {
    return DEFAULT_TARGET_COHORT;
  }
  return process.env.SSAFY_VERIFY_SMOKE_COHORT.trim() || null;
}

function getExpectedMattermostUserId() {
  const value = process.env.SSAFY_VERIFY_SMOKE_MATTERMOST_USER_ID?.trim();
  if (!value) {
    return null;
  }
  assert.ok(
    isValidMattermostId(value),
    "SSAFY_VERIFY_SMOKE_MATTERMOST_USER_ID must be a valid Mattermost user id.",
  );
  return value;
}

function getSmokeNotificationTemplateId() {
  return process.env.SSAFY_VERIFY_SMOKE_TEMPLATE_ID?.trim() || DEFAULT_NOTIFICATION_TEMPLATE_ID;
}

function getSmokeNotificationPurpose() {
  return process.env.SSAFY_VERIFY_SMOKE_PURPOSE?.trim() || DEFAULT_NOTIFICATION_PURPOSE;
}

function getSmokeSingleNotificationTemplateId() {
  return (
    process.env.SSAFY_VERIFY_SMOKE_SINGLE_TEMPLATE_ID?.trim() ||
    DEFAULT_SINGLE_NOTIFICATION_TEMPLATE_ID
  );
}

function getSmokeSingleNotificationPurpose() {
  return (
    process.env.SSAFY_VERIFY_SMOKE_SINGLE_PURPOSE?.trim() ||
    DEFAULT_SINGLE_NOTIFICATION_PURPOSE
  );
}

function createLiveClient() {
  liveClient ??= createSsafyVerifyServerApiClient(getSsafyVerifyServerApiConfig());
  return liveClient;
}

function assertProfiles(label: string, payload: unknown) {
  const profiles = extractSsafyVerifyMemberProfiles(payload);
  assert.ok(
    profiles.length > 0,
    `${label} response did not include a parseable SSAFY Verify member profile: ${JSON.stringify(
      payloadShape(payload),
    )}`,
  );
  return profiles;
}

async function callVerify<T>(label: string, action: () => Promise<T>) {
  try {
    return await action();
  } catch (error) {
    if (error instanceof SsafyVerifyServerApiError) {
      throw new Error(
        `${label} failed: ${error.errorCode} ${error.message}${
          error.requestId ? ` (request_id: ${error.requestId})` : ""
        }`,
        { cause: error },
      );
    }
    throw error;
  }
}

function maskMattermostId(value: string) {
  if (value.length <= 8) {
    return `${value.slice(0, 2)}***`;
  }
  return `${value.slice(0, 4)}***${value.slice(-4)}`;
}

function notificationResultDiagnostic(
  result: Awaited<ReturnType<SsafyVerifyServerApiClient["sendMattermostNotificationBatch"]>>,
) {
  return JSON.stringify({
    campaignId: result.campaignId,
    notificationId: result.notificationId,
    status: result.status,
    summary: result.summary,
    results: result.results.map((item) => ({
      idempotencyKey: item.idempotencyKey,
      notificationId: item.notificationId,
      status: item.status,
      errorCode: item.errorCode,
      errorMessage: item.errorMessage,
      requestId: item.requestId,
    })),
  });
}

async function resolveSmokeTarget(
  client: SsafyVerifyServerApiClient,
): Promise<SsafyVerifyMemberProfile> {
  const username = getTargetUsername();
  const cohort = getTargetCohort();
  const expectedMattermostUserId = getExpectedMattermostUserId();

  const directoryPayload = await callVerify("directory lookup", () =>
    client.findMattermostUsers({ username, cohort }),
  );
  const directoryProfiles = assertProfiles("directory lookup", directoryPayload);
  const directoryProfile =
    directoryProfiles.find((profile) => profile.mattermostUsername === username) ??
    directoryProfiles[0];

  assert.ok(
    directoryProfile,
    `directory lookup returned no target profile: ${JSON.stringify(
      payloadShape(directoryPayload),
    )}`,
  );
  assert.equal(directoryProfile.mattermostUsername, username);
  if (expectedMattermostUserId) {
    assert.equal(directoryProfile.mattermostUserId, expectedMattermostUserId);
  }

  const profilePayload = await callVerify("mattermost user profile", () =>
    client.getMattermostUserProfile(directoryProfile.mattermostUserId),
  );
  const profile = assertProfiles("mattermost user profile", profilePayload).find(
    (candidate) => candidate.mattermostUserId === directoryProfile.mattermostUserId,
  );

  assert.ok(
    profile,
    `profile response did not include the resolved Mattermost user id: ${JSON.stringify(
      payloadShape(profilePayload),
    )}`,
  );
  assert.equal(profile.mattermostUsername, username);

  return profile;
}

function getSmokeTarget(client: SsafyVerifyServerApiClient) {
  smokeTargetPromise ??= resolveSmokeTarget(client);
  return smokeTargetPromise;
}

test(
  "SSAFY Verify live smoke exercises profile, sync, events, and optional Mattermost sends for @myknow",
  { skip: liveSkipReason() },
  async () => {
    const client = createLiveClient();
    const target = await getSmokeTarget(client);

    const syncPayload = await callVerify("mattermost user sync", () =>
      client.syncMattermostUser(target.mattermostUserId),
    );
    assert.ok(
      isRecord(syncPayload),
      `sync response should be a JSON object: ${JSON.stringify(payloadShape(syncPayload))}`,
    );

    const eventsPayload = await callVerify("profile events", () =>
      client.getProfileEvents({ limit: 1 }),
    );
    assert.ok(
      isRecord(eventsPayload) || Array.isArray(eventsPayload),
      `profile-events response should be JSON: ${JSON.stringify(payloadShape(eventsPayload))}`,
    );

    console.info(
      JSON.stringify({
        smoke: "ssafy-verify-profile",
        username: target.mattermostUsername,
        mattermostUserId: maskMattermostId(target.mattermostUserId),
        campus: target.campus,
        cohort: target.cohort,
        hasAvatarUrl: Boolean(target.profileImage?.url),
      }),
    );

    if (process.env[SEND_MM_ENV] !== "1") {
      console.info(
        JSON.stringify({
          smoke: "ssafy-verify-mm",
          skipped: true,
          reason: `Set ${SEND_MM_ENV}=1 to send real Mattermost smoke-test DMs.`,
        }),
      );
      return;
    }

    const batchUniqueKey = `live-smoke-${Date.now().toString(36)}`;
    const campaignId = `ssartnership.${batchUniqueKey}`;

    const batchResult = await callVerify("mattermost batch notification", () =>
      client.sendMattermostNotificationBatch({
        campaignId,
        purpose: getSmokeNotificationPurpose(),
        templateKey: getSmokeNotificationTemplateId(),
        message: {
          title: "SSARTNERSHIP Verify smoke test",
          body: [
            "SSAFY Verify Server API 실호출 점검 메시지입니다.",
            "수신 대상: @myknow",
            `campaign_id: ${campaignId}`,
          ].join("\n"),
          url: process.env.SSAFY_VERIFY_SMOKE_URL?.trim() || DEFAULT_SMOKE_URL,
        },
        recipients: [
          {
            mattermostUserId: target.mattermostUserId,
          },
        ],
        idempotencyKey: `ssartnership:${batchUniqueKey}:mm:1`,
      }),
    );

    assert.equal(
      ["failed", "rejected"].includes(batchResult.status.toLowerCase()),
      false,
      `Mattermost batch notification was not accepted: ${notificationResultDiagnostic(batchResult)}`,
    );

    if (batchResult.notificationId) {
      const notificationPayload = await callVerify("notification status", () =>
        client.getNotification(batchResult.notificationId as string),
      );
      assert.ok(
        isRecord(notificationPayload),
        `notification status response should be a JSON object: ${JSON.stringify(
          payloadShape(notificationPayload),
        )}`,
      );
    }

    const campaignPayload = await callVerify("notification campaign status", () =>
      client.listNotifications({ campaignId: batchResult.campaignId ?? campaignId }),
    );
    assert.ok(
      isRecord(campaignPayload) || Array.isArray(campaignPayload),
      `notification list response should be JSON: ${JSON.stringify(
        payloadShape(campaignPayload),
      )}`,
    );

    console.info(
      JSON.stringify({
        smoke: "ssafy-verify-mm-batch",
        username: target.mattermostUsername,
        mattermostUserId: maskMattermostId(target.mattermostUserId),
        campaignId: batchResult.campaignId ?? campaignId,
        notificationId: batchResult.notificationId,
        status: batchResult.status,
      }),
    );

    const uniqueKey = `live-smoke-single-${Date.now().toString(36)}`;

    const result = await callVerify("mattermost single notification", () =>
      client.sendMattermostNotification({
        campaignId: `ssartnership.${uniqueKey}`,
        purpose: getSmokeSingleNotificationPurpose(),
        templateKey: getSmokeSingleNotificationTemplateId(),
        message: {
          title: "SSARTNERSHIP Verify single smoke test",
          body: [
            "SSAFY Verify Server API 단건 발송 점검 메시지입니다.",
            "수신 대상: @myknow",
          ].join("\n"),
        },
        recipient: {
          mattermostUserId: target.mattermostUserId,
        },
        idempotencyKey: `ssartnership:${uniqueKey}:mm`,
      }),
    );

    assert.equal(
      ["failed", "rejected"].includes(result.status.toLowerCase()),
      false,
      `Mattermost single notification was not accepted: ${notificationResultDiagnostic(result)}`,
    );

    if (result.notificationId) {
      const notificationPayload = await callVerify("single notification status", () =>
        client.getNotification(result.notificationId as string),
      );
      assert.ok(
        isRecord(notificationPayload),
        `single notification status response should be JSON: ${JSON.stringify(
          payloadShape(notificationPayload),
        )}`,
      );
    }

    console.info(
      JSON.stringify({
        smoke: "ssafy-verify-mm-single",
        username: target.mattermostUsername,
        mattermostUserId: maskMattermostId(target.mattermostUserId),
        campaignId: result.campaignId,
        notificationId: result.notificationId,
        status: result.status,
      }),
    );
  },
);
