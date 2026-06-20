import assert from "node:assert/strict";
import test from "node:test";

type ClaimsModule = typeof import("../src/lib/ssafy-verify/claims.ts");
type SchemaModule = typeof import("../src/lib/ssafy-verify/schema.ts");
type MemberModule = typeof import("../src/lib/ssafy-verify/member.ts");
type ScopesModule = typeof import("../src/lib/ssafy-verify/scopes.ts");
type SecurityModule = typeof import("../src/lib/member-auth-security.ts");

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
    ssafy_last_scope: "ssafy.verify ssafy.affiliation ssafy.mattermost_id",
    updated_at: payload.updated_at,
  });
  assert.match(payload.updated_at, /^\d{4}-\d{2}-\d{2}T/);
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
