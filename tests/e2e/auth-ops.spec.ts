import { expect, test } from "@playwright/test";
import { MEMBER_LOGIN_METHOD_STORAGE_KEY } from "../../src/lib/member-login-method-preference.client";
import { waitForPageReady } from "./page-ready";

let hasWarmedAuthRoute = false;

test.describe("auth and partner portal operation flows", () => {
  test.beforeEach(async ({ page }) => {
    if (!hasWarmedAuthRoute) {
      await page.goto("/auth/login");
      await expect(
        page.getByRole("textbox", { name: "Mattermost 아이디" }),
      ).toBeVisible();
      hasWarmedAuthRoute = true;
    }

    const resetResponse = await page.request.post("/api/e2e/mock/reset");
    expect(resetResponse.ok()).toBe(true);
  });

  test("manual member setup rejects a missing one-time token without exposing it", async ({ page }) => {
    await page.goto("/auth/member/setup");

    await expect(
      page.getByText("비밀번호 설정 링크가 없거나 이미 사용되었습니다. 관리자에게 새 링크를 요청해 주세요."),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "비밀번호 설정 완료" })).toBeDisabled();
  });

  test("uses the canonical partner detail path through member certification login", async ({ page }) => {
    const loginWarmup = await page.request.get("/auth/login");
    expect(loginWarmup.ok()).toBe(true);

    await page.goto("/partners/health-001?returnTo=%2F%3Fcategory%3Dhealth%23benefits");
    await waitForPageReady(
      page,
      page.getByRole("banner").getByRole("link", { name: "로그인", exact: true }),
    );

    await expect(
      page.getByRole("banner").getByRole("link", { name: "로그인", exact: true }),
    ).toHaveAttribute("href", "/auth/login?returnTo=%2Fpartners%2Fhealth-001");
    await expect(
      page.getByRole("banner").getByRole("link", {
        name: "회원가입",
        exact: true,
      }),
    ).toHaveAttribute("href", "/auth/signup?returnTo=%2Fpartners%2Fhealth-001");

    const benefitAction = page.getByRole("link", {
      name: "로그인 후 혜택 이용하기",
    }).first();
    const reviewWriteAction = page.getByRole("link", {
      name: "로그인 후 리뷰 작성",
    });
    await expect(benefitAction).toHaveAttribute(
      "href",
      "/auth/login?returnTo=%2Fpartners%2Fhealth-001",
    );
    await expect(reviewWriteAction).toHaveAttribute(
      "href",
      "/auth/login?returnTo=%2Fpartners%2Fhealth-001",
    );

    await Promise.all([
      page.waitForURL(/\/auth\/login\?returnTo=/, { timeout: 15_000 }),
      benefitAction.click(),
    ]);
    const loginUrl = new URL(page.url());
    const benefitUseReturnTo = loginUrl.searchParams.get("returnTo") ?? "";
    const decodedReturnTo = decodeURIComponent(benefitUseReturnTo);
    expect(decodedReturnTo).toBe("/partners/health-001");

    const signupAction = page.getByRole("main").getByRole("link", {
      name: "회원가입",
      exact: true,
    });
    const headerSignupAction = page.getByRole("banner").getByRole("link", {
      name: "회원가입",
      exact: true,
    });
    await expect(headerSignupAction).toHaveAttribute(
      "href",
      "/auth/signup?returnTo=%2Fpartners%2Fhealth-001",
    );
    await expect(signupAction).toHaveAttribute(
      "href",
      "/auth/signup?returnTo=%2Fpartners%2Fhealth-001",
    );
    await signupAction.click();
    await expect(page).toHaveURL(
      /\/auth\/signup\?returnTo=%2Fpartners%2Fhealth-001$/,
    );

    await page.goBack();
    await expect(page).toHaveURL(
      /\/auth\/login\?returnTo=%2Fpartners%2Fhealth-001$/,
    );
    const demoLoginAction = page.getByRole("main").getByRole("link", {
      name: "촬영용 데모 시작",
    });
    await expect(demoLoginAction).toHaveAttribute(
      "href",
      "/auth/mock?returnTo=%2Fpartners%2Fhealth-001",
    );
    await demoLoginAction.click();
    await expect(page).toHaveURL(/\/partners\/health-001$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "바디라인 피트니스" }),
    ).toBeVisible();
  });

  test("@critical member login shows field-level validation before submitting", async ({ page }) => {
    await page.goto("/auth/login");
    await waitForPageReady(
      page,
      page.getByRole("textbox", { name: "Mattermost 아이디" }),
    );

    const usernameTab = page.getByRole("tab", { name: "아이디" });
    const emailTab = page.getByRole("tab", { name: "이메일" });

    await expect(usernameTab).toHaveAttribute("aria-selected", "true");
    await expect(emailTab).toHaveAttribute("aria-selected", "false");
    await expect(page.getByRole("textbox", { name: "Mattermost 아이디" })).toHaveAttribute(
      "placeholder",
      "예시: myknow",
    );
    await expect(page.getByRole("checkbox", { name: "자동 로그인" })).toBeChecked();

    await page.getByRole("button", { name: "로그인" }).click();

    await expect(page.getByText("Mattermost 아이디를 입력해 주세요.")).toBeVisible();
    await expect(page.getByText("비밀번호를 입력해 주세요.")).toBeVisible();

    await emailTab.click();
    await expect(emailTab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("textbox", { name: "이메일" })).toHaveAttribute(
      "placeholder",
      "예시: myknow@example.com",
    );

    await page.reload();
    await expect(usernameTab).toHaveAttribute("aria-selected", "true");

    await page.evaluate((storageKey) => {
      window.localStorage.setItem(storageKey, "email");
    }, MEMBER_LOGIN_METHOD_STORAGE_KEY);
    await page.reload();
    await expect(emailTab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("textbox", { name: "이메일" })).toBeVisible();

    await page.evaluate((storageKey) => {
      window.localStorage.removeItem(storageKey);
    }, MEMBER_LOGIN_METHOD_STORAGE_KEY);
  });

  test("@critical password reset exposes only Mattermost ID and email methods", async ({ page }) => {
    await page.goto("/auth/reset");
    const memberTab = page.getByRole("tab", { name: "Mattermost", exact: true });
    const graduateTab = page.getByRole("tab", { name: "이메일", exact: true });
    await waitForPageReady(page, memberTab);

    await expect(page.getByRole("tab")).toHaveCount(2);
    await expect(page.getByRole("tab", { name: "이메일 초대", exact: true })).toHaveCount(0);
    await expect(memberTab).toHaveAttribute("aria-selected", "true");
    await expect(
      page.getByText("가입 때 연결한 Mattermost 계정으로 인증 코드를 받으면 새 비밀번호를 설정할 수 있습니다."),
    ).toHaveCount(0);
    await expect(page.getByRole("combobox", { name: "기수" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Mattermost ID" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Mattermost로 인증 코드 받기" })).toHaveClass(/mt-2/);
    const graduateRecovery = page.getByRole("link", {
      name: "수료해서 MM 로그인이 불가능해요",
    });
    await expect(graduateRecovery).toHaveAttribute(
      "href",
      "/auth/signup/graduate?kind=recovery",
    );

    await memberTab.focus();
    await page.keyboard.press("ArrowRight");

    await expect(graduateTab).toBeFocused();
    await expect(graduateTab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("textbox", { name: "이메일" })).toBeVisible();
    await expect(page.getByRole("button", { name: "이메일로 인증 코드 받기" })).toHaveClass(/w-full/);
    await expect(graduateRecovery).toBeVisible();
  });

  test("signup switches its child panel before opening the graduate certificate application", async ({ page }) => {
    await page.goto("/auth/signup");

    const memberTab = page.getByRole("tab", { name: "운영진·재학생", exact: true });
    await waitForPageReady(page, memberTab);
    await expect(memberTab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("textbox", { name: "Mattermost ID" })).toHaveAttribute(
      "placeholder",
      "예: myknow",
    );
    await expect(
      page.getByText("기수의 Mattermost Sender가 6자리 인증 코드를 DM으로 보냅니다."),
    ).toHaveCount(0);
    const generation = page.getByRole("combobox", { name: "기수" });
    await expect(generation).toHaveValue("");
    const generationOptions = await generation.locator("option").allTextContents();
    expect(generationOptions[0]).toBe("기수를 선택해 주세요");
    expect(generationOptions[1]).toMatch(/^운영진(?:\(예정\))?$/);
    expect(generationOptions.slice(2).length).toBeGreaterThanOrEqual(2);
    for (const option of generationOptions.slice(2)) {
      expect(option).toMatch(/^\d+기(?:\(예정\))?$/);
    }
    const graduateTab = page.getByRole("tab", { name: "수료생", exact: true });
    await expect(graduateTab).toHaveAttribute("aria-selected", "false");
    await memberTab.focus();
    await page.keyboard.press("ArrowRight");

    await expect(page).toHaveURL(/\/auth\/signup$/);
    await expect(graduateTab).toBeFocused();
    await expect(graduateTab).toHaveAttribute("aria-selected", "true");
    const graduateStart = page.getByRole("link", { name: "수료생 신규 인증으로 시작하기" });
    await expect(graduateStart).toHaveAttribute("href", "/auth/signup/graduate?returnTo=%2F");
    await expect(graduateStart).toHaveClass(/w-full/);

    await graduateStart.click();
    await expect(page).toHaveURL(/\/auth\/signup\/graduate/);
    await expect(
      page.getByRole("heading", { name: "수료생 인증" }),
    ).toBeVisible();
    await expect(page.getByRole("textbox", { name: "이메일" })).toBeVisible();
    await expect(page.getByRole("button", { name: "인증 코드 보내기" })).toBeVisible();
  });

  test("Mattermost 가입 인증은 5분 타이머를 표시하고 기존 회원은 로그인으로 안내한다", async ({ page }) => {
    await page.route("**/api/mm/code/issue", (route) =>
      route.fulfill({
        status: 202,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          challenge: "e2e-mattermost-code-challenge",
          expiresInSeconds: 300,
          retryAfterSeconds: 60,
        }),
      }),
    );
    await page.route("**/api/mm/code/verify", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          nextPath: "/auth/login",
          existingMember: true,
        }),
      }),
    );

    await page.goto("/auth/signup");
    const generation = page.getByRole("combobox", { name: "기수" });
    const generationOption = generation.locator('option[value]:not([value=""])').first();
    await expect(generationOption).toBeAttached();
    const generationValue = await generationOption.getAttribute("value");
    expect(generationValue).toBeTruthy();
    // The MM endpoints are stubbed in this test, so keep it independent of the sender registry.
    await generationOption.evaluate((option) => option.removeAttribute("disabled"));
    await page.getByRole("textbox", { name: "Mattermost ID" }).fill("myknow");
    await generation.selectOption(generationValue!);
    await page.getByRole("button", { name: "Mattermost로 인증 코드 받기" }).click();

    await expect(
      page.getByText("입력한 Mattermost 계정으로 인증 코드를 보냈습니다.", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("계정 존재 여부는 보안상 안내하지 않습니다."),
    ).toHaveCount(0);
    await expect(
      page.getByRole("timer", { name: "인증 코드 만료까지 05:00 남음" }),
    ).toBeVisible();

    await page.getByRole("textbox", { name: "6자리 인증 코드" }).fill("123456");
    await page.getByRole("button", { name: "인증 확인" }).click();

    await expect(page).toHaveURL(/\/auth\/login\?returnTo=%2F$/);
    await expect(page.getByText("이미 가입된 회원입니다.")).toBeVisible();
  });

  test("keeps graduated-member recovery available outside both password reset panels", async ({ page }) => {
    await page.goto("/auth/reset");

    const recoveryLink = page.getByRole("link", {
      name: "수료해서 MM 로그인이 불가능해요",
    });
    await expect(recoveryLink).toHaveCount(1);
    await expect(recoveryLink).toHaveAttribute(
      "href",
      "/auth/signup/graduate?kind=recovery",
    );
    await page.getByRole("tab", { name: "이메일", exact: true }).click();
    await expect(recoveryLink).toBeVisible();
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
