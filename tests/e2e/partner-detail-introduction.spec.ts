import { expect, test } from "@playwright/test";
import { waitForPageReady } from "./page-ready";

const viewports = [
  { width: 360, height: 844 },
  { width: 445, height: 884 },
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

      const detailContainer = page.locator("main > div.mx-auto.w-full").first();
      const hero = page.locator("[data-partner-detail-hero-info]");
      await waitForPageReady(page, hero);
      const title = hero.getByRole("heading", { level: 1 });
      const [detailContainerStyles, detailContainerBox] = await Promise.all([
        detailContainer.evaluate((element) => {
          const style = getComputedStyle(element);
          return {
            paddingLeft: style.paddingLeft,
            paddingRight: style.paddingRight,
            paddingTop: style.paddingTop,
          };
        }),
        detailContainer.boundingBox(),
      ]);
      expect(detailContainerBox).not.toBeNull();
      if (viewport.width < 640) {
        expect(detailContainerStyles).toEqual({
          paddingLeft: "0px",
          paddingRight: "0px",
          paddingTop: "16px",
        });
        expect(detailContainerBox?.x).toBeLessThanOrEqual(1);
        expect(
          Math.abs((detailContainerBox?.width ?? 0) - viewport.width),
        ).toBeLessThanOrEqual(1);
      } else {
        expect(detailContainerStyles.paddingLeft).not.toBe("0px");
        expect(detailContainerStyles.paddingRight).not.toBe("0px");
        expect(detailContainerStyles.paddingTop).toBe("40px");
        expect(detailContainerBox?.x).toBeGreaterThan(0);
        expect(detailContainerBox?.width).toBeLessThan(viewport.width);
      }
      await expect(hero).toBeVisible();
      await expect(
        hero.locator('[data-partner-image-carousel="hero"]'),
      ).toHaveCount(0);
      await expect(title).toHaveText("바디라인 피트니스");
      await expect(hero.locator("header p")).toHaveCount(0);

      const heroContent = hero.locator("[data-partner-detail-hero-content]");
      await expect(heroContent).toBeVisible();
      const [heroBox, heroContentBox, titleBox] = await Promise.all([
        hero.boundingBox(),
        heroContent.boundingBox(),
        title.boundingBox(),
      ]);
      expect(heroBox).not.toBeNull();
      expect(heroContentBox).not.toBeNull();
      expect(titleBox).not.toBeNull();
      if (heroBox && heroContentBox) {
        expect(heroContentBox.x).toBeGreaterThanOrEqual(heroBox.x);
        expect(heroContentBox.x + heroContentBox.width).toBeLessThanOrEqual(
          heroBox.x + heroBox.width + 1,
        );
      }

      const gallery = page.locator("[data-partner-detail-gallery]");
      await expect(gallery).toHaveCount(0);

      const period = hero.locator("[data-partner-period]");
      const heroMeta = hero.locator("[data-partner-detail-meta]");
      const categoryLabel = hero.locator("[data-partner-category-label]");
      const heroActions = hero.getByRole("group", { name: "제휴처 보조 기능" });
      const summary = page.locator("[data-partner-detail-summary]");
      const introduction = summary.locator(
        "[data-partner-introduction-section]",
      );
      const benefitList = summary.getByRole("list", { name: "제휴 혜택" });
      const tagSection = summary.locator("[data-partner-tags-section]");
      const tagList = tagSection.locator("[data-partner-tag-list]");
      await expect(period).toBeVisible();
      await expect(heroMeta).toHaveCount(1);
      await expect(heroMeta).toHaveClass("contents");
      await expect(categoryLabel).toBeVisible();
      await expect(heroActions).toBeVisible();
      await expect(categoryLabel).toHaveAttribute("aria-label", /카테고리 /);
      await expect(categoryLabel).toHaveClass(/rounded-full/);
      await expect(categoryLabel).toHaveClass(/border/);
      await expect(categoryLabel).toHaveClass(/h-9/);
      await expect(categoryLabel.locator("[aria-hidden='true']")).toHaveCount(
        0,
      );
      await expect(period).not.toHaveClass(
        /rounded-full|border|bg-surface-inset/,
      );
      const mobileContentOrder = await heroContent.evaluate((contentElement) => {
        const categoryElement = contentElement.querySelector(
          "[data-partner-category-label]",
        );
        const titleElement = contentElement.querySelector("h1");
        const periodElement = contentElement.querySelector(
          "[data-partner-period]",
        );
        const precedes = (first: Element | null, second: Element | null) =>
          Boolean(
            first &&
              second &&
              first.compareDocumentPosition(second) &
                Node.DOCUMENT_POSITION_FOLLOWING,
          );

        return {
          categoryBeforeTitle: precedes(categoryElement, titleElement),
          titleBeforePeriod: precedes(titleElement, periodElement),
        };
      });
      expect(mobileContentOrder).toEqual({
        categoryBeforeTitle: true,
        titleBeforePeriod: true,
      });
      const [categoryBox, periodMetaBox, heroActionsBox] = await Promise.all([
        categoryLabel.boundingBox(),
        period.boundingBox(),
        heroActions.boundingBox(),
      ]);
      expect(categoryBox).not.toBeNull();
      expect(periodMetaBox).not.toBeNull();
      expect(heroActionsBox).not.toBeNull();
      if (categoryBox && periodMetaBox && heroActionsBox && titleBox) {
        const categoryCenter = categoryBox.y + categoryBox.height / 2;
        const periodCenter = periodMetaBox.y + periodMetaBox.height / 2;
        if (viewport.width < 640) {
          const actionsCenter = heroActionsBox.y + heroActionsBox.height / 2;
          expect(Math.abs(categoryCenter - actionsCenter)).toBeLessThanOrEqual(
            1,
          );
          expect(categoryBox.x + categoryBox.width).toBeLessThanOrEqual(
            heroActionsBox.x + 1,
          );
          expect(categoryBox.y + categoryBox.height).toBeLessThanOrEqual(
            titleBox.y + 1,
          );
          expect(titleBox.y + titleBox.height).toBeLessThanOrEqual(
            periodMetaBox.y + 1,
          );
        } else {
          expect(Math.abs(categoryCenter - periodCenter)).toBeLessThanOrEqual(
            1,
          );
          const actionsCenter = heroActionsBox.y + heroActionsBox.height / 2;
          const titleCenter = titleBox.y + titleBox.height / 2;
          expect(Math.abs(titleCenter - actionsCenter)).toBeLessThanOrEqual(1);
        }
      }
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
          const benefitElement =
            introductionElement.parentElement?.querySelector(
              '[aria-label="제휴 혜택"]',
            );
          return Boolean(
            benefitElement &&
            introductionElement.compareDocumentPosition(benefitElement) &
              Node.DOCUMENT_POSITION_FOLLOWING,
          );
        },
      );
      expect(introductionComesBeforeBenefits).toBe(true);
      await expect(summary.locator("details")).toHaveCount(0);
      await expect(tagSection.getByRole("heading", { level: 3 })).toHaveText(
        "태그",
      );
      await expect(tagSection.locator("p")).toHaveCount(0);
      await expect(tagList).toBeVisible();
      await expect(tagList.locator("[data-partner-tag]")).toHaveCount(2);
      const audienceList = summary.getByRole("list", {
        name: "적용 대상 목록",
      });
      const inactiveAudience = audienceList.getByRole("listitem", {
        name: "수료생: 적용 대상 아님",
      });
      await expect(inactiveAudience).toHaveAttribute(
        "data-audience-active",
        "false",
      );
      await expect(inactiveAudience.locator(":scope > span")).toHaveClass(
        /bg-surface-muted\/35/,
      );
      await expect(inactiveAudience.locator(":scope > span")).toHaveClass(
        /text-muted-foreground/,
      );
      await expect(
        inactiveAudience.locator("[data-audience-status-dot]"),
      ).toHaveClass(/bg-muted-foreground\/40/);

      const reviewContainer = page.locator("[data-partner-review-container]");
      await expect(reviewContainer).toBeVisible();
      await expect(
        reviewContainer.locator("[data-partner-review-summary]"),
      ).toBeVisible();
      await expect(
        reviewContainer.locator("[data-partner-review-filters]"),
      ).toBeVisible();
      await expect(
        reviewContainer.locator("[data-partner-review-list]"),
      ).toBeVisible();
      await expect(
        reviewContainer.locator("[data-partner-review-divider]"),
      ).toHaveCount(2);
      const renderedReviewItems = reviewContainer.locator(
        "article[data-partner-review-item]",
      );
      const renderedReviewItemCount = await renderedReviewItems.count();
      expect(renderedReviewItemCount).toBeGreaterThan(0);
      await expect(
        reviewContainer.locator("[data-partner-review-item-divider]"),
      ).toHaveCount(Math.max(0, renderedReviewItemCount - 1));
      await expect(reviewContainer.getByText("목록", { exact: true })).toHaveCount(0);
      await expect(reviewContainer.getByText("8개 표시", { exact: true })).toHaveCount(0);
      await expect(
        reviewContainer.getByText("사진이 있는 리뷰만 보기", { exact: true }),
      ).toBeVisible();
      await expect(
        reviewContainer.getByText("비공개 리뷰 제외", { exact: true }),
      ).toHaveCount(0);
      await expect(
        reviewContainer.locator(
          "[data-partner-review-summary] > [data-partner-review-summary-content]",
        ),
      ).toBeVisible();

      const heroMetaBox = await heroMeta.boundingBox();
      if (titleBox && heroMetaBox) {
        const metaToTitleGap =
          titleBox.y - (heroMetaBox.y + heroMetaBox.height);
        expect(metaToTitleGap).toBeGreaterThanOrEqual(0);
        expect(metaToTitleGap).toBeLessThanOrEqual(16);
      }

      const documentWidth = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(documentWidth.scrollWidth).toBe(documentWidth.clientWidth);

      if (viewport.width === 360 || viewport.width === 1366) {
        await heroActions
          .getByRole("button", { name: "공유 링크 복사" })
          .click();
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
