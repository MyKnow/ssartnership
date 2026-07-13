import assert from "node:assert/strict";
import test from "node:test";

type ClaimsModule = typeof import("../src/lib/ssafy-verify/claims.ts");
type SchemaModule = typeof import("../src/lib/ssafy-verify/schema.ts");
type MemberModule = typeof import("../src/lib/ssafy-verify/member.ts");
type ScopesModule = typeof import("../src/lib/ssafy-verify/scopes.ts");
type SecurityModule = typeof import("../src/lib/member-auth-security.ts");
type SignupModule = typeof import("../src/lib/ssafy-verify/signup.ts");
type SignupProfileModule = typeof import("../src/lib/ssafy-verify/signup-profile.ts");

const claimsModulePromise = import(
  new URL("../src/lib/ssafy-verify/claims.ts", import.meta.url).href,
) as Promise<ClaimsModule>;
const schemaModulePromise = import(
  new URL("../src/lib/ssafy-verify/schema.ts", import.meta.url).href,
) as Promise<SchemaModule>;
const memberModulePromise = import(
  new URL("../src/lib/ssafy-verify/member.ts", import.meta.url).href,
) as Promise<MemberModule>;
const scopesModulePromise = import(
  new URL("../src/lib/ssafy-verify/scopes.ts", import.meta.url).href,
) as Promise<ScopesModule>;
const securityModulePromise = import(
  new URL("../src/lib/member-auth-security.ts", import.meta.url).href,
) as Promise<SecurityModule>;
const signupModulePromise = import(
  new URL("../src/lib/ssafy-verify/signup.ts", import.meta.url).href,
) as Promise<SignupModule>;
const signupProfileModulePromise = import(
  new URL("../src/lib/ssafy-verify/signup-profile.ts", import.meta.url).href,
) as Promise<SignupProfileModule>;

const issuer = "https://verify.myknow.xyz";
const clientId = "client_example_public";
const redirectUri = "https://partner.example.com/ssafy";

test("SSAFY Verify scopes are split between profile enrollment and re-auth", async () => {
  const {
    SSAFY_VERIFY_PROFILE_SCOPES,
    SSAFY_VERIFY_REAUTH_SCOPES,
  } = await scopesModulePromise;

  assert.deepEqual([...SSAFY_VERIFY_PROFILE_SCOPES], [
    "ssafy.verify",
    "ssafy.affiliation",
    "ssafy.track",
    "ssafy.name",
    "ssafy.profile_image",
    "ssafy.role",
    "ssafy.mattermost_id",
  ]);

  assert.deepEqual([...SSAFY_VERIFY_REAUTH_SCOPES], [
    "ssafy.verify",
    "ssafy.mattermost_id",
  ]);
  const reauthScopes = new Set<string>(SSAFY_VERIFY_REAUTH_SCOPES);
  assert.equal(reauthScopes.has("ssafy.name"), false);
  assert.equal(reauthScopes.has("ssafy.profile_image"), false);
  assert.equal(reauthScopes.has("ssafy.role"), false);
});

test("SSAFY Verify callback body parser accepts only the exact safe shape", async () => {
  const { parseSsafyVerifyCallbackBody } = await schemaModulePromise;

  const parsed = parseSsafyVerifyCallbackBody(
    {
      code: "0123456789abcdef",
      codeVerifier: "A".repeat(43),
      redirectUri,
      iss: issuer,
    },
    { issuer, redirectUris: [redirectUri] },
  );

  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.ok ? parsed.data : null, {
    code: "0123456789abcdef",
    codeVerifier: "A".repeat(43),
    redirectUri,
    iss: issuer,
  });

  assert.equal(
    parseSsafyVerifyCallbackBody(
      {
        code: "0123456789abcdef",
        codeVerifier: "A".repeat(42),
        redirectUri,
        iss: issuer,
      },
      { issuer, redirectUris: [redirectUri] },
    ).ok,
    false,
  );
  assert.equal(
    parseSsafyVerifyCallbackBody(
      {
        code: "0123456789abcdef",
        codeVerifier: "A".repeat(43),
        redirectUri: "https://evil.example.com/callback",
        iss: issuer,
      },
      { issuer, redirectUris: [redirectUri] },
    ).ok,
    false,
  );
  assert.equal(
    parseSsafyVerifyCallbackBody(
      {
        code: "0123456789abcdef",
        codeVerifier: "A".repeat(43),
        redirectUri,
        iss: issuer,
        verification_token: "must_not_be_accepted",
      },
      { issuer, redirectUris: [redirectUri] },
    ).ok,
    false,
  );
});

test("SSAFY Verify claim validator enforces issuer, audience, assurance, and auth time", async () => {
  const { validateSsafyVerificationClaims } = await claimsModulePromise;
  const now = 1_781_850_000;
  const validClaims = {
    iss: issuer,
    aud: clientId,
    exp: now + 300,
    sub: "pairwise-subject",
    client_id: clientId,
    verified: true,
    auth_time: now - 30,
    amr: ["mattermost_dm"],
    acr: "urn:ssafy:verify:assurance:mattermost-team-dm:v1",
    ssafy_cohort: "15",
    ssafy_campus: "서울 캠퍼스",
    ssafy_region: "서울",
    ssafy_track: "java-major",
    ssafy_track_name: "자바 전공",
    name: "김싸피",
    picture: "https://verify.myknow.xyz/avatar/example.png",
    ssafy_team_code: "A101",
    ssafy_member_role: "교육생",
    ssafy_is_staff: false,
    ssafy_role: "member",
    ssafy_mattermost_user_id: "mattermost-user-id",
  };

  assert.deepEqual(
    validateSsafyVerificationClaims(validClaims, { issuer, clientId, now }),
    {
      ok: true,
      claims: {
        sub: "pairwise-subject",
        verified: true,
        authTime: now - 30,
        cohort: "15",
        campus: "서울 캠퍼스",
        region: "서울",
        track: "java-major",
        trackName: "자바 전공",
        name: "김싸피",
        picture: "https://verify.myknow.xyz/avatar/example.png",
        role: "member",
        roleName: "교육생",
        teamCode: "A101",
        isStaff: false,
        mattermostUserId: "mattermost-user-id",
      },
    },
  );

  assert.equal(
    validateSsafyVerificationClaims(
      { ...validClaims, acr: "urn:ssafy:sso:assurance:mattermost-team-dm:v1" },
      { issuer, clientId, now },
    ).ok,
    false,
  );
  assert.equal(
    validateSsafyVerificationClaims(
      { ...validClaims, verified: false },
      { issuer, clientId, now },
    ).ok,
    false,
  );
  assert.equal(
    validateSsafyVerificationClaims(
      { ...validClaims, exp: now - 1 },
      { issuer, clientId, now },
    ).ok,
    false,
  );
});

test("SSAFY Verify member update payload stores minimal verification fields", async () => {
  const { buildSsafyMemberUpdatePayload } = await memberModulePromise;
  const payload = buildSsafyMemberUpdatePayload({
    sub: "pairwise-subject",
    verified: true,
    authTime: 1_781_740_800,
    cohort: "15",
    campus: "서울 캠퍼스",
    region: null,
    track: "java-major",
    trackName: "자바 전공",
    name: null,
    picture: null,
    role: null,
    roleName: null,
    teamCode: null,
    isStaff: null,
    mattermostUserId: "mattermost-user-id",
    verificationId: "verification-id",
    scope: "ssafy.verify ssafy.affiliation ssafy.mattermost_id",
  });

  assert.deepEqual(payload, {
    ssafy_sub: "pairwise-subject",
    ssafy_verified_at: new Date(1_781_740_800 * 1000).toISOString(),
    ssafy_auth_time: new Date(1_781_740_800 * 1000).toISOString(),
    ssafy_verification_id: "verification-id",
    ssafy_mattermost_user_id: "mattermost-user-id",
    ssafy_track: "java-major",
    ssafy_track_name: "자바 전공",
    ssafy_last_scope: "ssafy.verify ssafy.affiliation ssafy.mattermost_id",
    updated_at: payload.updated_at,
  });
  assert.match(payload.updated_at, /^\d{4}-\d{2}-\d{2}T/);
});

test("SSAFY Verify signup payload creates a member from verified profile and policies", async () => {
  const { buildSsafySignupMemberInsertPayload } = await signupModulePromise;
  const payload = buildSsafySignupMemberInsertPayload({
    session: {
      sub: "pairwise-subject",
      mattermostUserId: "mm.user-123",
      mattermostUsername: "student.name",
      displayName: "김싸피",
      cohort: 15,
      campus: "서울",
      isStaff: false,
      sourceYears: [15],
      track: "java-major",
      trackName: "자바 전공",
      avatarUrl: "https://verify.myknow.xyz/api/mattermost/avatar/mm.user-123",
      authTime: 1_781_740_800,
      verificationId: "verification-id",
      scope: "ssafy.verify ssafy.affiliation ssafy.mattermost_id",
    },
    passwordRecord: { hash: "password-hash", salt: "password-salt" },
    activePolicies: {
      service: { id: "service-policy", version: 2 },
      privacy: { id: "privacy-policy", version: 3 },
    },
    marketingPolicy: { id: "marketing-policy", version: 4 },
    marketingPolicyChecked: true,
    agreedAt: "2026-06-22T02:00:00.000Z",
  });

  assert.deepEqual(payload, {
    mm_user_id: "mm.user-123",
    mm_username: "student.name",
    display_name: "김싸피",
    year: 15,
    staff_source_year: null,
    campus: "서울",
    password_hash: "password-hash",
    password_salt: "password-salt",
    must_change_password: false,
    service_policy_version: 2,
    service_policy_consented_at: "2026-06-22T02:00:00.000Z",
    privacy_policy_version: 3,
    privacy_policy_consented_at: "2026-06-22T02:00:00.000Z",
    marketing_policy_version: 4,
    marketing_policy_consented_at: "2026-06-22T02:00:00.000Z",
    ssafy_sub: "pairwise-subject",
    ssafy_verified_at: new Date(1_781_740_800 * 1000).toISOString(),
    ssafy_auth_time: new Date(1_781_740_800 * 1000).toISOString(),
    ssafy_verification_id: "verification-id",
    ssafy_mattermost_user_id: "mm.user-123",
    ssafy_track: "java-major",
    ssafy_track_name: "자바 전공",
    ssafy_last_scope: "ssafy.verify ssafy.affiliation ssafy.mattermost_id",
    avatar_url: "https://verify.myknow.xyz/api/mattermost/avatar/mm.user-123",
    created_at: "2026-06-22T02:00:00.000Z",
    updated_at: "2026-06-22T02:00:00.000Z",
  });
});

test("SSAFY Verify signup payload maps staff to the staff year with source year", async () => {
  const { buildSsafySignupMemberInsertPayload } = await signupModulePromise;
  const payload = buildSsafySignupMemberInsertPayload({
    session: {
      sub: "staff-subject",
      mattermostUserId: "staff.user",
      mattermostUsername: "coach.name",
      displayName: "박코치",
      cohort: 15,
      campus: null,
      isStaff: true,
      sourceYears: [0, 14, 15],
      track: null,
      trackName: null,
      avatarUrl: null,
      authTime: 1_781_740_800,
      verificationId: null,
      scope: null,
    },
    passwordRecord: { hash: "password-hash", salt: "password-salt" },
    activePolicies: {
      service: { id: "service-policy", version: 2 },
      privacy: { id: "privacy-policy", version: 3 },
    },
    marketingPolicy: null,
    marketingPolicyChecked: false,
    agreedAt: "2026-06-22T02:00:00.000Z",
  });

  assert.equal(payload.year, 0);
  assert.equal(payload.staff_source_year, 15);
  assert.equal(payload.marketing_policy_version, null);
  assert.equal(payload.marketing_policy_consented_at, null);
});

test("SSAFY Verify signup payload does not store staff cohort 0 as a source year", async () => {
  const { buildSsafySignupMemberInsertPayload } = await signupModulePromise;
  const payload = buildSsafySignupMemberInsertPayload({
    session: {
      sub: "staff-zero-subject",
      mattermostUserId: "staff.zero",
      mattermostUsername: "staff.zero",
      displayName: "운영진",
      cohort: 0,
      campus: "서울",
      isStaff: true,
      sourceYears: [0],
      track: null,
      trackName: null,
      avatarUrl: null,
      authTime: 1_781_740_800,
      verificationId: "verification-id",
      scope: "ssafy.verify ssafy.affiliation ssafy.role ssafy.mattermost_id",
    },
    passwordRecord: { hash: "password-hash", salt: "password-salt" },
    activePolicies: {
      service: { id: "service-policy", version: 2 },
      privacy: { id: "privacy-policy", version: 3 },
    },
    marketingPolicy: null,
    marketingPolicyChecked: false,
    agreedAt: "2026-06-22T02:00:00.000Z",
  });

  assert.equal(payload.year, 0);
  assert.equal(payload.staff_source_year, null);
});

test("SSAFY Verify signup profile uses the stable subject lookup for staff cohort 0", async () => {
  const originalEnv = {
    issuer: process.env.SSAFY_VERIFY_ISSUER,
    serverClientId: process.env.SSAFY_VERIFY_SERVER_CLIENT_ID,
    serverClientSecret: process.env.SSAFY_VERIFY_SERVER_CLIENT_SECRET,
    apiBaseUrl: process.env.SSAFY_VERIFY_SERVER_API_BASE_URL,
  };
  const originalFetch = globalThis.fetch;

  try {
    process.env.SSAFY_VERIFY_ISSUER = "https://verify.example.com";
    process.env.SSAFY_VERIFY_SERVER_CLIENT_ID = "server-api-client";
    process.env.SSAFY_VERIFY_SERVER_CLIENT_SECRET = "server-secret";
    process.env.SSAFY_VERIFY_SERVER_API_BASE_URL = "https://verify.example.com/v1";

    const requestedUrls: string[] = [];
    globalThis.fetch = (async (input) => {
      const url = String(input);
      requestedUrls.push(url);
      if (url === "https://verify.example.com/v1/server/token") {
        return new Response(
          JSON.stringify({
            access_token: "access-token-1",
            token_type: "Bearer",
            expires_in: 600,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      assert.equal(
        url,
        "https://verify.example.com/v1/ssafy-members/pairwise-subject/profile",
      );
      return new Response(
        JSON.stringify({
          ok: true,
          data: {
            sub: "pairwise-subject",
            ssafy_mattermost_user_id: "staff.zero",
            username: "staff.zero",
            name: "운영진",
            ssafy_cohort: "0",
            ssafy_campus: "서울",
            ssafy_is_staff: true,
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch;

    const { resolveSsafySignupProfile } = await signupProfileModulePromise;
    const result = await resolveSsafySignupProfile({
      claims: {
        sub: "pairwise-subject",
        verified: true,
        authTime: 1_781_740_800,
        cohort: "0",
        campus: "서울",
        region: "서울",
        track: null,
        trackName: null,
        name: "운영진",
        picture: null,
        role: "admin",
        roleName: "운영진",
        teamCode: null,
        isStaff: true,
        mattermostUserId: "staff.zero",
      },
      verificationId: "verification-id",
      scope: "ssafy.verify ssafy.affiliation ssafy.role ssafy.mattermost_id",
    });

    assert.deepEqual(result, {
      ok: true,
      session: {
        sub: "pairwise-subject",
        mattermostUserId: "staff.zero",
        mattermostUsername: "staff.zero",
        displayName: "운영진",
        cohort: 0,
        campus: "서울",
        isStaff: true,
        sourceYears: [0],
        track: null,
        trackName: null,
        avatarUrl: null,
        authTime: 1_781_740_800,
        verificationId: "verification-id",
        scope: "ssafy.verify ssafy.affiliation ssafy.role ssafy.mattermost_id",
      },
    });
    assert.deepEqual(requestedUrls, [
      "https://verify.example.com/v1/server/token",
      "https://verify.example.com/v1/ssafy-members/pairwise-subject/profile",
    ]);
  } finally {
    if (originalEnv.issuer === undefined) delete process.env.SSAFY_VERIFY_ISSUER;
    else process.env.SSAFY_VERIFY_ISSUER = originalEnv.issuer;
    if (originalEnv.serverClientId === undefined) delete process.env.SSAFY_VERIFY_SERVER_CLIENT_ID;
    else process.env.SSAFY_VERIFY_SERVER_CLIENT_ID = originalEnv.serverClientId;
    if (originalEnv.serverClientSecret === undefined) delete process.env.SSAFY_VERIFY_SERVER_CLIENT_SECRET;
    else process.env.SSAFY_VERIFY_SERVER_CLIENT_SECRET = originalEnv.serverClientSecret;
    if (originalEnv.apiBaseUrl === undefined) delete process.env.SSAFY_VERIFY_SERVER_API_BASE_URL;
    else process.env.SSAFY_VERIFY_SERVER_API_BASE_URL = originalEnv.apiBaseUrl;
    globalThis.fetch = originalFetch;
  }
});

test("SSAFY Verify signup profile falls back to Mattermost id when subject profile is unavailable", async () => {
  const originalEnv = {
    issuer: process.env.SSAFY_VERIFY_ISSUER,
    serverClientId: process.env.SSAFY_VERIFY_SERVER_CLIENT_ID,
    serverClientSecret: process.env.SSAFY_VERIFY_SERVER_CLIENT_SECRET,
    apiBaseUrl: process.env.SSAFY_VERIFY_SERVER_API_BASE_URL,
  };
  const originalFetch = globalThis.fetch;

  try {
    process.env.SSAFY_VERIFY_ISSUER = "https://verify.example.com";
    process.env.SSAFY_VERIFY_SERVER_CLIENT_ID = "server-api-client";
    process.env.SSAFY_VERIFY_SERVER_CLIENT_SECRET = "server-secret";
    process.env.SSAFY_VERIFY_SERVER_API_BASE_URL = "https://verify.example.com/v1";

    const requestedUrls: string[] = [];
    globalThis.fetch = (async (input) => {
      const url = String(input);
      requestedUrls.push(url);
      if (url === "https://verify.example.com/v1/server/token") {
        return new Response(
          JSON.stringify({
            access_token: "access-token-1",
            token_type: "Bearer",
            expires_in: 600,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url === "https://verify.example.com/v1/ssafy-members/pairwise-subject/profile") {
        return new Response(
          JSON.stringify({
            ok: false,
            error: {
              code: "PROFILE_NOT_FOUND",
              message: "프로필을 찾을 수 없습니다.",
              request_id: "icn1::profile-sub-404",
            },
          }),
          { status: 404, headers: { "content-type": "application/json" } },
        );
      }

      assert.equal(
        url,
        "https://verify.example.com/v1/mattermost-users/staff.zero/profile",
      );
      return new Response(
        JSON.stringify({
          ok: true,
          data: {
            sub: "pairwise-subject",
            ssafy_mattermost_user_id: "staff.zero",
            username: "staff.zero",
            name: "운영진",
            ssafy_cohort: "0",
            ssafy_campus: "서울",
            ssafy_is_staff: true,
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch;

    const { resolveSsafySignupProfile } = await signupProfileModulePromise;
    const result = await resolveSsafySignupProfile({
      claims: {
        sub: "pairwise-subject",
        verified: true,
        authTime: 1_781_740_800,
        cohort: "0",
        campus: "서울",
        region: "서울",
        track: null,
        trackName: null,
        name: "운영진",
        picture: null,
        role: "admin",
        roleName: "운영진",
        teamCode: null,
        isStaff: true,
        mattermostUserId: "staff.zero",
      },
      verificationId: "verification-id",
      scope: "ssafy.verify ssafy.affiliation ssafy.role ssafy.mattermost_id",
    });

    assert.equal(result.ok, true);
    assert.deepEqual(requestedUrls, [
      "https://verify.example.com/v1/server/token",
      "https://verify.example.com/v1/ssafy-members/pairwise-subject/profile",
      "https://verify.example.com/v1/server/token",
      "https://verify.example.com/v1/mattermost-users/staff.zero/profile",
    ]);
  } finally {
    if (originalEnv.issuer === undefined) delete process.env.SSAFY_VERIFY_ISSUER;
    else process.env.SSAFY_VERIFY_ISSUER = originalEnv.issuer;
    if (originalEnv.serverClientId === undefined) delete process.env.SSAFY_VERIFY_SERVER_CLIENT_ID;
    else process.env.SSAFY_VERIFY_SERVER_CLIENT_ID = originalEnv.serverClientId;
    if (originalEnv.serverClientSecret === undefined) delete process.env.SSAFY_VERIFY_SERVER_CLIENT_SECRET;
    else process.env.SSAFY_VERIFY_SERVER_CLIENT_SECRET = originalEnv.serverClientSecret;
    if (originalEnv.apiBaseUrl === undefined) delete process.env.SSAFY_VERIFY_SERVER_API_BASE_URL;
    else process.env.SSAFY_VERIFY_SERVER_API_BASE_URL = originalEnv.apiBaseUrl;
    globalThis.fetch = originalFetch;
  }
});

test("SSAFY Verify signup profile maps missing Verify profile to a specific error", async () => {
  const originalEnv = {
    issuer: process.env.SSAFY_VERIFY_ISSUER,
    serverClientId: process.env.SSAFY_VERIFY_SERVER_CLIENT_ID,
    serverClientSecret: process.env.SSAFY_VERIFY_SERVER_CLIENT_SECRET,
    apiBaseUrl: process.env.SSAFY_VERIFY_SERVER_API_BASE_URL,
  };
  const originalFetch = globalThis.fetch;

  try {
    process.env.SSAFY_VERIFY_ISSUER = "https://verify.example.com";
    process.env.SSAFY_VERIFY_SERVER_CLIENT_ID = "server-api-client";
    process.env.SSAFY_VERIFY_SERVER_CLIENT_SECRET = "server-secret";
    process.env.SSAFY_VERIFY_SERVER_API_BASE_URL = "https://verify.example.com/v1";

    globalThis.fetch = (async (input) => {
      const url = String(input);
      if (url === "https://verify.example.com/v1/server/token") {
        return new Response(
          JSON.stringify({
            access_token: "access-token-1",
            token_type: "Bearer",
            expires_in: 600,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      assert.equal(
        url,
        "https://verify.example.com/v1/ssafy-members/pairwise-subject/profile",
      );
      return new Response(
        JSON.stringify({
          ok: false,
          error: {
            code: "PROFILE_NOT_FOUND",
            message: "프로필을 찾을 수 없습니다.",
            request_id: "icn1::profile-404",
          },
        }),
        { status: 404, headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch;

    const { resolveSsafySignupProfile } = await signupProfileModulePromise;
    const result = await resolveSsafySignupProfile({
      claims: {
        sub: "pairwise-subject",
        verified: true,
        authTime: 1_781_740_800,
        cohort: "15",
        campus: "서울",
        region: "서울",
        track: null,
        trackName: null,
        name: "김싸피",
        picture: null,
        role: "member",
        roleName: "교육생",
        teamCode: null,
        isStaff: false,
        mattermostUserId: null,
      },
      verificationId: "verification-id",
      scope: "ssafy.verify ssafy.affiliation ssafy.mattermost_id",
    });

    assert.deepEqual(result, {
      ok: false,
      errorCode: "SSAFY_SIGNUP_PROFILE_NOT_FOUND",
      requestId: "icn1::profile-404",
      status: 404,
      providerErrorCode: "PROFILE_NOT_FOUND",
      lookup: "sub",
      diagnostic: {
        cause: "server_api_error",
        message: "프로필을 찾을 수 없습니다.",
      },
    });
  } finally {
    if (originalEnv.issuer === undefined) delete process.env.SSAFY_VERIFY_ISSUER;
    else process.env.SSAFY_VERIFY_ISSUER = originalEnv.issuer;
    if (originalEnv.serverClientId === undefined) delete process.env.SSAFY_VERIFY_SERVER_CLIENT_ID;
    else process.env.SSAFY_VERIFY_SERVER_CLIENT_ID = originalEnv.serverClientId;
    if (originalEnv.serverClientSecret === undefined) delete process.env.SSAFY_VERIFY_SERVER_CLIENT_SECRET;
    else process.env.SSAFY_VERIFY_SERVER_CLIENT_SECRET = originalEnv.serverClientSecret;
    if (originalEnv.apiBaseUrl === undefined) delete process.env.SSAFY_VERIFY_SERVER_API_BASE_URL;
    else process.env.SSAFY_VERIFY_SERVER_API_BASE_URL = originalEnv.apiBaseUrl;
    globalThis.fetch = originalFetch;
  }
});

test("SSAFY Verify signup profile surfaces local Mattermost lookup errors", async () => {
  const originalEnv = {
    issuer: process.env.SSAFY_VERIFY_ISSUER,
    serverClientId: process.env.SSAFY_VERIFY_SERVER_CLIENT_ID,
    serverClientSecret: process.env.SSAFY_VERIFY_SERVER_CLIENT_SECRET,
    apiBaseUrl: process.env.SSAFY_VERIFY_SERVER_API_BASE_URL,
  };

  try {
    process.env.SSAFY_VERIFY_ISSUER = "https://verify.example.com";
    process.env.SSAFY_VERIFY_SERVER_CLIENT_ID = "server-api-client";
    process.env.SSAFY_VERIFY_SERVER_CLIENT_SECRET = "server-secret";
    process.env.SSAFY_VERIFY_SERVER_API_BASE_URL = "https://verify.example.com/v1";

    const { resolveSsafySignupProfile } = await signupProfileModulePromise;
    const result = await resolveSsafySignupProfile({
      claims: {
        sub: "pairwise-subject",
        verified: true,
        authTime: 1_781_740_800,
        cohort: "15",
        campus: "서울",
        region: "서울",
        track: null,
        trackName: null,
        name: "김싸피",
        picture: null,
        role: "member",
        roleName: "교육생",
        teamCode: null,
        isStaff: false,
        mattermostUserId: "bad id with spaces",
      },
      verificationId: "verification-id",
      scope: "ssafy.verify ssafy.affiliation ssafy.mattermost_id",
    });

    assert.deepEqual(result, {
      ok: false,
      errorCode: "SSAFY_SIGNUP_PROFILE_UNAVAILABLE",
      requestId: null,
      status: 503,
      providerErrorCode: "LOCAL_PROFILE_LOOKUP_ERROR",
      lookup: "mattermost_user_id",
      diagnostic: {
        cause: "local_lookup_error",
        message: "Mattermost ID는 3~64자의 영문, 숫자, ., _, -만 사용할 수 있습니다.",
      },
    });
  } finally {
    if (originalEnv.issuer === undefined) delete process.env.SSAFY_VERIFY_ISSUER;
    else process.env.SSAFY_VERIFY_ISSUER = originalEnv.issuer;
    if (originalEnv.serverClientId === undefined) delete process.env.SSAFY_VERIFY_SERVER_CLIENT_ID;
    else process.env.SSAFY_VERIFY_SERVER_CLIENT_ID = originalEnv.serverClientId;
    if (originalEnv.serverClientSecret === undefined) delete process.env.SSAFY_VERIFY_SERVER_CLIENT_SECRET;
    else process.env.SSAFY_VERIFY_SERVER_CLIENT_SECRET = originalEnv.serverClientSecret;
    if (originalEnv.apiBaseUrl === undefined) delete process.env.SSAFY_VERIFY_SERVER_API_BASE_URL;
    else process.env.SSAFY_VERIFY_SERVER_API_BASE_URL = originalEnv.apiBaseUrl;
  }
});

test("SSAFY Verify member lookup rejects duplicate subject linking", async () => {
  const { findSsafyVerifiedMember } = await memberModulePromise;
  const calls: Array<{ table: string; column: string; value: string }> = [];
  const responses = [
    {
      data: {
        id: "current-member",
        must_change_password: false,
        ssafy_sub: null,
        mm_user_id: "mattermost-current",
      },
      error: null,
    },
    {
      data: {
        id: "other-member",
        must_change_password: false,
        ssafy_sub: "pairwise-subject",
        mm_user_id: "mattermost-other",
      },
      error: null,
    },
  ];
  const supabase = {
    from(table: string) {
      return {
        select() {
          return {
            eq(column: string, value: string) {
              calls.push({ table, column, value });
              return {
                async maybeSingle() {
                  return responses.shift() ?? { data: null, error: null };
                },
              };
            },
          };
        },
      };
    },
  } as unknown as Parameters<typeof findSsafyVerifiedMember>[0];

  const result = await findSsafyVerifiedMember(supabase, {
    currentMemberId: "current-member",
    sub: "pairwise-subject",
  });

  assert.deepEqual(calls, [
    { table: "members", column: "id", value: "current-member" },
    { table: "members", column: "ssafy_sub", value: "pairwise-subject" },
  ]);
  assert.deepEqual(result, {
    ok: false,
    errorCode: "SSAFY_MEMBER_CONFLICT",
  });
});

test("member auth rate-limit keys include SSAFY Verify attempts", async () => {
  const {
    buildMemberAuthAttemptKey,
    getMemberAuthAttemptKeys,
    getMemberAuthAttemptScope,
  } = await securityModulePromise;

  assert.equal(
    buildMemberAuthAttemptKey("ssafy-verify", "ip", " 127.0.0.1 "),
    "ssafy-verify:ip:127.0.0.1",
  );
  assert.deepEqual(
    getMemberAuthAttemptKeys("ssafy-verify", {
      ipAddress: "127.0.0.1",
      accountIdentifier: "PairwiseSub",
    }),
    ["ssafy-verify:ip:127.0.0.1", "ssafy-verify:account:pairwisesub"],
  );
  assert.equal(getMemberAuthAttemptScope("ssafy-verify:account:abc"), "account");
});
