import { devices, expect, test } from "@playwright/test";

const iphone = devices["iPhone 13"];
test.use({
  viewport: iphone.viewport,
  userAgent: iphone.userAgent,
  isMobile: true,
  hasTouch: true,
  // 모의 인증 리디렉션과 동일한 호스트를 사용해야 세션 쿠키가 유지됩니다.
  baseURL: process.env.BASE_URL ?? `http://localhost:${process.env.E2E_PORT ?? "3100"}`,
});

test("login tabs expose distinct username and email autofill fields", async ({ page }) => {
  await page.goto("/auth/login");
  const username = page.getByRole("textbox", { name: "Mattermost 아이디" });
  await expect(username).toBeVisible();
  await expect(username).toHaveAttribute("name", "username");
  await expect(username).toHaveAttribute("autocomplete", "username");
  await expect(username).toHaveAttribute("autocapitalize", "none");
  await expect(username).toHaveAttribute("autocorrect", "off");
  await username.fill("mobile.member");
  await page.getByRole("tab", { name: "이메일", exact: true }).click();
  const email = page.getByRole("textbox", { name: "이메일", exact: true });
  await expect(email).toHaveAttribute("name", "email");
  await expect(email).toHaveAttribute("type", "email");
  await expect(email).toHaveAttribute("inputmode", "email");
  await expect(email).toHaveAttribute("autocomplete", "email");
  await expect(page.locator('input[name="username"]')).toHaveCount(0);
  await email.fill("mobile.member@example.com");
  await page.getByRole("tab", { name: "아이디", exact: true }).click();
  await expect(username).toHaveValue("mobile.member");
  await expect(page.locator('input[name="email"]')).toHaveCount(0);
  await expect(page.getByLabel("비밀번호", { exact: true })).toHaveAttribute("autocomplete", "current-password");
  for (const width of [360, 820, 1366]) {
    await page.setViewportSize({ width, height: 900 });
    await page.screenshot({ path: `.tmp/ui-qa/issue-463/login-id-${width}.png`, fullPage: true, animations: "disabled" });
  }
  await page.setViewportSize({ width: 360, height: 844 });
  await page.getByRole("tab", { name: "이메일", exact: true }).click();
  await expect(email).toHaveValue("mobile.member@example.com");
  await page.screenshot({ path: ".tmp/ui-qa/issue-463/login-email-360.png", fullPage: true, animations: "disabled" });
});

test("certification card contains its full footer and QR action at every width", async ({ page }) => {
  // 이 검증은 카드와 QR 표시 UI가 대상이며, 실제 회원 토큰은 발급하지 않습니다.
  await page.route("**/api/mm/certification-token", route => route.fulfill({
    json: {
      verifyUrl: "https://example.com/mobile-qa-certification",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    },
  }));
  await page.goto("/auth/mock?returnTo=%2Fcertification");
  const card = page.getByTestId("certification-card-frame");
  await expect(card).toBeVisible({ timeout: 15_000 });
  await page.evaluate(() => document.fonts.ready);
  for (const width of [320, 360, 390, 820, 1366]) {
    await page.setViewportSize({ width, height: 900 });
    const bounds = await card.evaluate(element => {
      const frame = element.getBoundingClientRect();
      const footer = element.querySelector('[data-certification-card-footer]')!.getBoundingClientRect();
      const button = element.querySelector('[data-certification-qr-touch-target] button')!.getBoundingClientRect();
      return { bottom: frame.bottom, footerBottom: footer.bottom, buttonBottom: button.bottom, ratio: frame.width / frame.height };
    });
    expect(bounds.footerBottom, `${width}px footer`).toBeLessThanOrEqual(bounds.bottom - 1);
    expect(bounds.buttonBottom, `${width}px QR control`).toBeLessThanOrEqual(bounds.bottom - 1);
    expect(bounds.ratio).toBeCloseTo(16 / 9, 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
    await page.screenshot({ path: `.tmp/ui-qa/issue-463/certification-${width}.png`, fullPage: true, animations: "disabled" });
  }
  await page.getByRole("button", { name: "QR 표시", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog").getByRole("img", { name: /검증 QR/ })).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "닫기", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
