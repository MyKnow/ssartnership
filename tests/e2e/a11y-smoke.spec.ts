import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import {
  A11Y_SMOKE_COLOR_SCHEMES,
  A11Y_SMOKE_ROUTES,
  A11Y_SMOKE_TAGS,
  A11Y_SMOKE_VIEWPORT,
  buildA11ySmokeEntryPath,
  findStaleAllowlistEntries,
  selectBlockingViolations,
  summarizeViolations,
} from "./a11y-policy";

test.use({
  viewport: A11Y_SMOKE_VIEWPORT,
  // 모의 인증 리디렉션과 같은 호스트를 써야 세션 쿠키가 유지됩니다.
  baseURL: process.env.BASE_URL ?? `http://localhost:${process.env.E2E_PORT ?? "3100"}`,
});

for (const route of A11Y_SMOKE_ROUTES) {
  for (const colorScheme of A11Y_SMOKE_COLOR_SCHEMES) {
    test(`${route.path} ${colorScheme} 360px has no critical or serious axe violations`, async ({
      page,
    }, testInfo) => {
      // next-themes(attribute="class")의 저장 키로 테마를 고정하고 OS 설정도 맞춥니다.
      await page.addInitScript((theme) => {
        try {
          window.localStorage.setItem("theme", theme);
        } catch {
          // 저장소가 막힌 환경에서는 emulateMedia만 적용됩니다.
        }
      }, colorScheme);
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });

      if (route.requiresMemberSession) {
        // QR 토큰은 실제 회원 토큰을 발급하지 않도록 고정 응답을 씁니다.
        await page.route("**/api/mm/certification-token", (request) =>
          request.fulfill({
            json: {
              verifyUrl: "https://example.com/a11y-smoke-certification",
              expiresAt: new Date(Date.now() + 60_000).toISOString(),
            },
          }),
        );
      }

      await page.goto(buildA11ySmokeEntryPath(route));
      await expect(page.locator(route.readySelector).first()).toBeVisible({ timeout: 15_000 });
      await page.evaluate(() => document.fonts.ready);
      if (colorScheme === "dark") {
        await expect(page.locator("html")).toHaveClass(/\bdark\b/);
      } else {
        await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);
      }

      const results = await new AxeBuilder({ page })
        .withTags([...A11Y_SMOKE_TAGS])
        .analyze();
      await testInfo.attach("axe-violations.json", {
        body: JSON.stringify(results.violations, null, 2),
        contentType: "application/json",
      });

      const stale = findStaleAllowlistEntries(route.path, colorScheme, results.violations);
      if (stale.length > 0) {
        testInfo.annotations.push({
          type: "a11y-allowlist-stale",
          description: stale.map((entry) => entry.ruleId).join(", "),
        });
      }

      const blocking = selectBlockingViolations(route.path, colorScheme, results.violations);
      expect(blocking, summarizeViolations(blocking)).toEqual([]);
    });
  }
}
