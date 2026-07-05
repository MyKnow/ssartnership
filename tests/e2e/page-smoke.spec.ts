import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import {
  adminGuardRoutes,
  authSmokeRoutes,
  memberProtectedRoutes,
  partnerProtectedRoutes,
  publicSmokeRoutes,
  type RedirectRoute,
  type SmokeRoute,
} from "./fixtures/routes";

async function expectNoNextError(page: Page) {
  await expect(
    page.getByText(
      /Application error|Unhandled Runtime Error|This page could not be found/,
    ),
  ).toHaveCount(0);
}

test.describe("page smoke coverage", () => {
  test.describe("public and login pages", () => {
    for (const route of [...publicSmokeRoutes, ...authSmokeRoutes]) {
      test(`renders ${route.path}`, async ({ page }) => {
        await visitSmokeRoute(page, route);
      });
    }
  });

  test.describe("protected page redirects", () => {
    for (const route of [
      ...memberProtectedRoutes,
      ...partnerProtectedRoutes,
    ]) {
      test(`redirects ${route.path}`, async ({ page }) => {
        await visitRedirectRoute(page, route);
      });
    }
  });

  test.describe("admin edge guard", () => {
    for (const route of adminGuardRoutes) {
      test(`guards ${route.path}`, async ({ request }) => {
        await visitAdminGuardRoute(request, route);
      });
    }
  });
});

async function visitSmokeRoute(page: Page, route: SmokeRoute) {
  const response = await page.goto(route.path);

  expect(response?.status(), route.path).toBeLessThan(500);
  await expect(page.locator("body")).toContainText(route.expected);
  await expectNoNextError(page);
}

async function visitRedirectRoute(page: Page, route: RedirectRoute) {
  const response = await page.goto(route.path);

  expect(response?.status(), route.path).toBeLessThan(500);
  await expect(page).toHaveURL(
    new RegExp(`${route.expectedPath.replaceAll("/", "\\/")}`),
  );
  await expectNoNextError(page);
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
    const body = await response.text();
    expect(body, route.path).toMatch(/로그인/);
    return;
  }

  expect([302, 303, 307, 308], route.path).toContain(status);
  expect(response.headers().location ?? "", route.path).toMatch(
    /\/admin\/login|\/auth\/login/,
  );
}
