import { expect, test } from "@playwright/test";

const screens = [
  { key: "home", storyId: "screens-public-homedirectoryview--default" },
  {
    key: "partner-detail",
    storyId: "screens-public-partnerdetailview--default",
  },
  {
    key: "partner-detail-locked",
    storyId: "screens-public-partnerdetailaccessgate--locked",
  },
  {
    key: "partner-registration",
    storyId: "domains-partnerregistration-actualview--web-input",
  },
  {
    key: "partner-dashboard",
    storyId:
      "domains-partner-pagestates-dashboard--cafe-ssafy-mixed-plans",
  },
  {
    key: "admin-dashboard",
    storyId: "domains-admin-pagestates--dashboard-overview",
  },
  {
    key: "admin-members",
    storyId: "domains-admin-adminmembermanager--default",
  },
  {
    key: "admin-cycle",
    storyId: "domains-admin-admincycleview--mattermost-sender-management",
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
        `${screen.key}-${viewport.key}.png`,
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
