import { expect, test } from "@playwright/test";
import config from "../../playwright.config";

// A policy response rewrites the HttpOnly member session. The destination must
// read that new session rather than reuse the consent route's client tree.
test("@critical policy consent opens the photo page once with the updated session", async ({ page, baseURL }) => {
  const server = config.webServer;
  if (!server || Array.isArray(server)) throw new Error("Local fixture server is required.");
  const login = await page.request.post("/api/auth/login", {
    headers: { origin: new URL(baseURL!).origin },
    data: { identifier: server.env?.MOCK_ID, password: server.env?.MOCK_PW, autoLogin: false },
  });
  expect(login.status()).toBe(200);
  expect((await login.json()).requiresConsent).toBe(true);

  const destination = "/certification/photo?returnTo=%2Fsettings%3Ffrom%3Dconsent-regression";
  await page.goto(`/auth/consent?returnTo=${encodeURIComponent(destination)}`);
  await expect(page.getByRole("heading", { name: "약관 동의", exact: true })).toBeVisible();
  const required = page.getByRole("checkbox", { name: /^\[필수\]/ });
  expect(await required.count()).toBe(2);
  for (const checkbox of await required.all()) {
    await checkbox.focus();
    await page.keyboard.press("Space");
  }
  const next = page.getByRole("button", { name: "계속하기", exact: true });
  await expect(next).toBeEnabled();

  let photoDocuments = 0;
  page.on("request", (request) => {
    if (request.isNavigationRequest() && new URL(request.url()).pathname === "/certification/photo") {
      photoDocuments++;
    }
  });
  const [consent] = await Promise.all([
    page.waitForResponse((response) => response.url().endsWith("/api/mm/consent")
      && response.request().method() === "POST"),
    next.click(),
  ]);
  expect(consent.status()).toBe(200);
  await expect(page).toHaveURL(new RegExp("/certification/photo\\?returnTo="));
  await expect(page.getByRole("heading", { name: "본인 사진 변경", exact: true })).toBeVisible();
  await page.waitForLoadState("networkidle");
  expect(photoDocuments).toBe(1);
  expect(new URL(page.url()).searchParams.get("returnTo")).toBe("/settings?from=consent-regression");
});
