import { devices, expect, test, type Page } from "@playwright/test";

const iphone = devices["iPhone 13"];

test.use({
  viewport: iphone.viewport,
  userAgent: iphone.userAgent,
  deviceScaleFactor: iphone.deviceScaleFactor,
  isMobile: iphone.isMobile,
  hasTouch: iphone.hasTouch,
});

async function waitForHomeReady(page: Page) {
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await expect(page.getByTestId("partner-filter-interaction-root")).toHaveAttribute(
    "data-hydrated",
    "true",
  );
}

test.describe("mobile browser and standalone PWA shell", () => {
  test("ordinary browser uses the header menu and recommends installation on each eligible visit", async ({
    page,
  }) => {
    await waitForHomeReady(page);

    const recommendation = page.locator("[data-pwa-visit-recommendation]");
    await expect(recommendation).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "모바일 주요 탐색" }),
    ).toHaveCount(0);
    await expect(page.getByRole("button", { name: "메뉴 열기" })).toBeVisible();
    await expect(
      page
        .locator("[data-site-header-pwa-install]")
        .getByRole("link", { name: "앱 설치" }),
    ).toHaveAttribute("href", "/install?platform=ios");

    await recommendation.getByRole("button", { name: "나중에" }).click();
    await expect(recommendation).toHaveCount(0);

    await page.reload();
    await expect(recommendation).toBeVisible();
    await recommendation.getByRole("button", { name: "나중에" }).click();

    const firstPartnerDetailLink = page
      .getByTestId("partner-card")
      .first()
      .locator('a[aria-label$=" 상세 보기"]')
      .first();
    await firstPartnerDetailLink.click();
    await expect(page).toHaveURL(/\/partners\/[^?#]+$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    await page.getByRole("banner").getByLabel("싸트너십").click();
    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.getByTestId("partner-filter-interaction-root"),
    ).toHaveAttribute("data-hydrated", "true");
    await expect(recommendation).toBeVisible();
    await recommendation.getByRole("button", { name: "나중에" }).click();

    await page.getByRole("button", { name: "메뉴 열기" }).click();
    const menu = page.getByRole("dialog", { name: "메뉴" });
    const returnToLogin = menu.getByRole("link", { name: "내 정보" });
    await expect(returnToLogin).toHaveAttribute(
      "href",
      "/auth/login?returnTo=%2Fcertification",
    );
    await expect(menu).toBeVisible();
    await expect(menu.getByText("브라우저에서도 주요 화면을 바로 열 수 있습니다.")).toHaveCount(0);
    await expect(menu.getByRole("link", { name: "홈", exact: true })).toBeVisible();
    await expect(menu.getByRole("link", { name: "혜택 검색" })).toBeVisible();
    await expect(menu.getByRole("link", { name: "쿠폰함" })).toHaveAttribute(
      "href",
      "/auth/login?returnTo=%2Fcoupons",
    );
    await expect(menu.getByRole("link", { name: "내 정보" })).toHaveAttribute(
      "href",
      "/auth/login?returnTo=%2Fcertification",
    );
    await expect(menu.getByText("앱", { exact: true })).toHaveCount(0);

    const documentWidth = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(documentWidth.scrollWidth).toBe(documentWidth.clientWidth);
  });

  test("standalone PWA keeps the app-like bottom navigation and suppresses browser prompts", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "standalone", {
        configurable: true,
        value: true,
      });
    });

    await waitForHomeReady(page);

    await expect(
      page.getByRole("navigation", { name: "모바일 주요 탐색" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "메뉴 열기" })).toBeHidden();
    await expect(page.locator("[data-pwa-visit-recommendation]")).toHaveCount(0);
  });
});
