import { expect, test, type Page } from "@playwright/test";
import {
  adminProtectedRoutes,
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
      ...adminProtectedRoutes,
    ]) {
      test(`redirects ${route.path}`, async ({ page }) => {
        await visitRedirectRoute(page, route);
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
