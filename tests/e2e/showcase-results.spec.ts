import { expect, test, type Page } from "@playwright/test";
import { SHOWCASE_CLAIM_DEADLINE_AT } from "../../src/lib/project-showcase/results";

const path = "/events/project-showcase";
// Mock login redirects to localhost, so keep the fixture and destination on that same origin.
test.use({ baseURL: process.env.BASE_URL ?? `http://localhost:${process.env.E2E_PORT ?? "3100"}` });

async function seed(page: Page, winner: "submitter" | "experiencer" | "none") {
  const response = await page.request.post("/api/e2e/mock/showcase-results", { data: { winner } });
  expect(response.status()).toBe(200);
}

test.afterEach(async ({ page }) => {
  const response = await page.request.post("/api/e2e/mock/showcase-results", { data: { winner: "reset" } });
  expect(response.status()).toBe(200);
});

test("anonymous results page never exposes personal reviews or claim forms @critical", async ({ page }) => {
  await seed(page, "submitter");
  await page.goto(path);
  await expect(page.getByRole("heading", { name: "리뷰·당첨 결과 확인", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "로그인 후 결과 확인", exact: true })).toBeVisible();
  await expect(page.locator('a[href*="forms.gle"]')).toHaveCount(0);
  await expect(page.getByText("학습 기록과 일정 관리가 편리했어요. 모바일에서도 잘 보여요.")).toHaveCount(0);
});

for (const winner of ["submitter", "experiencer", "none"] as const) {
  test(`signed member sees only own results and reviews: ${winner} @critical`, async ({ page }) => {
    await page.goto("/auth/mock?returnTo=%2F");
    await expect(page.getByTestId("partner-filter-interaction-root")).toHaveAttribute("data-hydrated", "true", { timeout: 15_000 });
    await seed(page, winner);
    if (winner === "submitter") {
      await page.goto("/");
      await expect(page.getByTestId("partner-filter-interaction-root")).toHaveAttribute("data-hydrated", "true", { timeout: 15_000 });
      const firstBanner = page.locator('[aria-roledescription="carousel"] a').first();
      await expect(firstBanner).toHaveAttribute("href", path);
      await expect(firstBanner).toHaveAttribute("aria-label", "프로젝트 리뷰·당첨 결과 확인");
      await expect(firstBanner.locator("img")).toHaveAttribute("src", /project-showcase-results\.svg/);
      for (const width of [360, 820, 1366]) {
        await page.setViewportSize({ width, height: 900 });
        await page.locator('[data-promotion-carousel-media]').first().screenshot({ path: `.tmp/ui-qa/showcase-results/banner-${width}.png`, animations: "disabled" });
      }
    }
    // A supplied member ID must not replace the signed server identity.
    await page.goto(`${path}?memberId=mock-member-green-route`);
    await expect(page.getByRole("heading", { name: "내 당첨 결과", exact: true })).toBeVisible();
    await expect(page.getByText("학습 기록과 일정 관리가 편리했어요. 모바일에서도 잘 보여요.")).toBeVisible();
    await expect(page.getByText("숨김 리뷰 본문")).toHaveCount(0);
    await expect(page.getByText("다른 출품자의 비공개 리뷰")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Green Route", exact: true })).toHaveCount(0);
    const forms = page.locator('a[href*="forms.gle"]');
    if (winner === "none") {
      await expect(page.getByText("이번에는 당첨되지 않았어요. 함께 참여해 주셔서 감사합니다.")).toBeVisible();
      await expect(forms).toHaveCount(0);
    } else if (Date.now() < Date.parse(SHOWCASE_CLAIM_DEADLINE_AT)) {
      await expect(forms).toHaveCount(1);
      await expect(forms).toHaveAttribute("href", winner === "submitter" ? "https://forms.gle/wx6z6fqeNyQ4B8JWA" : "https://forms.gle/PuhroAvV6Apw51C68");
      await expect(page.getByText(/학번은 15 또는 16으로 시작하는 숫자 7자리/)).toBeVisible();
    } else {
      await expect(forms).toHaveCount(0);
      await expect(page.getByRole("button", { name: "수령 폼 접수 마감" })).toBeDisabled();
    }
    if (winner === "submitter") {
      await page.evaluate(() => document.fonts.ready);
      for (const width of [320, 360, 390, 820, 1366]) {
        await page.setViewportSize({ width, height: 900 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
        await page.screenshot({ path: `.tmp/ui-qa/showcase-results/member-${width}.png`, fullPage: true, animations: "disabled" });
      }
    }
  });
}
