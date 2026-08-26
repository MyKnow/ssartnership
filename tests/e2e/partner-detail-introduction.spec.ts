import { expect, test } from "@playwright/test";

const viewports = [
  { width: 360, height: 844 },
  { width: 820, height: 1180 },
  { width: 1366, height: 900 },
] as const;

test.describe("partner detail introduction", () => {
  test("keeps identity compact and reveals the full introduction on demand", async ({
    page,
  }) => {
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.goto("/partners/health-001");
      await page.waitForLoadState("networkidle");
      await page.evaluate(() => document.fonts.ready);

      const hero = page.locator("[data-partner-detail-hero-info]");
      const logo = hero.locator('[data-partner-image-carousel="hero"]');
      const title = hero.getByRole("heading", { level: 1 });
      await expect(hero).toBeVisible();
      await expect(logo).toBeVisible();
      await expect(title).toHaveText("바디라인 피트니스");
      await expect(hero.locator("header p")).toHaveCount(0);

      const [logoBox, titleBox] = await Promise.all([
        logo.boundingBox(),
        title.boundingBox(),
      ]);
      expect(logoBox).not.toBeNull();
      expect(titleBox).not.toBeNull();
      if (logoBox && titleBox) {
        expect(logoBox.x + logoBox.width).toBeLessThan(titleBox.x);
      }

      const period = page.locator("[data-partner-period]");
      const disclosure = page.locator("[data-partner-introduction-disclosure]");
      const disclosureSummary = disclosure.locator("summary");
      const tagList = disclosure.locator("[data-partner-tag-list]");
      await expect(period).toBeVisible();
      await expect(disclosure).not.toHaveAttribute("open");
      await expect(disclosureSummary).toContainText("제휴처 소개·태그");
      await expect(disclosureSummary).toContainText("태그 2개");
      await expect(tagList).toBeHidden();

      const summaryBox = await disclosureSummary.boundingBox();
      expect(summaryBox).not.toBeNull();
      expect(summaryBox?.height).toBeGreaterThanOrEqual(44);

      await disclosureSummary.focus();
      await disclosureSummary.press("Enter");
      await expect(disclosure).toHaveAttribute("open", "");
      await expect(disclosure.locator("[data-partner-introduction-content]")).toBeVisible();
      await expect(tagList).toBeVisible();
      await expect(tagList.locator("[data-partner-tag]")).toHaveCount(2);

      const documentWidth = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(documentWidth.scrollWidth).toBe(documentWidth.clientWidth);
    }
  });
});
