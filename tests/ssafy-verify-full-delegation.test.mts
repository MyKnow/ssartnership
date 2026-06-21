import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

type ProfileModule = typeof import("../src/lib/ssafy-verify/profile.ts");
type ServerApiModule = typeof import("../src/lib/ssafy-verify/server-api.ts");

const repoRoot = new URL("..", import.meta.url).pathname;

const profileModulePromise = import(
  new URL("../src/lib/ssafy-verify/profile.ts", import.meta.url).href,
) as Promise<ProfileModule>;
const serverApiModulePromise = import(
  new URL("../src/lib/ssafy-verify/server-api.ts", import.meta.url).href,
) as Promise<ServerApiModule>;

function repoFile(path: string) {
  return readFileSync(join(repoRoot, path), "utf8");
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("SSAFY Verify profiles map to directory and member sync snapshots", async () => {
  const {
    normalizeSsafyVerifyMemberProfile,
    toMemberSyncSnapshot,
    toMmUserDirectorySnapshot,
  } = await profileModulePromise;

  const profile = normalizeSsafyVerifyMemberProfile({
    sub: "pairwise-subject",
    mattermost_user_id: "mm.user-123",
    mattermost_username: "student.name",
    name: "김싸피",
    ssafy_campus: "서울",
    ssafy_cohort: "15",
    ssafy_is_staff: false,
    profile_image: {
      content_type: "image/png",
      base64: "aGVsbG8=",
    },
  });

  assert.deepEqual(profile, {
    sub: "pairwise-subject",
    mattermostUserId: "mm.user-123",
    mattermostUsername: "student.name",
    displayName: "김싸피",
    campus: "서울",
    cohort: 15,
    isStaff: false,
    sourceYears: [15],
    profileImage: {
      contentType: "image/png",
      base64: "aGVsbG8=",
    },
  });
  assert.ok(profile);
  assert.deepEqual(toMmUserDirectorySnapshot(profile), {
    mmUserId: "mm.user-123",
    mmUsername: "student.name",
    displayName: "김싸피",
    campus: "서울",
    isStaff: false,
    sourceYears: [15],
  });
  assert.deepEqual(toMemberSyncSnapshot(profile), {
    mmUserId: "mm.user-123",
    mmUsername: "student.name",
    displayName: "김싸피",
    campus: "서울",
    avatarFetched: true,
    avatarContentType: "image/png",
    avatarBase64: "aGVsbG8=",
  });
});

test("SSAFY Verify staff profiles preserve staff and source year signals", async () => {
  const {
    normalizeSsafyVerifyMemberProfile,
    toMmUserDirectorySnapshot,
  } = await profileModulePromise;

  const profile = normalizeSsafyVerifyMemberProfile({
    mattermost_user_id: "staff.user",
    username: "coach.name",
    display_name: "박코치",
    campus: "서울",
    is_staff: true,
    source_years: [15, "14", 15],
  });

  assert.deepEqual(profile?.sourceYears, [0, 14, 15]);
  assert.ok(profile);
  assert.deepEqual(toMmUserDirectorySnapshot(profile), {
    mmUserId: "staff.user",
    mmUsername: "coach.name",
    displayName: "박코치",
    campus: "서울",
    isStaff: true,
    sourceYears: [0, 14, 15],
  });
});

test("SSAFY Verify Server API directory lookup uses profile sync scope", async () => {
  const { createSsafyVerifyServerApiClient } = await serverApiModulePromise;
  const calls: Array<{ url: string; method: string; body: string | null }> = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    calls.push({
      url,
      method: init?.method ?? "GET",
      body: typeof init?.body === "string" ? init.body : null,
    });

    if (url === "https://verify.example.com/v1/server/token") {
      return jsonResponse({
        access_token: "profile-token",
        token_type: "Bearer",
        expires_in: 600,
      });
    }

    return jsonResponse({
      users: [
        {
          mattermost_user_id: "mm.user-123",
          mattermost_username: "student.name",
        },
      ],
    });
  };
  const client = createSsafyVerifyServerApiClient(
    {
      issuer: "https://verify.example.com",
      apiBaseUrl: "https://verify.example.com/v1",
      clientId: "server-api-client",
      clientSecret: "server-secret",
    },
    { fetch: fetchImpl },
  );

  await client.findMattermostUsers({ username: "student.name", cohort: 15 });

  assert.equal(calls[0]?.method, "POST");
  assert.equal(new URLSearchParams(calls[0]?.body ?? "").get("scope"), "ssafy.profile.sync");
  assert.equal(
    calls[1]?.url,
    "https://verify.example.com/v1/mattermost-users?username=student.name&cohort=15",
  );
});

test("member operations no longer require direct Mattermost env or client calls", () => {
  const delegatedFiles = [
    "src/app/api/mm/login/route.ts",
    "src/app/api/mm/_shared/reset-password-identity.ts",
    "src/lib/admin-notification-ops-delivery.ts",
    "src/lib/admin-notification-ops-utils.ts",
    "src/lib/mm-directory/collector.ts",
    "src/lib/mm-member-sync/snapshot.ts",
    "src/lib/member-manual-add/lookup.ts",
    "src/lib/member-manual-add/provision.ts",
  ];

  for (const filePath of delegatedFiles) {
    const content = repoFile(filePath);
    assert.doesNotMatch(content, /@\/lib\/mattermost|from "\.\.?\/mattermost|from "\.\/config\.ts"|MM_BASE_URL|MM_SENDER|MM_TEAM_NAME|MM_STUDENT_CHANNEL/, filePath);
    assert.doesNotMatch(content, /loginWithPassword|createDirectChannel|sendPost|findUserInChannelByUsername|getUserById|getUserImage/, filePath);
  }
});

test("documented runtime env uses SSAFY Verify instead of direct MM credentials", () => {
  const envExample = repoFile(".env.example");
  const readme = repoFile("README.md");

  assert.doesNotMatch(envExample, /MM_BASE_URL|MM_SENDER|MM_TEAM_NAME|MM_STUDENT_CHANNEL/);
  assert.doesNotMatch(readme, /`MM_BASE_URL`|`MM_SENDER|`MM_TEAM_NAME|`MM_STUDENT_CHANNEL/);
  assert.match(envExample, /SSAFY_VERIFY_SERVER_CLIENT_ID/);
  assert.match(envExample, /SSAFY_VERIFY_SERVER_CLIENT_SECRET/);
});
