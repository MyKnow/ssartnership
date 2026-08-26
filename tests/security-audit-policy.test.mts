import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  ALLOWED_DEVELOPMENT_ADVISORIES,
  collectAdvisories,
  evaluateAuditPolicy,
} from "../scripts/security-audit.mjs";

type AdvisoryFixture = {
  fixAvailable: boolean;
  packageName: string;
  severity?: string;
  title?: string;
  url: string;
};

function createAuditReport(advisories: AdvisoryFixture[]) {
  const vulnerabilities: Record<
    string,
    { fixAvailable: boolean; via: Array<Record<string, string>> }
  > = {};

  for (const advisory of advisories) {
    const vulnerability = (vulnerabilities[advisory.packageName] ??= {
      fixAvailable: advisory.fixAvailable,
      via: [],
    });
    vulnerability.via.push({
      severity: advisory.severity ?? "high",
      title: advisory.title ?? "fixture advisory",
      url: advisory.url,
    });
  }

  return { vulnerabilities };
}

test("security audit uses the repository npm runner on every platform", () => {
  const source = readFileSync(
    new URL("../scripts/security-audit.mjs", import.meta.url),
    "utf8",
  );

  assert.match(source, /import \{ runNpmArguments \} from "\.\/lib\/package-manager\.mjs"/);
  assert.match(source, /runNpmArguments\(args,/);
  assert.doesNotMatch(source, /execFileSync\("npm"/);
});

test("production advisories always fail even when their URL is tracked for development", () => {
  const [tracked] = ALLOWED_DEVELOPMENT_ADVISORIES.values();
  const advisory = {
    fixAvailable: false,
    packageName: tracked.packageName,
    url: tracked.url,
  };
  const report = createAuditReport([advisory]);

  const result = evaluateAuditPolicy({
    fullReport: report,
    productionReport: report,
  });

  assert.equal(result.productionFailures.length, 1);
  assert.equal(result.allowedDevelopment.length, 0);
});

test("only exact unpatchable development advisories are allowed", () => {
  const [tracked] = ALLOWED_DEVELOPMENT_ADVISORIES.values();
  const allowedReport = createAuditReport([
    {
      fixAvailable: false,
      packageName: tracked.packageName,
      url: tracked.url,
    },
  ]);
  const patchableReport = createAuditReport([
    {
      fixAvailable: true,
      packageName: tracked.packageName,
      url: tracked.url,
    },
  ]);

  const allowed = evaluateAuditPolicy({
    fullReport: allowedReport,
    productionReport: createAuditReport([]),
  });
  const patchable = evaluateAuditPolicy({
    fullReport: patchableReport,
    productionReport: createAuditReport([]),
  });

  assert.equal(allowed.allowedDevelopment.length, 1);
  assert.equal(allowed.developmentFailures.length, 0);
  assert.equal(patchable.allowedDevelopment.length, 0);
  assert.equal(patchable.developmentFailures.length, 1);
});

test("unknown development advisories fail and duplicate URLs are reported once", () => {
  const report = createAuditReport([
    {
      fixAvailable: false,
      packageName: "unknown-package",
      url: "https://github.com/advisories/GHSA-unknown",
    },
    {
      fixAvailable: false,
      packageName: "unknown-package",
      url: "https://github.com/advisories/GHSA-unknown",
    },
  ]);

  assert.equal(collectAdvisories(report).length, 1);

  const result = evaluateAuditPolicy({
    fullReport: report,
    productionReport: createAuditReport([]),
  });
  assert.equal(result.developmentFailures.length, 1);
});
