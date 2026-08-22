import { expect, test, type Page } from "@playwright/test";

function collectBrowserFailures(page: Page) {
  const failures: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      failures.push(`console: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    failures.push(`page: ${error.message}`);
  });
  page.on("requestfailed", (request) => {
    failures.push(
      `request: ${request.method()} ${request.url()} ${request.failure()?.errorText ?? "failed"}`,
    );
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      failures.push(`response: ${response.status()} ${response.url()}`);
    }
  });
  return failures;
}

const viewports = [
  {
    key: "mobile-360",
    width: 360,
    height: 844,
    storyId: "components-certification-applewalletpasscard--not-issued",
    hasOfficialBadge: true,
  },
  {
    key: "tablet-820",
    width: 820,
    height: 1180,
    storyId: "components-certification-applewalletpasscard--active",
    hasOfficialBadge: false,
  },
  {
    key: "desktop-1366",
    width: 1366,
    height: 900,
    storyId:
      "components-certification-applewalletpasscard--active-issuance-unavailable",
    hasOfficialBadge: false,
  },
] as const;

for (const viewport of viewports) {
  test(`apple wallet pass card ${viewport.key}`, async ({ page }) => {
    const browserFailures = collectBrowserFailures(page);
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(
      `/iframe.html?id=${viewport.storyId}&viewMode=story`,
      { waitUntil: "domcontentloaded" },
    );
    await page.locator("#storybook-root").waitFor({ state: "visible" });
    await page.evaluate(async () => {
      await document.fonts.ready;
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    });
    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation-delay: 0s !important;
          animation-duration: 0s !important;
          caret-color: transparent !important;
          transition-delay: 0s !important;
          transition-duration: 0s !important;
        }
      `,
    });

    const storyRoot = page.locator("#storybook-root");
    const targetCard = storyRoot
      .locator("[aria-labelledby][aria-describedby]")
      .first();
    await expect(targetCard).toBeVisible();

    const metrics = await targetCard.evaluate((section) => {
      const rect = section.getBoundingClientRect();
      const badges = Array.from(
        section.querySelectorAll("img[src='/apple-wallet-add-to-wallet-ko.svg']"),
      );
      return {
        sectionWidth: rect.width,
        badgeCount: badges.length,
        text: section.textContent ?? "",
      };
    });

    expect(metrics.sectionWidth).toBeLessThanOrEqual(viewport.width);
    expect(metrics.badgeCount).toBe(viewport.hasOfficialBadge ? 1 : 0);
    expect(metrics.text).toContain("Apple Wallet");
    expect(metrics.text).toContain("필요한 정보만 담아요");

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(hasHorizontalOverflow).toBe(false);

    await expect(targetCard).toHaveScreenshot(
      `apple-wallet-pass-card-${viewport.key}.png`,
      {
        animations: "disabled",
        caret: "hide",
        maxDiffPixelRatio: 0.005,
        scale: "css",
      },
    );
    expect(browserFailures).toEqual([]);
  });
}

test("apple wallet revoke confirmation mobile-360", async ({ page }) => {
  const browserFailures = collectBrowserFailures(page);
  await page.setViewportSize({ width: 360, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(
    "/iframe.html?id=components-certification-applewalletpasssection--revoke-confirmation&viewMode=story",
    { waitUntil: "domcontentloaded" },
  );

  const dialog = page.getByRole("dialog", {
    name: "Apple Wallet 패스를 폐기할까요?",
  });
  await expect(dialog).toBeVisible();
  await page.evaluate(async () => {
    await document.fonts.ready;
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  });

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);

  await expect(dialog).toHaveScreenshot(
    "apple-wallet-revoke-confirmation-mobile-360.png",
    {
      animations: "disabled",
      caret: "hide",
      maxDiffPixelRatio: 0.005,
      scale: "css",
    },
  );
  expect(browserFailures).toEqual([]);
});
