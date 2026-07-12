import { expect, test } from "@playwright/test";

const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
  "base64",
);

test.describe("graduate verification application", () => {
  test("submits the verified email, inferred cohort, certificate, and cropped profile photo", async ({
    page,
  }) => {
    await page.route("**/api/graduate-verification/email/send", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ expiresInSeconds: 300 }),
      }),
    );
    await page.route("**/api/graduate-verification/email/verify", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
    );
    await page.route("**/api/graduate-verification/current", (route) =>
      route.fulfill({ status: 404, contentType: "application/json", body: "{}" }),
    );
    await page.route("**/api/graduate-verification/uploads/sign", async (route) => {
      const payload = route.request().postDataJSON() as { kind: string };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          upload: {
            uploadId: `${payload.kind}-upload`,
            signedUrl: `${new URL(route.request().url()).origin}/__graduate-test-upload/${payload.kind}`,
          },
        }),
      });
    });
    await page.route("**/__graduate-test-upload/**", (route) =>
      route.fulfill({ status: 200, body: "" }),
    );

    const submitRequest = page.waitForRequest(
      (request) =>
        request.url().includes("/api/graduate-verification/submit") &&
        request.method() === "POST",
    );
    await page.route("**/api/graduate-verification/submit", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
    );

    await page.goto("/auth/signup/graduate");
    await page.getByRole("textbox", { name: "이메일" }).fill("graduate@example.com");
    await page.getByRole("button", { name: "인증 코드 보내기" }).click();
    await expect(page.getByText(/인증 코드 만료까지 [45]:[0-5]\d 남음/)).toBeVisible();
    await page.getByRole("textbox", { name: "인증 코드" }).fill("123456");
    await page.getByRole("button", { name: "이메일 인증하기" }).click();

    await expect(page.getByRole("heading", { name: "2. 교육 정보" })).toBeVisible();
    await page.getByRole("textbox", { name: "이름" }).fill("테스트 수료생");
    await page.getByRole("textbox", { name: "교육 시작 연도" }).fill("2026");
    await page.getByRole("combobox", { name: "교육 시작 월" }).selectOption("1");
    await page.getByRole("textbox", { name: "교육 종료 연도" }).fill("2026");
    await page.getByRole("combobox", { name: "교육 종료 월" }).selectOption("6");
    await page.getByRole("combobox", { name: "캠퍼스" }).selectOption("서울");
    await expect(page.getByText("자동 계산된 15기")).toBeVisible();
    await page.getByRole("button", { name: "파일 제출로 계속" }).click();

    await page.getByLabel("교육이수증 PDF 파일 선택").setInputFiles({
      name: "certificate.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\n%%EOF"),
    });
    await page.getByLabel("본인 사진 파일 선택").setInputFiles({
      name: "profile.png",
      mimeType: "image/png",
      buffer: ONE_PIXEL_PNG,
    });
    await expect(page.getByText("본인 사진 자르기")).toBeVisible();
    await page.getByRole("button", { name: "적용" }).click();
    await expect(page.getByText("사진 크롭 완료")).toBeVisible();

    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "수료생 인증 제출" }).click();
    const submitted = await submitRequest;
    expect(submitted.postDataJSON()).toMatchObject({
      email: "graduate@example.com",
      educationStartYear: 2026,
      educationStartMonth: 1,
      claimedCohort: 15,
      certificateUploadId: "certificate-upload",
      profileImageUploadId: "profile_image-upload",
    });
    await expect(page.getByText("수료생 인증 신청을 제출했습니다.")).toBeVisible();
  });
});
