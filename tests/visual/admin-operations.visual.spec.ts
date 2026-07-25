import { expect, test } from "@playwright/test";

const screens = [
  {
    key: "operation-flow",
    storyId: "domains-admin-adminoperationflow--current-step",
  },
  {
    key: "push",
    storyId: "domains-admin-adminpushmanager--visual-baseline",
  },
  {
    key: "notifications",
    storyId: "domains-admin-adminnotificationsview--default",
  },
  {
    key: "advertisement",
    storyId: "domains-admin-adminadvertisementview--default",
  },
  {
    key: "event-list",
    storyId: "domains-admin-admineventlistview--default",
  },
  {
    key: "event-detail",
    storyId: "domains-admin-admineventdetailview--default",
  },
  {
    key: "cycle",
    storyId: "domains-admin-admincycleview--default",
  },
  {
    key: "accounts",
    storyId: "domains-admin-adminaccountsview--default",
  },
] as const;

const viewports = [
  { key: "mobile-360", width: 360, height: 844 },
  { key: "tablet-820", width: 820, height: 1180 },
  { key: "desktop-1366", width: 1366, height: 900 },
] as const;

for (const screen of screens) {
  for (const viewport of viewports) {
    test(`${screen.key} ${viewport.key}`, async ({ page }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(`/iframe.html?id=${screen.storyId}&viewMode=story`, {
        waitUntil: "domcontentloaded",
      });
      await page.locator("#storybook-root").waitFor({ state: "visible" });
      await page.evaluate(async () => {
        await document.fonts.ready;
      });
      await page.addStyleTag({
        content: `
          *, *::before, *::after {
            animation-delay: 0s !important;
            animation-duration: 0s !important;
            caret-color: transparent !important;
            transition-delay: 0s !important;
            transition-duration: 0s !important;
          }
        `,
      });

      const dimensions = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(dimensions.scrollWidth).toBe(dimensions.clientWidth);
      await expect(page).toHaveScreenshot(
        `admin-operations-${screen.key}-${viewport.key}.png`,
        {
          animations: "disabled",
          caret: "hide",
          maxDiffPixelRatio: 0.015,
          scale: "css",
        },
      );
    });
  }
}
