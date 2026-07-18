import { expect, test } from "@playwright/test";

const states = [
  {
    key: "email",
    storyId: "screens-auth-graduateverificationapplication--email-verification",
    heading: "1. 이메일 인증",
  },
  {
    key: "details",
    storyId: "screens-auth-graduateverificationapplication--education-details",
    heading: "2. 교육 정보",
  },
  {
    key: "files",
    storyId: "screens-auth-graduateverificationapplication--file-submission",
    heading: "3. 교육이수증과 본인 사진",
  },
] as const;

const viewports = [
  { key: "mobile-360", width: 360, height: 844 },
  { key: "tablet-820", width: 820, height: 1180 },
  { key: "desktop-1366", width: 1366, height: 900 },
] as const;

const overflowViewports = [
  { key: "mobile-320", width: 320, height: 844 },
  { key: "mobile-360", width: 360, height: 844 },
  { key: "mobile-390", width: 390, height: 844 },
  { key: "tablet-768", width: 768, height: 1024 },
  { key: "tablet-820", width: 820, height: 1180 },
  { key: "tablet-1024", width: 1024, height: 1180 },
  { key: "desktop-1366", width: 1366, height: 900 },
  { key: "desktop-1440", width: 1440, height: 1024 },
  { key: "desktop-1536", width: 1536, height: 1024 },
] as const;

for (const state of states) {
  for (const viewport of viewports) {
    test(`graduate verification ${state.key} ${viewport.key}`, async ({ page }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(`/iframe.html?id=${state.storyId}&viewMode=story`, {
        waitUntil: "domcontentloaded",
      });
      await page.locator("#storybook-root").waitFor({ state: "visible" });
      await expect(page.getByRole("heading", { name: state.heading })).toBeVisible();
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
        `graduate-verification-${state.key}-${viewport.key}.png`,
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

for (const state of states) {
  for (const viewport of overflowViewports) {
    test(`graduate verification ${state.key} has no horizontal overflow at ${viewport.key}`, async ({ page }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await page.goto(`/iframe.html?id=${state.storyId}&viewMode=story`, {
        waitUntil: "domcontentloaded",
      });
      await page.locator("#storybook-root").waitFor({ state: "visible" });
      await expect(page.getByRole("heading", { name: state.heading })).toBeVisible();

      const dimensions = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(dimensions.scrollWidth).toBe(dimensions.clientWidth);
    });
  }
}
