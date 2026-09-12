import { expect, test, type Page } from "@playwright/test";

test.use({
  baseURL: process.env.BASE_URL ?? `http://localhost:${process.env.E2E_PORT ?? "3100"}`,
});

async function home(page: Page, signedIn = false) {
  await page.goto(signedIn ? "/auth/mock?returnTo=%2F" : "/");
  await expect(page.getByTestId("partner-filter-interaction-root")).toHaveAttribute("data-hydrated", "true", { timeout: 15_000 });
  await page.evaluate(() => document.fonts.ready);
  const dismiss = page.locator("[data-pwa-visit-recommendation]").getByRole("button", { name: "나중에" });
  if (await dismiss.isVisible()) await dismiss.click();
}

async function assertHeaderFits(page: Page, count: number) {
  const actions = page.locator("[data-site-header-actions]").locator("a:visible, button:visible");
  await expect(actions).toHaveCount(count);
  for (const action of await actions.all()) {
    const bounds = await action.boundingBox();
    expect(bounds!.width).toBeGreaterThanOrEqual(44);
    expect(bounds!.height).toBeGreaterThanOrEqual(44);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  const header = await page.getByRole("banner").boundingBox();
  const spacer = await page.locator(".safe-site-header-spacer").boundingBox();
  expect(header!.height).toBe(spacer!.height);
}

for (const signedIn of [false, true]) {
  test(`${signedIn ? "member" : "guest"} header stays compact across responsive boundaries`, async ({ page }) => {
    await home(page, signedIn);
    for (const width of [320, 360, 390, 767, 768, 804, 820, 1279, 1280, 1366]) {
      await page.setViewportSize({ width, height: width === 804 ? 740 : 900 });
      await assertHeaderFits(page, signedIn ? 3 : 2);
      await expect(page.getByRole("banner").getByRole("link", { name: signedIn ? "내 인증" : "혜택 검색" })).toBeVisible();
      await page.getByRole("banner").screenshot({ path: `.tmp/ui-qa/issue-463-header/${signedIn ? "member" : "guest"}-header-${width}.png`, animations: "disabled" });
      if ([360, 820, 1366].includes(width)) {
        await page.screenshot({ path: `.tmp/ui-qa/issue-463-header/${signedIn ? "member" : "guest"}-page-${width}.png`, animations: "disabled" });
      }
    }
  });
}

test("menu keeps account destinations, keyboard focus and theme controls", async ({ page }) => {
  await home(page, true);
  await page.setViewportSize({ width: 360, height: 740 });
  const trigger = page.getByRole("button", { name: "메뉴 열기" });
  const menu = page.getByRole("dialog", { name: "메뉴" });
  await trigger.click();
  await expect(menu).toBeVisible();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  const explore = menu.getByRole("region", { name: "탐색" });
  const account = menu.getByRole("region", { name: "계정" });
  const appServices = menu.getByRole("region", { name: "앱·서비스" });
  await expect(explore.getByRole("link")).toHaveText(["홈", "혜택 검색"]);
  await expect(explore.getByRole("link", { name: "홈", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(account.getByRole("link", { name: "쿠폰함" })).toHaveAttribute("href", "/coupons");
  await expect(account.getByRole("link", { name: "내 정보" })).toHaveAttribute("href", "/certification");
  await expect(account.getByRole("link", { name: "계정 설정" })).toHaveAttribute("href", "/settings?returnTo=%2F");
  await expect(account.getByRole("button", { name: "로그아웃" })).toBeVisible();
  await expect(appServices.getByRole("link", { name: "제휴 제안하기" })).toHaveAttribute("href", "/suggest");
  await expect(menu.getByRole("button", { name: "메뉴 닫기" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(menu.getByRole("link", { name: "앱 설치" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(menu.getByRole("button", { name: "메뉴 닫기" })).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");
  for (const width of [320, 360, 390, 820, 1366]) {
    await page.setViewportSize({ width, height: 740 });
    for (const action of await menu.locator("a:visible, button:visible").all()) {
      const bounds = (await action.boundingBox())!;
      expect(bounds.height).toBeGreaterThanOrEqual(44);
      expect(bounds.width).toBeGreaterThanOrEqual(44);
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(740);
    }
    for (const label of ["라이트", "다크"]) {
      const text = appServices.getByText(label, { exact: true });
      await expect(text).toBeVisible();
      const textBounds = (await text.boundingBox())!;
      const buttonBounds = (await appServices.getByRole("button", { name: `${label} 모드` }).boundingBox())!;
      expect(textBounds.width).toBeGreaterThan(0);
      expect(textBounds.x).toBeGreaterThanOrEqual(buttonBounds.x);
      expect(textBounds.x + textBounds.width).toBeLessThanOrEqual(buttonBounds.x + buttonBounds.width);
    }
    await page.screenshot({ path: `.tmp/ui-qa/issue-463-header/menu-${width}.png`, animations: "disabled" });
  }
  await menu.getByRole("button", { name: "다크 모드" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(menu.getByRole("button", { name: "다크 모드" })).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({ path: ".tmp/ui-qa/issue-463-header/menu-dark-1366.png", animations: "disabled" });
  await page.setViewportSize({ width: 360, height: 740 });
  await page.screenshot({ path: ".tmp/ui-qa/issue-463-header/menu-dark-360.png", animations: "disabled" });
  // 낮은 화면에서는 본문만 스크롤하며 닫기 버튼은 계속 사용할 수 있어야 합니다.
  await page.setViewportSize({ width: 320, height: 480 });
  await menu.getByRole("link", { name: "앱 설치" }).focus();
  await expect(menu.getByRole("link", { name: "앱 설치" })).toBeInViewport();
  await expect(menu.getByRole("button", { name: "메뉴 닫기" })).toBeInViewport();
  await page.screenshot({ path: ".tmp/ui-qa/issue-463-header/menu-short-320.png", animations: "disabled" });
  await page.setViewportSize({ width: 1366, height: 740 });
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await page.getByRole("banner").screenshot({ path: ".tmp/ui-qa/issue-463-header/member-header-dark-1366.png", animations: "disabled" });
  await expect(trigger).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
  await trigger.click();
  await page.mouse.click(4, 200);
  await expect(menu).toBeHidden();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await menu.getByRole("link", { name: "계정 설정" }).click();
  await expect(page).toHaveURL(/\/settings\?returnTo=%2F$/);
  await expect(menu).toBeHidden();
});

test("guest menu groups preserve protected destinations and login navigation", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await home(page);
  await page.getByRole("button", { name: "메뉴 열기" }).click();
  const menu = page.getByRole("dialog", { name: "메뉴" });
  const account = menu.getByRole("region", { name: "계정" });
  await expect(account.getByRole("link", { name: "쿠폰함" })).toHaveAttribute("href", "/auth/login?returnTo=%2Fcoupons");
  await expect(account.getByRole("link", { name: "내 정보" })).toHaveAttribute("href", "/auth/login?returnTo=%2Fcertification");
  await expect(account.getByRole("link", { name: "로그인", exact: true })).toBeVisible();
  await expect(account.getByRole("link", { name: "회원가입" })).toBeVisible();
  await expect(account.getByRole("button", { name: "로그아웃" })).toHaveCount(0);
  await expect(menu.getByRole("link", { name: "앱 설치" })).toBeInViewport();
  await page.screenshot({ path: ".tmp/ui-qa/issue-463-header/menu-guest-320.png", animations: "disabled" });
  await account.getByRole("link", { name: "쿠폰함" }).click();
  await expect(page).toHaveURL(/\/auth\/login\?returnTo=%2Fcoupons$/);
  await expect(menu).toBeHidden();
});

for (const signedIn of [false, true]) {
  test(`standalone ${signedIn ? "member" : "guest"} uses settings only when bottom navigation is visible`, async ({ page }) => {
    // 첫 컴파일의 Fast Refresh가 진행 중인 문서 이동을 덮어쓰지 않도록 미리 준비합니다.
    const detailWarmup = await page.request.get("/partners/health-001");
    expect(detailWarmup.ok()).toBe(true);
    await page.addInitScript(() => Object.defineProperty(navigator, "standalone", { configurable: true, value: true }));
    await page.setViewportSize({ width: 360, height: 844 });
    await home(page, signedIn);
    await expect(page.getByRole("navigation", { name: "모바일 주요 탐색" })).toBeVisible();
    await assertHeaderFits(page, signedIn ? 2 : 1);
    await expect(page.getByRole("button", { name: "메뉴 열기" })).toBeHidden();
    await page.screenshot({ path: `.tmp/ui-qa/issue-463-header/app-${signedIn ? "member" : "guest"}-360.png`, animations: "disabled" });
    await page.getByRole("button", { name: "설정 열기" }).click();
    const settings = page.getByRole("dialog", { name: "설정" });
    await expect(settings.getByRole("region", { name: "탐색" })).toHaveCount(0);
    await expect(settings.getByRole("region", { name: "계정" })).toBeVisible();
    await expect(settings.getByRole("region", { name: "앱·서비스" })).toBeVisible();
    await expect(settings.getByRole("button", { name: "다크 모드" })).toBeVisible();
    await expect(settings.getByRole("link", { name: "앱 설치" })).toHaveCount(0);
    await expect(settings.getByRole("link", { name: "쿠폰함" })).toHaveCount(0);
    await expect(settings.getByRole("link", { name: signedIn ? "계정 설정" : "로그인", exact: true })).toBeVisible();
    await page.screenshot({ path: `.tmp/ui-qa/issue-463-header/app-settings-${signedIn ? "member" : "guest"}-360.png`, animations: "disabled" });
    await page.setViewportSize({ width: 820, height: 900 });
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "메뉴 열기" })).toBeFocused();
    await assertHeaderFits(page, signedIn ? 3 : 2);
    await expect(page.getByRole("button", { name: "메뉴 열기" })).toBeVisible();
    await page.setViewportSize({ width: 360, height: 844 });
    await page.goto("/partners/health-001");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "모바일 주요 탐색" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "메뉴 열기" })).toBeVisible();
  });
}

test("desktop install event is retained before opening the menu", async ({ page }) => {
  await home(page);
  // 실제 설치 대신 브라우저 이벤트 계약을 주입해 늦게 열린 메뉴의 유실 회귀를 검증합니다.
  await page.evaluate(() => {
    const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
      prompt: async () => { document.documentElement.dataset.installPromptCalls = "1"; },
      userChoice: Promise.resolve({ outcome: "accepted", platform: "web" }),
    });
    window.dispatchEvent(event);
  });
  await page.getByRole("button", { name: "메뉴 열기" }).click();
  const menu = page.getByRole("dialog", { name: "메뉴" });
  await menu.getByRole("button", { name: "앱 설치" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-install-prompt-calls", "1");
  await page.evaluate(() => window.dispatchEvent(new Event("appinstalled")));
  await expect(menu.getByRole("link", { name: "앱 설치" })).toHaveCount(0);
  await expect(menu.getByRole("button", { name: "앱 설치" })).toHaveCount(0);
});
