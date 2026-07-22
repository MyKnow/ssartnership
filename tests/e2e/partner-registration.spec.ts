import { expect, test } from "@playwright/test";

test("partner registration reaches a review-ready submit through all five steps", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 844 });
  await page.goto("/partner-registration");
  await page.waitForLoadState("networkidle");

  const stepProgress = page.getByRole("navigation", { name: "파트너 등록 단계" });
  const currentStep = stepProgress.locator('button[aria-current="step"]:visible');
  await expect(currentStep).toContainText("1");
  await page.getByLabel(/^제휴처명/).fill("E2E 테스트 제휴처");
  await page.getByLabel(/^카테고리/).fill("카페");
  await page.getByLabel(/^위치/).fill("서울 강남구 테헤란로 212");
  await page.getByRole("button", { name: /현장 제시/ }).click();
  await page.getByRole("button", { name: "다음 단계" }).click();

  await expect(currentStep).toContainText("2");
  await page.getByRole("button", { name: "다음 단계" }).click();

  await expect(currentStep).toContainText("3");
  await page.getByRole("button", { name: "+ 혜택 추가" }).click();
  const benefitInput = page.getByPlaceholder("예: 헬스장 1개월 이용권");
  await benefitInput.fill("아메리카노 10% 할인");
  const conditionInput = page.getByPlaceholder("예: 싸트너십 인증");
  await conditionInput.fill("내 인증 화면 제시");
  await conditionInput.press("Enter");
  await page.getByRole("button", { name: "다음 단계" }).click();

  await expect(currentStep).toContainText("4");
  await page.getByRole("button", { name: "다음 단계" }).click();

  await expect(currentStep).toContainText("5");
  await page.getByLabel(/^파트너사명/).fill("E2E 테스트 파트너사");
  await page.getByLabel(/^담당자명/).fill("김테스트");
  await page.getByLabel(/^담당자 이메일/).fill("e2e@example.com");

  await expect(page.getByRole("button", { name: "신청 접수" })).toBeEnabled();
  await expect(page.getByText(/제출 즉시 공개되지 않습니다/)).toBeVisible();
  await page.getByRole("button", { name: "신청 접수" }).click();
  await expect(
    page.getByText("신청이 접수되었습니다. 담당자가 확인 후 안내드리겠습니다."),
  ).toBeVisible();
});
