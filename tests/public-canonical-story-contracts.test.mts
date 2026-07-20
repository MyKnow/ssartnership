import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

type ScenarioModule = typeof import("../src/lib/mock/scenarios");

const scenarioModulePromise = import(
  new URL("../src/lib/mock/scenarios/index.ts", import.meta.url).href
) as Promise<ScenarioModule>;

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const canonicalPublicViewContracts = [
  {
    routePath: "/campuses/[campus]",
    viewComponent: "CampusLandingView",
    pageFile: "src/app/(site)/campuses/[campus]/page.tsx",
  },
  {
    routePath: "/events/[slug]",
    viewComponent: "EventPageView",
    pageFile: "src/app/(site)/events/[slug]/page.tsx",
  },
  {
    routePath: "/legal/[kind]",
    viewComponent: "LegalPolicyView",
    pageFile: "src/app/legal/[kind]/page.tsx",
  },
  {
    routePath: "/notifications",
    viewComponent: "NotificationsView",
    pageFile: "src/app/(site)/notifications/page.tsx",
  },
  {
    routePath: "/suggest",
    viewComponent: "SuggestPageView",
    pageFile: "src/app/(site)/suggest/page.tsx",
  },
  {
    routePath: "/support/bug-report",
    viewComponent: "BugReportView",
    pageFile: "src/app/(site)/support/bug-report/page.tsx",
  },
  {
    routePath: "/partners/[id]/benefit-use",
    viewComponent: "PartnerBenefitVerificationView",
    pageFile: "src/app/(site)/partners/[id]/benefit-use/page.tsx",
  },
  {
    routePath: "/auth/login",
    viewComponent: "LoginPageView",
    pageFile: "src/app/auth/login/page.tsx",
  },
  {
    routePath: "/auth/reset",
    viewComponent: "ResetPasswordPageView",
    pageFile: "src/app/auth/reset/page.tsx",
  },
  {
    routePath: "/auth/signup",
    viewComponent: "SignupPageView",
    pageFile: "src/app/auth/signup/page.tsx",
  },
] as const;

test("public canonical routes render the same actual View used by Storybook", async () => {
  const { buildMockCoverageMatrix } = await scenarioModulePromise;
  const matrix = buildMockCoverageMatrix();

  for (const contract of canonicalPublicViewContracts) {
    const route = matrix.find((row) => row.routePath === contract.routePath);
    assert.ok(route, `${contract.routePath} must exist in the coverage matrix`);

    const defaultActualView = route.storybookStories.find(
      (story) =>
        story.renderKind === "actual-view" &&
        story.actualViewComponent === contract.viewComponent &&
        story.coveredStateKeys.includes("default"),
    );
    assert.ok(
      defaultActualView,
      `${contract.routePath} must expose a default actual-view story for ${contract.viewComponent}`,
    );
    assert.deepStrictEqual(defaultActualView.viewportKeys, [
      "mobile-360",
      "tablet-820",
      "desktop-1366",
    ]);

    const pageSource = readFileSync(path.join(repoRoot, contract.pageFile), "utf8");
    assert.match(
      pageSource,
      new RegExp(`<${contract.viewComponent}\\b`),
      `${contract.pageFile} must render ${contract.viewComponent}`,
    );
  }
});
