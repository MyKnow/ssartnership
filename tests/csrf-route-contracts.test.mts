import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const STATE_CHANGING_CRON_GET_ROUTES = [
  "anonymize-deleted-members",
  "archive-expired-promotions",
  "cleanup-graduate-verification-files",
  "cleanup-image-uploads",
  "cleanup-manual-member-imports",
  "mattermost-sender-health",
  "partner-billing",
  "purge-expired-operational-logs",
  "push-expiring-partners",
  "rss",
] as const;

function read(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

test("state-changing cron GET routes require the Vercel cron bearer secret only", () => {
  const vercelConfig = JSON.parse(read("../vercel.json")) as {
    crons?: Array<{ path?: string }>;
  };
  const configuredCronPaths = new Set(
    (vercelConfig.crons ?? []).map((entry) => entry.path),
  );

  for (const routeName of STATE_CHANGING_CRON_GET_ROUTES) {
    const relativePath = `../src/app/api/cron/${routeName}/route.ts`;
    const source = read(relativePath);

    assert.equal(
      configuredCronPaths.has(`/api/cron/${routeName}`),
      true,
      `${relativePath} must remain registered as a Vercel cron path`,
    );
    assert.match(
      source,
      /export async function GET\(request: NextRequest\)/,
      `${relativePath} must keep Vercel cron GET compatibility`,
    );
    assert.match(source, /process\.env\.CRON_SECRET/);
    assert.match(
      source,
      /request\.headers\.get\("authorization"\) === `Bearer \$\{secret\}`/,
      `${relativePath} must require the configured bearer credential`,
    );
    assert.match(
      source,
      /if \(!isAuthorizedByCronSecret\(request\)\)/,
      `${relativePath} must gate execution on the bearer credential alone`,
    );
    assert.doesNotMatch(
      source,
      /isAdminSession|getAdminSession|getSignedUserSession|@\/lib\/auth|cookies\(|request\.cookies|admin_session|user_session|partner_session/,
      `${relativePath} must not accept browser session cookies`,
    );
  }
});

test("admin session bridge guards its GET mutation before reading or setting sessions", () => {
  const source = read("../src/app/admin/session/route.ts");
  const guardIndex = source.indexOf(
    "if (!isTrustedAdminSessionNavigation(request))",
  );
  const memberSessionReadIndex = source.indexOf("await getSignedUserSession()");
  const mutationIndex = source.indexOf("await setAdminSession(adminAccount)");

  assert.match(source, /export async function GET\(request: NextRequest\)/);
  assert.match(source, /isTrustedAdminSessionNavigation/);
  assert.ok(guardIndex >= 0, "admin session bridge must reject untrusted GET requests");
  assert.ok(
    guardIndex < memberSessionReadIndex,
    "same-origin enforcement must happen before member session processing",
  );
  assert.ok(
    guardIndex < mutationIndex,
    "same-origin enforcement must happen before the admin cookie mutation",
  );
  assert.match(source, /same_origin_failed/);
  assert.match(source, /status: 403/);
});

test("admin bridge navigation guard preserves direct and proxy navigation without trusting cross-site links", async () => {
  const { isTrustedAdminSessionNavigation } = await import(
    new URL("../src/lib/request-guards.ts", import.meta.url).href
  );
  const requestUrl = "https://partnership.example/admin/session?returnTo=/admin";
  const trustedHeaderCases: Array<Record<string, string>> = [
    {
      "sec-fetch-mode": "navigate",
      "sec-fetch-site": "none",
    },
    {
      "sec-fetch-mode": "navigate",
      "sec-fetch-site": "same-origin",
    },
    { referer: "https://partnership.example/admin" },
  ];
  const untrustedHeaderCases: Array<Record<string, string>> = [
    {
      "sec-fetch-mode": "navigate",
      "sec-fetch-site": "cross-site",
      referer: "https://evil.example/",
    },
    {
      "sec-fetch-mode": "navigate",
      "sec-fetch-site": "same-site",
      referer: "https://subdomain.partnership.example/",
    },
    {
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
      origin: "https://partnership.example",
    },
    { "sec-fetch-mode": "navigate" },
    { "sec-fetch-site": "same-origin" },
    { origin: "https://evil.example" },
    { referer: "https://evil.example/admin" },
    { origin: "//evil.example" },
    { referer: "//evil.example/admin" },
    { origin: "null" },
    {},
  ];

  for (const headers of trustedHeaderCases) {
    assert.equal(
      isTrustedAdminSessionNavigation(new Request(requestUrl, { headers })),
      true,
      `trusted navigation must remain valid: ${JSON.stringify(headers)}`,
    );
  }

  for (const headers of untrustedHeaderCases) {
    assert.equal(
      isTrustedAdminSessionNavigation(new Request(requestUrl, { headers })),
      false,
      `untrusted source must be rejected: ${JSON.stringify(headers)}`,
    );
  }
});

test("partner logout is a same-origin POST exposed only through live POST forms", () => {
  const route = read("../src/app/partner/logout/route.ts");
  const guardIndex = route.indexOf("if (!isTrustedSameOriginRequest(request))");
  const mutationIndex = route.indexOf("await clearPartnerSession()");

  assert.match(route, /export async function POST\(request: Request\)/);
  assert.doesNotMatch(route, /export async function GET\(/);
  assert.ok(guardIndex >= 0, "partner logout must reject untrusted POST requests");
  assert.ok(
    guardIndex < mutationIndex,
    "same-origin enforcement must happen before the partner cookie mutation",
  );
  assert.match(
    route,
    /NextResponse\.redirect\(new URL\("\/partner\/login", request\.url\), 303\)/,
    "successful POST logout must redirect with See Other",
  );

  const actionLinks = read("../src/components/partner/PartnerPortalActionLinks.tsx");
  const shell = read("../src/components/partner/PartnerPortalShellView.tsx");
  const logoutButton = read("../src/components/partner/PartnerLogoutButton.tsx");

  for (const source of [actionLinks, shell]) {
    assert.doesNotMatch(source, /href=[{\"']+\/partner\/logout/);
    assert.match(source, /PartnerLogoutButton/);
  }
  assert.equal(
    [...shell.matchAll(/<PartnerLogoutButton/g)].length,
    2,
    "mobile and desktop shell logout controls must both submit POST forms",
  );
  assert.match(logoutButton, /action="\/partner\/logout"/);
  assert.match(logoutButton, /method="post"/);
  assert.match(logoutButton, /type="submit"/);
  assert.match(logoutButton, /loading={isSubmitting}/);
  assert.match(logoutButton, /role="status"/);
  assert.match(logoutButton, /aria-live="polite"/);
});
