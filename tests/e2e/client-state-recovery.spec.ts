import { expect, test, type Page } from "@playwright/test";

test.use({
  baseURL: process.env.BASE_URL ?? `http://localhost:${process.env.E2E_PORT ?? "3100"}`,
});

async function filterHome(page: Page, query: string) {
  const input = page.getByTestId("partner-search-input");
  await input.fill(query);
  await input.press("Enter");
}

for (const width of [360, 820, 1366]) {
  test.describe(`client state at ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });

    test("home favorite survives filtering, pending remount, server reconciliation and rollback", async ({ page }) => {
      let releaseResponse!: () => void;
      const responseReady = new Promise<void>((resolve) => { releaseResponse = resolve; });
      let fail = false;
      let requests = 0;
      await page.route("**/api/partners/*/favorite", async (route) => {
        requests += 1;
        await responseReady;
        const { favorite } = route.request().postDataJSON() as { favorite: boolean };
        await route.fulfill({
          status: fail ? 503 : 200,
          json: fail ? { message: "잠시 후 다시 시도해 주세요." } : { favorite, count: favorite ? 37 : 36 },
        });
      });
      await page.goto("/auth/mock?returnTo=%2F");
      await expect(page.getByTestId("partner-filter-interaction-root")).toHaveAttribute("data-hydrated", "true", { timeout: 15_000 });
      const dismiss = page.locator("[data-pwa-visit-recommendation]").getByRole("button", { name: "나중에" });
      if (await dismiss.isVisible()) await dismiss.click();
      const firstCard = page.getByTestId("partner-card").first();
      const detailLabel = await firstCard.locator('a[aria-label$=" 상세 보기"]').first().getAttribute("aria-label");
      expect(detailLabel).toBeTruthy();
      const card = page.getByTestId("partner-card").filter({ has: page.getByRole("link", { name: detailLabel!, exact: true }) });
      const favorite = card.getByRole("button", { name: /^즐겨찾기/ });
      const initial = await favorite.getAttribute("aria-pressed") === "true";
      try {
        await favorite.click();
        await expect.poll(() => requests).toBe(1);
        await filterHome(page, "__no_such_partner__");
        await expect(card).toHaveCount(0);
        await filterHome(page, "");
        await expect(favorite).toBeDisabled();
        await expect(favorite).toHaveAttribute("aria-pressed", String(!initial));
        releaseResponse();
        await expect(favorite).toBeEnabled();
        await expect(favorite).toContainText(initial ? "36" : "37");
        await page.screenshot({
          path: `.tmp/ui-qa/regression-20261006/favorite-${width}.png`,
          animations: "disabled",
        });
        for (const next of [initial, !initial]) {
          await favorite.click();
          await expect(favorite).toBeEnabled();
          await filterHome(page, "__no_such_partner__");
          await expect(card).toHaveCount(0);
          await filterHome(page, "");
          await expect(favorite).toHaveAttribute("aria-pressed", String(next));
          await expect(favorite).toContainText(next ? "37" : "36");
        }
        fail = true;
        await favorite.click();
        await expect(page.locator("[data-toast-viewport]").getByRole("alert")).toHaveText("잠시 후 다시 시도해 주세요.");
        await filterHome(page, "__no_such_partner__");
        await expect(card).toHaveCount(0);
        await filterHome(page, "");
        await expect(favorite).toHaveAttribute("aria-pressed", String(!initial));
        await expect(favorite).toContainText(initial ? "36" : "37");
      } finally {
        releaseResponse();
      }
    });

    test("an unhydrated favorite is reread after its optimistic request fails", async ({ page }) => {
      const partnerId = "rf-home-fixture-24"; // Beyond the server's first 24 preloaded IDs.
      let releaseHydration!: () => void;
      const delayedHydration = new Promise<void>((resolve) => { releaseHydration = resolve; });
      let mutationFailed = false;
      let initialReads = 0;
      let recoveryReads = 0;
      await page.route("**/api/partners/home-state?**", async (route) => {
        const ids = new URL(route.request().url()).searchParams.getAll("id");
        if (!ids.includes(partnerId)) return route.continue();
        const response = { loadedFavoritePartnerIds: ids, partnerFavoriteStateById: { [partnerId]: true } };
        if (!mutationFailed) {
          initialReads += 1;
          await delayedHydration;
          // Starting a mutation aborts this older read; it must not become authoritative.
          await route.fulfill({ json: response }).catch(() => undefined);
          return;
        }
        recoveryReads += 1;
        await route.fulfill({ json: response });
      });
      await page.route(`**/api/partners/${partnerId}/favorite`, async (route) => {
        mutationFailed = true;
        await route.fulfill({ status: 503, json: { message: "잠시 후 다시 시도해 주세요." } });
      });
      try {
        await page.goto("/auth/mock?returnTo=%2F");
        await expect(page.getByTestId("partner-filter-interaction-root")).toHaveAttribute("data-hydrated", "true", { timeout: 15_000 });
        const dismiss = page.locator("[data-pwa-visit-recommendation]").getByRole("button", { name: "나중에" });
        if (await dismiss.isVisible()) await dismiss.click();
        await filterHome(page, "목록 복귀 검증 공간 24");
        const favorite = page.getByTestId("partner-card").getByRole("button", { name: /^즐겨찾기/ });
        await expect.poll(() => initialReads).toBeGreaterThan(0);
        await expect(favorite).toHaveAttribute("aria-pressed", "false");
        await favorite.click();
        await expect(page.locator("[data-toast-viewport]").getByRole("alert")).toHaveText("잠시 후 다시 시도해 주세요.");
        await expect.poll(() => recoveryReads).toBeGreaterThan(0);
        await expect(favorite).toHaveAttribute("aria-pressed", "true");
        await expect(favorite).toBeEnabled();
        await filterHome(page, "__no_such_partner__");
        await expect(page.getByTestId("partner-card")).toHaveCount(0);
        await filterHome(page, "목록 복귀 검증 공간 24");
        await expect(favorite).toHaveAttribute("aria-pressed", "true");
      } finally {
        releaseHydration();
      }
    });

    test("email recovery uses safe error alerts and keeps success guidance informational", async ({ page }) => {
      let stage: "network" | "start" | "send" | "verify" = "network";
      await page.route("**/api/member/recovery/**", async (route) => {
        if (stage === "network") return route.abort("failed");
        const path = new URL(route.request().url()).pathname;
        if (path.endsWith("/start")) return route.fulfill({ json: { ok: true } });
        if (path.endsWith("/send") && stage === "send") return route.fulfill({ json: { ok: true } });
        return route.fulfill({ status: 400, json: { message: "인증 정보를 확인해 주세요." } });
      });
      await page.goto("/auth/recover-email");
      const recovery = page.getByRole("main");
      await page.getByLabel("기존 아이디 또는 이메일", { exact: true }).fill("synthetic-member");
      await page.getByLabel("기존 사이트 비밀번호", { exact: true }).fill("Synthetic1!");
      const start = page.getByRole("button", { name: "기존 비밀번호 확인" });
      await expect(start).toBeEnabled();
      await start.click();
      await expect(recovery.getByRole("alert")).toHaveText("복구 세션을 시작하지 못했습니다.");
      await expect(page.getByText("Failed to fetch", { exact: false })).toHaveCount(0);
      await page.screenshot({
        path: `.tmp/ui-qa/regression-20261006/recovery-network-${width}.png`,
        fullPage: true,
        animations: "disabled",
      });
      stage = "start";
      await start.click();
      await expect(page.getByText("15분 안에 이메일을 등록하고 인증해 주세요.")).toBeVisible();
      await expect(recovery.getByRole("alert")).toHaveCount(0);
      await page.getByLabel("로그인에 사용할 이메일", { exact: true }).fill("synthetic@example.test");
      await page.getByRole("button", { name: "인증 코드 보내기", exact: true }).click();
      await expect(recovery.getByRole("alert")).toHaveText("인증 정보를 확인해 주세요.");
      await page.screenshot({
        path: `.tmp/ui-qa/regression-20261006/recovery-http-${width}.png`,
        fullPage: true,
        animations: "disabled",
      });
      stage = "send";
      await page.getByRole("button", { name: "인증 코드 보내기", exact: true }).click();
      await expect(page.getByText("이메일로 보낸 6자리 코드를 입력해 주세요.")).toBeVisible();
      await expect(recovery.getByRole("alert")).toHaveCount(0);
      await page.getByLabel("6자리 인증 코드", { exact: true }).fill("123456");
      stage = "verify";
      await page.getByRole("button", { name: "이메일 인증 및 전환", exact: true }).click();
      await expect(recovery.getByRole("alert")).toHaveText("인증 정보를 확인해 주세요.");
    });
  });
}
