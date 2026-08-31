import { expect, type Page } from "@playwright/test";

export async function waitForFonts(page: Page) {
  await page.evaluate(() => document.fonts.ready);
}

export async function gotoAuthLogin(page: Page) {
  await page.goto("/auth/login", { waitUntil: "domcontentloaded" });
  await waitForFonts(page);
  await expect(
    page.getByRole("textbox", { name: "아이디 또는 이메일" }),
  ).toBeVisible({ timeout: 15_000 });
}

export async function gotoAuthSignup(page: Page) {
  await page.goto("/auth/signup", { waitUntil: "domcontentloaded" });
  await waitForFonts(page);
  await expect(
    page.getByRole("tab", { name: "운영진·재학생", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("textbox", { name: "Mattermost ID" })).toBeVisible({
    timeout: 15_000,
  });
}

export async function gotoGraduateSignup(page: Page) {
  await page.goto("/auth/signup/graduate", { waitUntil: "domcontentloaded" });
  await waitForFonts(page);
  await expect(page.getByRole("textbox", { name: "이메일" })).toBeVisible({
    timeout: 15_000,
  });
}

export async function gotoPartnerRegistration(page: Page) {
  await page.goto("/partner-registration", { waitUntil: "domcontentloaded" });
  await waitForFonts(page);
  await expect(
    page.getByRole("navigation", { name: "파트너 등록 단계" }),
  ).toBeVisible({ timeout: 15_000 });
}

export async function gotoPartnerDetail(page: Page, href: string) {
  await page.goto(href, { waitUntil: "domcontentloaded" });
  await waitForFonts(page);
  await expect(page.locator("[data-partner-detail-hero-info]")).toBeVisible({
    timeout: 15_000,
  });
}

export async function waitForPartnerDetailGallery(page: Page) {
  await expect(page.locator("[data-partner-detail-gallery]")).toBeVisible({
    timeout: 15_000,
  });
}

export async function gotoPasswordReset(page: Page) {
  await page.goto("/auth/reset", { waitUntil: "domcontentloaded" });
  await waitForFonts(page);
  await expect(page.getByRole("link", { name: /이메일 로그인 복구/ })).toBeVisible({
    timeout: 15_000,
  });
}
