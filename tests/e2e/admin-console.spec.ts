import { mkdir } from "node:fs/promises";
import { expect, test, type Locator, type Page } from "@playwright/test";

const screenshotDirectory = ".tmp/ui-qa/project-showcase-preview";

async function waitForAdminShellHydration(page: Page) {
  await expect(
    page.locator('[data-admin-hydrated="true"]').first(),
  ).toBeVisible({ timeout: 15_000 });
}

async function openAdminRoute(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await waitForAdminShellHydration(page);
}

async function captureResponsivePage(page: Page, name: string, target?: Locator) {
  await mkdir(screenshotDirectory, { recursive: true });
  await page.evaluate(async () => {
    await document.fonts?.ready;
  });

  for (const width of [360, 820, 1366]) {
    await page.setViewportSize({ width, height: 1000 });
    await target?.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `${screenshotDirectory}/${name}-${width}.png`,
    });
  }
}

test.describe("authenticated administrator console", () => {
  test.beforeEach(async ({ page }) => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await page.goto("/auth/mock?returnTo=%2Fadmin", {
        waitUntil: "domcontentloaded",
      });
      if (/\/admin$/.test(page.url())) {
        break;
      }
      await page.waitForTimeout(250 * (attempt + 1));
    }
    await expect(page).toHaveURL(/\/admin$/, { timeout: 15_000 });
    await waitForAdminShellHydration(page);
  });

  test("@critical renders the admin home and permission-filtered navigation", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "관리 홈", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /회원/ }).first()).toBeVisible();
  });

  test("requires an administrator before revealing the showcase experience preview", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/events/project-showcase?preview=experience", {
      waitUntil: "domcontentloaded",
    });
    await expect(page).toHaveURL(/\/auth\/login\?/);
  });

  test("simulates the showcase experience flow without saving or opening external links", async ({ page }) => {
    await page.goto("/admin/events/project-showcase", { waitUntil: "domcontentloaded" });
    const previewLink = page.getByRole("link", { name: "체험 기간 미리보기" });
    await expect(previewLink).toBeVisible();
    await captureResponsivePage(page, "admin-entry", previewLink);
    await previewLink.click();

    await expect(page).toHaveURL(/\/events\/project-showcase\?preview=experience/);
    await expect(page.getByText("관리자 미리보기 · 체험 기간")).toBeVisible();
    const detailLink = page.getByRole("link", { name: /상세 체험 흐름 미리보기/ }).first();
    await expect(detailLink).toBeVisible();
    await captureResponsivePage(page, "listing", page.locator("#showcase-gallery"));

    await detailLink.click();
    await expect(page).toHaveURL(/\/events\/project-showcase\/projects\/[^?]+\?preview=experience/);
    await expect(page.getByText("관리자 미리보기 · 체험 상세")).toBeVisible();
    await expect(page.getByText("미리보기에서는 실제 서비스 주소를 열지 않아요.")).toBeVisible();
    await expect(page.locator("aside").locator('a[href^="https://"]')).toHaveCount(0);

    let popupCount = 0;
    let postRequestCount = 0;
    page.on("popup", () => { popupCount += 1; });
    page.on("request", (request) => {
      if (request.method() === "POST") postRequestCount += 1;
    });

    await page.getByRole("checkbox", { name: /당첨되면 이름 일부를 가려/ }).check();
    await page.getByRole("button", { name: "참여 등록하고 체험 시작" }).click();
    const fastForward = page.getByRole("button", { name: "1분 경과 상태 미리보기" });
    await expect(fastForward).toBeVisible();
    await fastForward.click();

    const feedback = page.getByRole("textbox", { name: "한 줄 피드백" });
    await expect(feedback).toBeEnabled();
    await feedback.fill("프로젝트 흐름이 명확하고 화면 구성이 좋아요.");
    await page.getByRole("button", { name: "피드백 제출 미리보기" }).click();
    await expect(page.getByText("피드백 제출 완료 상태")).toBeVisible();
    await expect(page.getByText("미리보기 상태이며 실제 추첨권은 발급되지 않았어요.")).toBeVisible();
    expect(popupCount).toBe(0);
    expect(postRequestCount).toBe(0);

    await captureResponsivePage(page, "detail-complete", page.locator("aside"));
  });

  test("keeps the member search context in the rendered route", async ({ page }) => {
    await openAdminRoute(
      page,
      "/admin/members?search=%EC%A0%95%EB%AF%BC%ED%98%B8&page=1",
    );

    await expect(page).toHaveURL(/\/admin\/members\?search=%EC%A0%95%EB%AF%BC%ED%98%B8&page=1$/);
    await expect(
      page.getByRole("heading", { name: "회원 계정 관리", exact: true }),
    ).toBeVisible();
  });

  test("renders registration search controls and preserves the query state", async ({ page }) => {
    await openAdminRoute(page, "/admin/partner-registrations");

    await expect(
      page.getByRole("heading", { name: "제휴 등록 신청 검토", exact: true }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("textbox", { name: "검색어" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("combobox", { name: "공개 상태" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("combobox", { name: "정렬" })).toBeVisible({
      timeout: 15_000,
    });
    const searchInput = page.getByRole("textbox", { name: "검색어" });
    await searchInput.fill("싸피");
    await Promise.all([
      page.waitForURL(/\/admin\/partner-registrations\?.*q=%EC%8B%B8%ED%94%BC/, {
        timeout: 15_000,
      }),
      page.getByRole("button", { name: "검색", exact: true }).click(),
    ]);
    await expect(searchInput).toHaveValue("싸피");
  });

  test("traps mobile drawer focus and restores focus to its opener", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openAdminRoute(page, "/admin/members");

    const opener = page.getByRole("button", { name: "관리 메뉴 열기" });
    await expect(opener).toBeVisible({ timeout: 15_000 });
    await opener.click();

    const closeButton = page.getByRole("button", { name: "관리 메뉴 닫기" });
    await expect(closeButton).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(page.getByRole("button", { name: "로그아웃" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(opener).toBeFocused();
  });
});
