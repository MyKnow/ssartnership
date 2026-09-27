import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  ALLOWED_DEVELOPMENT_ADVISORIES,
  collectAdvisories,
  evaluateAuditPolicy,
  parseNpmAuditResult,
} from "../scripts/security-audit.mjs";

test("audit transport errors and incomplete reports cannot pass as zero advisories", () => {
  const clean = { auditReportVersion: 2, vulnerabilities: {}, metadata: { vulnerabilities: { total: 0 } } };
  for (const result of [
    { status: 1, stdout: JSON.stringify({ error: { code: "E503", summary: "private provider detail" } }) },
    { status: 0, stdout: "{}" },
    { status: 0, stdout: "null" },
    { status: 0, stdout: "not JSON" },
    { status: 0, stdout: JSON.stringify({ ...clean, vulnerabilities: null }) },
    { status: 0, stdout: JSON.stringify({ ...clean, metadata: {} }) },
    { status: 0, stdout: JSON.stringify({ ...clean, error: {} }) },
    { status: 1, stdout: JSON.stringify({ ...clean, vulnerabilities: { fixture: { via: [{}] } }, metadata: { vulnerabilities: { total: 1 } } }) },
    { status: 1, stdout: JSON.stringify({ ...clean, vulnerabilities: { fixture: { via: ["fixture"] } }, metadata: { vulnerabilities: { total: 1 } } }) },
    { status: 1, stdout: JSON.stringify(clean) },
    { status: null, signal: "SIGTERM", stdout: JSON.stringify(clean) },
    { status: 2, stdout: JSON.stringify(clean) },
    { status: 0, error: new Error("private spawn detail"), stdout: JSON.stringify(clean) },
  ]) {
    assert.throws(() => parseNpmAuditResult(result), { message: "SECURITY_AUDIT_REPORT_UNAVAILABLE" });
  }
});

test("valid clean and advisory exit statuses preserve the report for policy evaluation", () => {
  const clean = { auditReportVersion: 2, vulnerabilities: {}, metadata: { vulnerabilities: { total: 0 } } };
  const vulnerable = { ...createAuditReport([{ packageName: "fixture", fixAvailable: false, url: "https://github.com/advisories/GHSA-fixture" }]), auditReportVersion: 2, metadata: { vulnerabilities: { total: 1 } } };
  for (const [status, report] of [[0, clean], [1, vulnerable]] as const) {
    assert.deepEqual(JSON.parse(parseNpmAuditResult({ status, stdout: JSON.stringify(report) })), report);
  }
});

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

test("only exact development advisories under an active policy are allowed", () => {
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
    now: new Date("2026-09-02T14:00:00.000Z"),
  });
  const expiredPatchable = evaluateAuditPolicy({
    fullReport: patchableReport,
    productionReport: createAuditReport([]),
    now: new Date("2026-09-09T00:00:00.000Z"),
  });

  assert.equal(allowed.allowedDevelopment.length, 1);
  assert.equal(allowed.developmentFailures.length, 0);
  assert.equal(patchable.allowedDevelopment.length, 1);
  assert.equal(patchable.developmentFailures.length, 0);
  assert.equal(expiredPatchable.allowedDevelopment.length, 0);
  assert.equal(expiredPatchable.developmentFailures.length, 1);
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
