import assert from "node:assert/strict";
import test from "node:test";

type RedirectModule = typeof import("../src/lib/ssafy-verify/redirect.ts");
type ConfigModule = typeof import("../src/lib/ssafy-verify/config.ts");
type SchemaModule = typeof import("../src/lib/ssafy-verify/schema.ts");

const redirectModulePromise = import(
  new URL("../src/lib/ssafy-verify/redirect.ts", import.meta.url).href,
) as Promise<RedirectModule>;
const configModulePromise = import(
  new URL("../src/lib/ssafy-verify/config.ts", import.meta.url).href,
) as Promise<ConfigModule>;
const schemaModulePromise = import(
  new URL("../src/lib/ssafy-verify/schema.ts", import.meta.url).href,
) as Promise<SchemaModule>;

test("SSAFY Verify redirect URI is derived from the current origin", async () => {
  const { buildSsafyVerifyRedirectUri } = await redirectModulePromise;

  assert.equal(
    buildSsafyVerifyRedirectUri("http://localhost:3000"),
    "http://localhost:3000/auth/ssafy",
  );
  assert.equal(
    buildSsafyVerifyRedirectUri("https://ssartnership-git-dev-myknows-projects.vercel.app"),
    "https://ssartnership-git-dev-myknows-projects.vercel.app/auth/ssafy",
  );
  assert.equal(
    buildSsafyVerifyRedirectUri("https://ssartnership.myknow.xyz"),
    "https://ssartnership.myknow.xyz/auth/ssafy",
  );
});

test("SSAFY Verify server redirect list supports exact comma and newline entries", async () => {
  const { parseSsafyVerifyRedirectUris } = await configModulePromise;

  assert.deepEqual(
    parseSsafyVerifyRedirectUris(`
      https://ssartnership.myknow.xyz/auth/ssafy,
      https://ssartnership-git-dev-myknows-projects.vercel.app/auth/ssafy
      http://localhost:3000/auth/ssafy
    `),
    [
      "https://ssartnership.myknow.xyz/auth/ssafy",
      "https://ssartnership-git-dev-myknows-projects.vercel.app/auth/ssafy",
      "http://localhost:3000/auth/ssafy",
    ],
  );
});

test("SSAFY Verify allowed redirects include only configured exact URLs and loopback request origin", async () => {
  const {
    buildSsafyVerifyRequestRedirectUri,
    isLoopbackRedirectUri,
    resolveSsafyVerifyAllowedRedirectUris,
  } = await redirectModulePromise;

  const localRedirectUri = buildSsafyVerifyRequestRedirectUri(
    new Request("http://localhost:3000/api/ssafy/verify-token"),
  );
  const previewRedirectUri = buildSsafyVerifyRequestRedirectUri(
    new Request("https://ssartnership-git-dev-myknows-projects.vercel.app/api/ssafy/verify-token"),
  );

  assert.deepEqual(
    resolveSsafyVerifyAllowedRedirectUris(
      {
        redirectUris: ["https://ssartnership.myknow.xyz/auth/ssafy"],
      },
      localRedirectUri,
    ),
    [
      "https://ssartnership.myknow.xyz/auth/ssafy",
      "http://localhost:3000/auth/ssafy",
    ],
  );
  assert.deepEqual(
    resolveSsafyVerifyAllowedRedirectUris(
      {
        redirectUris: ["https://ssartnership.myknow.xyz/auth/ssafy"],
      },
      previewRedirectUri,
    ),
    ["https://ssartnership.myknow.xyz/auth/ssafy"],
  );
  assert.equal(isLoopbackRedirectUri("http://127.0.0.1:3000/auth/ssafy"), true);
  assert.equal(isLoopbackRedirectUri("http://[::1]:3000/auth/ssafy"), true);
  assert.equal(isLoopbackRedirectUri("https://evil.example.com/auth/ssafy"), false);
});

test("SSAFY Verify callback parser accepts any configured exact redirect URI", async () => {
  const { parseSsafyVerifyCallbackBody } = await schemaModulePromise;
  const issuer = "https://verify.myknow.xyz";
  const redirectUris = [
    "https://ssartnership.myknow.xyz/auth/ssafy",
    "https://ssartnership-git-dev-myknows-projects.vercel.app/auth/ssafy",
    "http://localhost:3000/auth/ssafy",
  ];

  assert.equal(
    parseSsafyVerifyCallbackBody(
      {
        code: "0123456789abcdef",
        codeVerifier: "A".repeat(43),
        redirectUri: "http://localhost:3000/auth/ssafy",
        iss: issuer,
      },
      { issuer, redirectUris },
    ).ok,
    true,
  );
  assert.deepEqual(
    parseSsafyVerifyCallbackBody(
      {
        code: "0123456789abcdef",
        codeVerifier: "A".repeat(43),
        redirectUri: "https://evil.example.com/auth/ssafy",
        iss: issuer,
      },
      { issuer, redirectUris },
    ),
    { ok: false, errorCode: "REDIRECT_URI_MISMATCH" },
  );
});
