import { expect, test } from "@playwright/test";

const viewports = [
  { width: 360, height: 844 },
  { width: 723, height: 884 },
  { width: 820, height: 1180 },
  { width: 1113, height: 884 },
  { width: 1366, height: 900 },
] as const;

test.describe("partner detail introduction", () => {
  test("puts the period in the header and keeps introduction and tags plain", async ({
    baseURL,
    context,
    page,
  }) => {
    if (baseURL) {
      await context.grantPermissions(["clipboard-read", "clipboard-write"], {
        origin: new URL(baseURL).origin,
      });
    }

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
      const heroContent = hero.locator("[data-partner-detail-hero-content]");
      const heroContentBox = await heroContent.boundingBox();
      expect(logoBox).not.toBeNull();
      expect(titleBox).not.toBeNull();
      expect(heroContentBox).not.toBeNull();
      if (logoBox && heroContentBox) {
        expect(Math.abs(logoBox.width - logoBox.height)).toBeLessThanOrEqual(1);
        if (viewport.width >= 480) {
          expect(logoBox.x + logoBox.width).toBeLessThan(titleBox!.x);
          expect(Math.abs(logoBox.height - heroContentBox.height)).toBeLessThanOrEqual(1);
        } else {
          expect(Math.abs(logoBox.width - heroContentBox.width)).toBeLessThanOrEqual(1);
          expect(logoBox.y + logoBox.height).toBeLessThanOrEqual(heroContentBox.y);
        }
      }

      const period = hero.locator("[data-partner-period]");
      const categoryLabel = hero.locator("[data-partner-category-label]");
      const heroActions = hero.getByRole("group", { name: "제휴처 보조 기능" });
      const summary = page.locator("[data-partner-detail-summary]");
      const introduction = summary.locator("[data-partner-introduction-section]");
      const benefitList = summary.getByRole("list", { name: "제휴 혜택" });
      const tagSection = summary.locator("[data-partner-tags-section]");
      const tagList = tagSection.locator("[data-partner-tag-list]");
      await expect(period).toBeVisible();
      await expect(heroContent).toBeVisible();
      await expect(categoryLabel).toBeVisible();
      await expect(heroActions).toBeVisible();
      await expect(categoryLabel).not.toHaveClass(/rounded-full|border/);
      await expect(period).not.toHaveClass(/rounded-full|border|bg-surface-inset/);
      await expect(summary.locator("[data-partner-period]")).toHaveCount(0);
      await expect(introduction).toBeVisible();
      await expect(introduction).toContainText(
        "교육장과 가까운 피트니스 센터로 퇴근 후에도 이용하기 좋고",
      );
      await expect(
        introduction.locator("[data-partner-introduction-container]"),
      ).toBeVisible();
      await expect(benefitList).toBeVisible();
      const introductionComesBeforeBenefits = await introduction.evaluate(
        (introductionElement) => {
          const benefitElement = introductionElement.parentElement?.querySelector(
            '[aria-label="제휴 혜택"]',
          );
          return Boolean(
            benefitElement &&
              (introductionElement.compareDocumentPosition(benefitElement) &
                Node.DOCUMENT_POSITION_FOLLOWING),
          );
        },
      );
      expect(introductionComesBeforeBenefits).toBe(true);
      await expect(summary.locator("details")).toHaveCount(0);
      await expect(tagSection.getByRole("heading", { level: 3 })).toHaveText("태그");
      await expect(tagSection.locator("p")).toHaveCount(0);
      await expect(tagList).toBeVisible();
      await expect(tagList.locator("[data-partner-tag]")).toHaveCount(2);

      const periodBox = await period.boundingBox();
      if (titleBox && periodBox) {
        const titleToPeriodGap = periodBox.y - (titleBox.y + titleBox.height);
        expect(titleToPeriodGap).toBeGreaterThanOrEqual(0);
        expect(titleToPeriodGap).toBeLessThanOrEqual(16);
      }

      const documentWidth = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(documentWidth.scrollWidth).toBe(documentWidth.clientWidth);

      if (viewport.width === 360 || viewport.width === 1366) {
        await heroActions.getByRole("button", { name: "공유 링크 복사" }).click();
        const toastStatus = page.getByRole("status").filter({
          hasText: "공유 링크가 복사되었습니다.",
        });
        const toast = page.locator("[data-toast-item]", {
          has: toastStatus,
        });
        const fixedAction =
          viewport.width < 768
            ? page.locator("[data-partner-detail-mobile-action-bar]")
            : page.locator("[data-partner-detail-desktop-action-fab]");

        await expect(toastStatus).toBeVisible();
        await expect(toast).toBeVisible();
        await expect(toast).toHaveClass(/ui-toast-glass/);
        const backdropFilter = await toast.evaluate(
          (element) => getComputedStyle(element).backdropFilter,
        );
        expect(backdropFilter).toContain("blur(24px)");
        await expect(fixedAction).toBeVisible();
        const [toastBox, fixedActionBox] = await Promise.all([
          toast.boundingBox(),
          fixedAction.boundingBox(),
        ]);
        expect(toastBox).not.toBeNull();
        expect(fixedActionBox).not.toBeNull();
        if (toastBox && fixedActionBox) {
          expect(
            fixedActionBox.y - (toastBox.y + toastBox.height),
          ).toBeGreaterThanOrEqual(16);
        }

        const dismissButton = toast.getByRole("button", {
          name: "알림 닫기",
        });
        await expect(dismissButton).toHaveClass(/h-11/);
        await expect(dismissButton).toHaveClass(/w-11/);
        await dismissButton.click();
        await expect(toastStatus).toHaveCount(0);
      }
    }
  });
});
