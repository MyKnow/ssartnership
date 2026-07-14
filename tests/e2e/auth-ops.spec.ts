import { expect, test } from "@playwright/test";

test.describe("auth and partner portal operation flows", () => {
  test("manual member setup rejects a missing one-time token without exposing it", async ({ page }) => {
    await page.goto("/auth/member/setup");

    await expect(
      page.getByText("비밀번호 설정 링크가 없거나 이미 사용되었습니다. 관리자에게 새 링크를 요청해 주세요."),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "비밀번호 설정 완료" })).toBeDisabled();
  });

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

    await expect(page.getByText("아이디 또는 이메일을 입력해 주세요.")).toBeVisible();
    await expect(page.getByText("비밀번호를 입력해 주세요.")).toBeVisible();
  });

  test("signup switches its child panel before opening the graduate certificate application", async ({ page }) => {
    await page.goto("/auth/signup");
    await page.waitForLoadState("networkidle");

    const memberTab = page.getByRole("tab", { name: "운영진·재학생", exact: true });
    await expect(memberTab).toHaveAttribute("aria-selected", "true");
    const graduateTab = page.getByRole("tab", { name: "수료생", exact: true });
    await expect(graduateTab).toHaveAttribute("aria-selected", "false");
    await memberTab.focus();
    await page.keyboard.press("ArrowRight");

    await expect(page).toHaveURL(/\/auth\/signup$/);
    await expect(graduateTab).toBeFocused();
    await expect(graduateTab).toHaveAttribute("aria-selected", "true");
    const graduateStart = page.getByRole("link", { name: "수료생 인증으로 시작하기" });
    await expect(graduateStart).toHaveAttribute("href", "/auth/signup/graduate?returnTo=%2F");

    await graduateStart.click();
    await expect(page).toHaveURL(/\/auth\/signup\/graduate/);
    await expect(
      page.getByRole("heading", { name: "수료생 인증" }),
    ).toBeVisible();
    await expect(page.getByRole("textbox", { name: "이메일" })).toBeVisible();
    await expect(page.getByRole("button", { name: "인증 코드 보내기" })).toBeVisible();
  });

  test("SSAFY Verify popup failures show a generic message and report only safe diagnostics", async ({ page }) => {
    await page.addInitScript(() => {
      window.ssafyVerify = {
        verify: async () => {
          throw {
            error_code: "SCOPE_NOT_ALLOWED",
            request_id: "req_5wVyW3iRc7JLFWi8",
            phase: "authorize",
            codeVerifier: "must-not-be-reported",
          };
        },
      };
    });
    await page.route("https://verify.myknow.xyz/sdk/ssafy-verify.js", (route) =>
      route.fulfill({ contentType: "application/javascript", body: "" }),
    );
    await page.route("**/api/ssafy/client-failure", (route) =>
      route.fulfill({
        status: 202,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      }),
    );

    await page.goto("/auth/signup");
    await page.waitForLoadState("networkidle");

    const reportRequest = page.waitForRequest(
      (request) => request.url().includes("/api/ssafy/client-failure"),
    );
    await page.getByRole("button", { name: "SSAFY Verify로 시작하기" }).click();
    const report = await reportRequest;

    expect(JSON.parse(report.postData() ?? "{}")).toEqual({
      purpose: "member-login",
      errorCode: "SCOPE_NOT_ALLOWED",
      requestId: "req_5wVyW3iRc7JLFWi8",
      phase: "authorize",
    });
    await expect(
      page.getByText("SSAFY 인증을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요."),
    ).toBeVisible();
    await expect(page.getByText("임시 진단 정보")).toHaveCount(0);
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

  test("partner setup accepts a valid initial password", async ({ page }) => {
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
  });

  test("partner login and change-request entry stay company scoped", async ({ page, context }) => {
    test.setTimeout(90_000);

    await page.goto("/partner/login");

    await page.getByLabel("담당자 이메일").fill("admin@urbangym.example");
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
    await page.goto("/partner/companies/mock-partner-company-urban-gym");
    await expect(page.getByRole("heading", { name: "운영 홈" })).toBeVisible({
      timeout: 20_000,
    });

    const serviceHref =
      "/partner/companies/mock-partner-company-urban-gym/services/mock-partner-service-urban-gym-pt";
    const serviceLink = page.getByRole("link", {
      name: "어반짐 PT 패키지 상세 보기",
    });
    await expect(serviceLink).toHaveAttribute("href", serviceHref);
    await page.goto(serviceHref);

    const changeRequestHref = `${serviceHref}?mode=edit`;
    const changeRequestLink = page.getByRole("link", { name: "수정 요청" });
    await expect(changeRequestLink).toHaveAttribute(
      "href",
      changeRequestHref,
      { timeout: 45_000 },
    );
    await page.goto(changeRequestHref);
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
