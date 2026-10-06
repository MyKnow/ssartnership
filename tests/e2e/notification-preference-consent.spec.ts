import { expect, test, type Page } from "@playwright/test";
import { waitForPageReady, waitForScrollStability } from "./page-ready";

// Match the mock-auth redirect host so Production's Secure, host-only session
// stays in the same browser origin (also used by mobile-account-ui.spec.ts).
test.use({ baseURL: process.env.BASE_URL ?? `http://localhost:${process.env.E2E_PORT ?? "3100"}` });

// Real member page and controller, with local mock authentication and synthetic
// PATCH responses. These checks do not establish database consent persistence.
const initialPreferences = {
  enabled: false,
  announcementEnabled: true,
  newPartnerEnabled: true,
  expiringPartnerEnabled: true,
  reviewEnabled: true,
  mmEnabled: true,
  marketingEnabled: false,
};
const reviewedMarketingPolicy = {
  marketingPolicyId: "70000000-0000-4000-8000-000000000001",
  marketingPolicyVersion: 1,
};
const preferenceUrl = "**/api/notifications/preferences";

async function openPreferences(page: Page, baseURL: string) {
  expect(["127.0.0.1", "localhost"]).toContain(new URL(baseURL).hostname);
  await page.goto("/auth/mock?returnTo=%2Fnotifications");
  await expect(page).toHaveURL(new URL("/notifications", baseURL).href);
  const ready = page.getByRole("heading", { name: "알림 설정", exact: true });
  await waitForPageReady(page, ready);
  // Reset only the local mock member through its authenticated browser session.
  // Reload server initial props so test order cannot imply prior consent.
  const resetStatus = await page.evaluate(async (preferences) => {
    const response = await fetch("/api/notifications/preferences", {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(preferences),
    });
    return response.status;
  }, initialPreferences);
  expect(resetStatus).toBe(200);
  await page.reload();
  await waitForPageReady(page, ready);
}

function preferenceControls(page: Page) {
  return page.getByRole("region", { name: "알림 수신 설정" });
}

async function toggleWithKeyboard(page: Page, label: string) {
  const checkbox = preferenceControls(page).getByRole("checkbox", { name: label, exact: true });
  await expect(checkbox).toBeEnabled();
  await checkbox.focus();
  await expect(checkbox).toBeFocused();
  await page.keyboard.press("Space");
  return checkbox;
}

async function dismissToasts(page: Page) {
  for (const close of await page.locator("[data-toast-viewport]").getByRole("button", { name: "알림 닫기" }).all()) {
    await close.click();
  }
}

for (const width of [360, 820, 1366]) {
  test.describe(`notification preference consent at ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });
    test.setTimeout(60_000);

    test("ordinary keyboard toggles send only the changed key and required enabled coupling", async ({ page, baseURL }) => {
      await openPreferences(page, baseURL!);
      const requests: Record<string, unknown>[] = [];
      let preferences = { ...initialPreferences };
      await page.route(preferenceUrl, async (route) => {
        expect(route.request().method()).toBe("PATCH");
        const patch = route.request().postDataJSON();
        requests.push(patch);
        preferences = { ...preferences, ...patch };
        await route.fulfill({ json: { ok: true, preferences } });
      });

      const ordinaryItems = [
        ["운영 공지", "announcementEnabled"],
        ["새 제휴", "newPartnerEnabled"],
        ["종료 임박", "expiringPartnerEnabled"],
        ["리뷰", "reviewEnabled"],
        ["Mattermost", "mmEnabled"],
      ] as const;
      for (const [label, key] of ordinaryItems) {
        for (const enabled of [false, true]) {
          const count = requests.length;
          const checkbox = await toggleWithKeyboard(page, label);
          await expect.poll(() => requests.length).toBe(count + 1);
          expect(requests[count]).toEqual({
            [key]: enabled,
            ...(enabled && key !== "mmEnabled" ? { enabled: true } : {}),
          });
          await expect(checkbox).toBeChecked({ checked: enabled });
          await expect(checkbox).toBeEnabled();
          await expect(preferenceControls(page).getByRole("checkbox", { name: "마케팅/이벤트", exact: true })).not.toBeChecked();
          await dismissToasts(page);
        }
      }
    });

    test("opening the policy does not grant consent and explicit consent sends the reviewed policy only", async ({ page, baseURL }) => {
      await openPreferences(page, baseURL!);
      const requests: Record<string, unknown>[] = [];
      const preferences = { ...initialPreferences };
      await page.route(preferenceUrl, async (route) => {
        expect(route.request().method()).toBe("PATCH");
        const patch = route.request().postDataJSON();
        requests.push(patch);
        for (const key of Object.keys(initialPreferences) as (keyof typeof preferences)[]) {
          if (typeof patch[key] === "boolean") preferences[key] = patch[key];
        }
        await route.fulfill({ json: { ok: true, preferences, appliedAt: "2026-10-06T00:00:00.000Z" } });
      });

      const policyLink = preferenceControls(page).getByRole("link", { name: "마케팅/이벤트 약관 보기" });
      await expect(policyLink).toHaveAttribute("href", "/legal/marketing?version=1&returnTo=%2Fnotifications");
      await policyLink.focus();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("heading", { name: "마케팅 정보 수신 동의", exact: true })).toBeVisible();
      await expect(page.getByRole("combobox", { name: "약관 버전 선택" })).toHaveValue("1");
      await expect(page.getByText("신규 제휴, 혜택 변경, 이벤트 소식을 선택적으로 안내받을 수 있습니다.", { exact: true })).toBeVisible();
      expect(requests).toEqual([]);
      await page.getByRole("button", { name: "뒤로 가기", exact: true }).click();
      await expect(page).toHaveURL(/\/notifications$/);

      const marketing = preferenceControls(page).getByRole("checkbox", { name: "마케팅/이벤트", exact: true });
      await expect(marketing).not.toBeChecked();
      await toggleWithKeyboard(page, "마케팅/이벤트");
      await expect(marketing).toBeChecked();
      expect(requests).toEqual([{ marketingEnabled: true, ...reviewedMarketingPolicy }]);
      await dismissToasts(page);

      // Existing consent must not be resubmitted by an unrelated ordinary edit.
      const review = await toggleWithKeyboard(page, "리뷰");
      await expect(review).not.toBeChecked();
      expect(requests[1]).toEqual({ reviewEnabled: false });
      await expect(marketing).toBeChecked();
      await dismissToasts(page);
      await toggleWithKeyboard(page, "마케팅/이벤트");
      await expect(marketing).not.toBeChecked();
      expect(requests).toEqual([
        { marketingEnabled: true, ...reviewedMarketingPolicy },
        { reviewEnabled: false },
        { marketingEnabled: false },
      ]);
    });

    test("policy conflict and network failure preserve state and allow a safe retry", async ({ page, baseURL }) => {
      await openPreferences(page, baseURL!);
      let releaseConflict!: () => void;
      const conflictHeld = new Promise<void>((resolve) => { releaseConflict = resolve; });
      const requests: Record<string, unknown>[] = [];
      await page.route(preferenceUrl, async (route) => {
        expect(route.request().method()).toBe("PATCH");
        requests.push(route.request().postDataJSON());
        if (requests.length === 1) {
          await conflictHeld;
          await route.fulfill({ status: 409, json: {
            message: "마케팅 동의 내용을 다시 확인할 수 있도록 새로고침한 뒤 다시 시도해 주세요.",
            detail: "synthetic-private-policy-detail",
          } });
        } else if (requests.length === 2) {
          await route.abort("failed");
        } else {
          await route.fulfill({ json: { ok: true, preferences: { ...initialPreferences, marketingEnabled: true } } });
        }
      });

      const controls = preferenceControls(page);
      const marketing = await toggleWithKeyboard(page, "마케팅/이벤트");
      await expect.poll(() => requests.length).toBe(1);
      for (const checkbox of await controls.getByRole("checkbox").all()) await expect(checkbox).toBeDisabled();
      releaseConflict();
      const toast = page.locator("[data-toast-viewport]").getByRole("alert");
      await expect(toast).toHaveText("알림 설정 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.");
      await expect(marketing).not.toBeChecked();
      await expect(marketing).toBeEnabled();
      await expect(page.getByText("synthetic-private-policy-detail")).toHaveCount(0);
      expect(requests[0]).toEqual({ marketingEnabled: true, ...reviewedMarketingPolicy });
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      await waitForScrollStability(page);
      await page.screenshot({ path: `.tmp/ui-qa/regression-20261006/notifications-${width}.png`, fullPage: true, animations: "disabled" });
      await dismissToasts(page);

      const mm = await toggleWithKeyboard(page, "Mattermost");
      await expect(toast).toHaveText("알림 설정 저장 중 네트워크 오류가 발생했습니다. 연결 상태를 확인한 뒤 다시 시도해 주세요.");
      await expect(mm).toBeChecked();
      await expect(mm).toBeEnabled();
      await expect(marketing).not.toBeChecked();
      expect(requests[1]).toEqual({ mmEnabled: false });
      await dismissToasts(page);

      await toggleWithKeyboard(page, "마케팅/이벤트");
      await expect(marketing).toBeChecked();
      await expect(marketing).toBeEnabled();
      expect(requests).toEqual([
        { marketingEnabled: true, ...reviewedMarketingPolicy },
        { mmEnabled: false },
        { marketingEnabled: true, ...reviewedMarketingPolicy },
      ]);
      await expect(page.locator("[data-toast-viewport]").getByRole("alert")).toHaveCount(0);
    });
  });
}
