import { expect, test } from "@playwright/test";

test.describe("auth and partner portal operation flows", () => {
  test("preserves the partner detail return path through member certification login", async ({ page }) => {
    await page.goto("/partners/health-001?returnTo=%2F%3Fcategory%3Dhealth%23benefits");

    await page.getByRole("link", { name: "인증하고 혜택 이용" }).first().click();

    await expect(page).toHaveURL(/\/auth\/login\?returnTo=/, { timeout: 15_000 });
    const loginUrl = new URL(page.url());
    const certificationReturnTo = loginUrl.searchParams.get("returnTo") ?? "";
    expect(certificationReturnTo).toContain("/certification?returnTo=");
    expect(decodeURIComponent(certificationReturnTo)).toContain(
      "/partners/health-001",
    );
  });

  test("member login shows field-level validation before submitting", async ({ page }) => {
    await page.goto("/auth/login");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "로그인" }).click();

    await expect(page.getByText("아이디를 입력해 주세요.")).toBeVisible();
    await expect(page.getByText("비밀번호를 입력해 주세요.")).toBeVisible();
  });

  test("partner login maps safe server validation errors to fields", async ({ page }) => {
    await page.goto("/partner/login?error=invalid_request");

    await expect(page.getByText("담당자 이메일을 입력해 주세요.")).toBeVisible();
    await expect(page.getByText("비밀번호를 입력해 주세요.")).toBeVisible();
  });

  test("partner login maps invalid email errors to the email field only", async ({ page }) => {
    await page.goto("/partner/login?error=invalid_email");

    await expect(page.getByText("이메일 형식이 올바르지 않습니다.")).toBeVisible();
    await expect(page.getByText("비밀번호를 입력해 주세요.")).toHaveCount(0);
  });

  test("partner setup, login, and change-request entry stay company scoped", async ({ page, context }) => {
    test.setTimeout(60_000);
    await page.goto("/partner/setup/mock-partner-setup-cafe-ssafy");

    await page.getByPlaceholder("영문/숫자/특수문자 포함 8자 이상").fill("Partner!123");
    await page.getByPlaceholder("다시 입력해 주세요").fill("Partner!123");
    const setupResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/partner/setup/mock-partner-setup-cafe-ssafy") &&
        response.request().method() === "POST",
    );

    await page.getByRole("button", { name: "초기 설정 완료" }).click();
    const setupResult = await setupResponse;
    expect(setupResult.ok()).toBe(true);

    await expect(page).toHaveURL(/\/partner\/login(?:\?setup=completed)?$/);

    await page.getByLabel("담당자 이메일").fill("partner@cafessafy.example");
    await page.getByPlaceholder("초기 설정 후 받은 비밀번호").fill("Partner!123");
    await page.getByRole("button", { name: "로그인" }).click();

    await expect(page).toHaveURL(/\/partner/, { timeout: 15_000 });
    await expect
      .poll(
        async () =>
          (await context.cookies()).some(
            (cookie) => cookie.name === "partner_session" && cookie.value.length > 0,
          ),
        { timeout: 20_000 },
      )
      .toBe(true);
    await page.goto("/partner/companies/mock-partner-company-cafe-ssafy");
    await expect(page.getByRole("heading", { name: "운영 홈" })).toBeVisible({
      timeout: 20_000,
    });

    await page
      .getByRole("link", { name: "카페 싸피 역삼본점 상세 보기" })
      .click();
    await expect(page).toHaveURL(
      /\/partner\/companies\/mock-partner-company-cafe-ssafy\/services\/mock-partner-service-cafe-ssafy-yeoksam/,
    );
    await page.getByRole("link", { name: "수정 요청" }).click();
    await page.getByRole("button", { name: /승인 요청/ }).click();
    await expect(
      page.getByText("승인 요청 항목", { exact: true }),
    ).toBeVisible();
  });

  test("legacy mm session endpoint is not exposed", async ({ request }) => {
    const response = await request.get("/api/mm/session");
    expect(response.status()).toBe(404);
  });
});
