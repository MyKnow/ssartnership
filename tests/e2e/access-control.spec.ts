import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import {
  adminGuardRoutes,
  memberProtectedRoutes,
  partnerProtectedRoutes,
  type RedirectRoute,
} from "./fixtures/routes";

const criticalRedirectPaths = new Set(["/certification", "/partner"]);
const criticalAdminPaths = new Set(["/admin/login", "/admin"]);

function criticalTitle(path: string, title: string, criticalPaths: Set<string>) {
  return `${criticalPaths.has(path) ? "@critical " : ""}${title}`;
}

async function expectNoNextError(page: Page) {
  await expect(
    page.getByText(
      /Application error|Unhandled Runtime Error|This page could not be found/,
    ),
  ).toHaveCount(0);
}

test.describe("protected route access control", () => {
  test.describe("protected page redirects", () => {
    for (const route of memberProtectedRoutes) {
      test(
        criticalTitle(
          route.path,
          `redirects ${route.path}`,
          criticalRedirectPaths,
        ),
        async ({ page }) => {
          await visitMemberRedirectRoute(page, route);
        },
      );
    }
    for (const route of partnerProtectedRoutes) {
      test(
        criticalTitle(
          route.path,
          `redirects ${route.path}`,
          criticalRedirectPaths,
        ),
        async ({ request }) => {
          await visitPartnerRedirectRoute(request, route);
        },
      );
    }
  });

  test.describe("admin edge guard", () => {
    for (const route of adminGuardRoutes) {
      test(
        criticalTitle(route.path, `guards ${route.path}`, criticalAdminPaths),
        async ({ request }) => {
          await visitAdminGuardRoute(request, route);
        },
      );
    }
  });
});

async function visitMemberRedirectRoute(page: Page, route: RedirectRoute) {
  const response = await page.goto(route.path);

  expect(response?.status(), route.path).toBeLessThan(500);
  await expect(page).toHaveURL(
    new RegExp(`${route.expectedPath.replaceAll("/", "\\/")}`),
  );
  await expectNoNextError(page);
  await page.waitForLoadState("load");
}

async function visitPartnerRedirectRoute(
  request: APIRequestContext,
  route: RedirectRoute,
) {
  const response = await request.get(route.path, { maxRedirects: 0 });

  expect([302, 303, 307, 308], route.path).toContain(response.status());
  expect(response.headers().location ?? "", route.path).toContain(
    route.expectedPath,
  );
}

async function visitAdminGuardRoute(
  request: APIRequestContext,
  route: { path: string },
) {
  const response = await request.get(route.path, { maxRedirects: 0 });
  const status = response.status();

  expect(status, route.path).toBeLessThan(500);
  if (status === 401) {
    expect(
      response.headers()["www-authenticate"] ?? "",
      route.path,
    ).toContain('Basic realm="Admin Area"');
    return;
  }

  if (route.path === "/admin/login") {
    const location = response.headers().location ?? "";
    if ([302, 303, 307, 308].includes(status)) {
      expect(location, route.path).toMatch(/\/auth\/login\?returnTo=%2Fadmin/);
      return;
    }

    const body = await response.text();
    expect(body, route.path).toMatch(/\/auth\/login\?returnTo=%2Fadmin|로그인/);
    return;
  }

  expect([302, 303, 307, 308], route.path).toContain(status);
  expect(response.headers().location ?? "", route.path).toMatch(
    /\/admin\/login|\/auth\/login/,
  );
}
