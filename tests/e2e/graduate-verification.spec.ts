import { expect, test } from "@playwright/test";

const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
  "base64",
);
const PROFILE_IMAGE_UPLOAD_ID = "03f5459b-dfee-4558-907a-509a396312f5";

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
    await page.route("**/api/uploads/images/sign", async (route) => {
      const payload = route.request().postDataJSON() as {
        uploads: Array<{ clientId: string }>;
      };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          uploads: payload.uploads.map((upload) => ({
            id: PROFILE_IMAGE_UPLOAD_ID,
            clientId: upload.clientId,
            signedUrl: `${new URL(route.request().url()).origin}/__image-upload-test/${PROFILE_IMAGE_UPLOAD_ID}`,
          })),
          uploadHeaders: {},
        }),
      });
    });
    await page.route("**/__image-upload-test/**", (route) =>
      route.fulfill({ status: 200, body: "" }),
    );
    await page.route("**/api/uploads/images/complete", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          uploads: [{ id: PROFILE_IMAGE_UPLOAD_ID }],
        }),
      }),
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
    await page.waitForLoadState("networkidle");
    await page.getByRole("textbox", { name: "이메일" }).fill("graduate@example.com");
    await page.getByRole("button", { name: "인증 코드 보내기" }).click();
    await expect(page.getByText(/인증 코드 만료까지 [45]:[0-5]\d 남음/)).toBeVisible();
    await page.getByRole("textbox", { name: "인증 코드" }).fill("123456");
    await page.getByRole("button", { name: "이메일 인증하기" }).click();

    await expect(page.getByRole("heading", { name: "2. 교육 정보" })).toBeVisible();
    await expect(
      page.getByText("이메일 인증이 완료되었습니다. 교육 정보를 입력해 주세요."),
    ).toHaveCount(0);
    await page.getByRole("textbox", { name: "이름" }).fill("테스트 수료생");
    await page.getByRole("textbox", { name: "교육 시작 연도" }).fill("2026");
    await page.getByRole("combobox", { name: "교육 시작 월" }).selectOption("1");
    await page.getByRole("textbox", { name: "교육 종료 연도" }).fill("2026");
    await page.getByRole("combobox", { name: "교육 종료 월" }).selectOption("6");
    await page.getByRole("combobox", { name: "캠퍼스" }).selectOption("서울");
    await expect(page.getByText("자동 계산된 15기")).toHaveCount(0);
    await expect(
      page.getByText("교육 시작 연·월로 계산되며 직접 수정할 수 없습니다."),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "다음" }).click();
    const submitButton = page.getByRole("button", { name: "제출", exact: true });
    await expect(submitButton).toBeDisabled();

    await page.getByLabel("교육이수증 PDF 파일 선택").setInputFiles({
      name: "certificate.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\n%%EOF"),
    });
    await expect(page.getByText("PDF(최대 10MB)")).toBeVisible();
    await expect(page.getByText("PDF, 최대 10MB, 5페이지 이하")).toHaveCount(0);
    await expect(submitButton).toBeDisabled();
    await page.getByLabel("본인 사진 파일 선택").setInputFiles({
      name: "profile.png",
      mimeType: "image/png",
      buffer: ONE_PIXEL_PNG,
    });
    await expect(page.getByText("이미지 편집")).toBeVisible();
    await page.getByRole("button", { name: "적용" }).click();
    await expect(page.getByText("사진 크롭 완료")).toHaveCount(0);
    await expect(
      page.getByText("얼굴이 분명하게 보이는 사진(최대 5MB)"),
    ).toBeVisible();
    await expect(
      page.getByText("JPEG, PNG, WebP, HEIC, HEIF · 최대 5MB · 얼굴이 분명하게 보이는 사진"),
    ).toHaveCount(0);
    await expect(submitButton).toBeDisabled();
    await page.getByRole("button", { name: "선택한 본인 사진 크게 보기" }).click();
    await expect(
      page.getByRole("dialog", { name: "선택한 본인 사진 확대" }),
    ).toBeVisible();
    await expect(page.getByRole("img", { name: "선택한 본인 사진 확대" })).toBeVisible();
    await page.getByRole("button", { name: "닫기", exact: true }).click();

    await page
      .getByText(
        "교육이수증과 본인 사진을 수료생 인증 검토 및 인증 카드·유효 QR 검증 화면 표시 목적으로 처리하는 데 동의합니다.",
        { exact: true },
      )
      .click();
    await expect(
      page.getByText("사진은 공개 URL로 제공하지 않습니다."),
    ).toHaveCount(0);
    await expect(submitButton).toBeEnabled();
    await submitButton.click();
    const submitted = await submitRequest;
    expect(submitted.postDataJSON()).toMatchObject({
      email: "graduate@example.com",
      educationStartYear: 2026,
      educationStartMonth: 1,
      certificateUploadId: "certificate-upload",
      profileImageUploadId: PROFILE_IMAGE_UPLOAD_ID,
      profileImageUploadSource: "common",
    });
    await expect(page.getByText("수료생 인증 신청을 제출했습니다.")).toBeVisible();
    await expect(
      page.getByText("수료증과 본인 사진을 검토합니다. 보완이 필요하면 같은 이메일로 다시 안내합니다."),
    ).toHaveCount(0);
    const withdrawButton = page.getByRole("button", { name: "신청 철회" });
    await expect(withdrawButton).toBeVisible();
    await expect(withdrawButton).toHaveClass(/text-danger/);
  });
});
