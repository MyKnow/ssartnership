#!/usr/bin/env node
import { pathToFileURL } from "node:url";

import { runNpmArguments } from "./lib/package-manager.mjs";

export function advisoryKey({ packageName, url }) {
  return `${packageName}:${url}`;
}

// Development-only exceptions must name one exact advisory and expire.
// `allowWithdrawnUntil` covers an advisory GitHub has already withdrawn while
// the npm audit feed still reports it; it never applies to Production paths.
/**
 * @typedef {{
 *   packageName: string,
 *   url: string,
 *   reason: string,
 *   allowPatchableUntil?: string,
 *   allowWithdrawnUntil?: string,
 * }} DevelopmentAdvisoryPolicy
 */
/** @type {Map<string, DevelopmentAdvisoryPolicy>} */
export const ALLOWED_DEVELOPMENT_ADVISORIES = new Map(
  [
    {
      packageName: "picomatch",
      url: "https://github.com/advisories/GHSA-fc5q-39xc-vjpf",
      reason:
        "Withdrawn by GitHub on 2026-11-18 with no patched picomatch release; reached only through development tooling (eslint, vite, vitest, storybook). Grace expires 2026-12-03.",
      allowWithdrawnUntil: "2026-12-03T00:00:00.000Z",
    },
  ].map((advisory) => [advisoryKey(advisory), advisory]),
);

function graceActive(deadline, now) {
  const parsed = deadline ? Date.parse(deadline) : Number.NaN;
  return Number.isFinite(parsed) && now.getTime() < parsed;
}

export function runNpmAuditJson({ omitDev = false } = {}) {
  const args = ["audit", "--json", "--audit-level=moderate"];
  if (omitDev) {
    args.push("--omit=dev");
  }

  const result = runNpmArguments(args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (typeof result.stdout === "string" && result.stdout.trim()) {
    return result.stdout;
  }
  if (result.error) {
    throw result.error;
  }
  throw new Error(
    `npm audit가 JSON 출력 없이 종료 코드 ${result.status ?? 1}로 실패했습니다.`,
  );
}

export function collectAdvisories(report) {
  const vulnerabilities =
    report && typeof report === "object" && "vulnerabilities" in report
      ? report.vulnerabilities
      : {};
  const seen = new Set();
  const advisories = [];

  for (const [packageName, vulnerability] of Object.entries(
    vulnerabilities ?? {},
  )) {
    if (!vulnerability || typeof vulnerability !== "object") {
      continue;
    }

    const via = Array.isArray(vulnerability.via) ? vulnerability.via : [];
    for (const item of via) {
      if (!item || typeof item !== "object") {
        continue;
      }

      const advisory = {
        packageName,
        severity:
          "severity" in item && typeof item.severity === "string"
            ? item.severity
            : "unknown",
        title:
          "title" in item && typeof item.title === "string"
            ? item.title
            : "unknown advisory",
        url: "url" in item && typeof item.url === "string" ? item.url : "",
        fixAvailable:
          "fixAvailable" in vulnerability
            ? vulnerability.fixAvailable
            : null,
      };
      const key = advisoryKey(advisory);
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      advisories.push(advisory);
    }
  }

  return advisories;
}

export function evaluateAuditPolicy({
  fullReport,
  productionReport,
  allowedDevelopmentAdvisories = ALLOWED_DEVELOPMENT_ADVISORIES,
  now = new Date(),
}) {
  const productionFailures = collectAdvisories(productionReport);
  const productionKeys = new Set(productionFailures.map(advisoryKey));
  const developmentAdvisories = collectAdvisories(fullReport).filter(
    (advisory) => !productionKeys.has(advisoryKey(advisory)),
  );
  const allowedDevelopment = [];
  const developmentFailures = [];

  for (const advisory of developmentAdvisories) {
    const policy = allowedDevelopmentAdvisories.get(advisoryKey(advisory));
    const patchableGraceActive =
      advisory.fixAvailable === true &&
      graceActive(policy?.allowPatchableUntil, now);
    // A withdrawn-advisory exception is always time-boxed, even if npm later
    // reports the advisory as unfixable.
    const allowed = policy?.allowWithdrawnUntil
      ? graceActive(policy.allowWithdrawnUntil, now)
      : advisory.fixAvailable === false || patchableGraceActive;

    if (policy && allowed) {
      allowedDevelopment.push({ ...advisory, reason: policy.reason });
      continue;
    }

    developmentFailures.push(advisory);
  }

  return {
    productionFailures,
    developmentFailures,
    allowedDevelopment,
  };
}

function printAdvisories(label, advisories, output = console.error) {
  output(label);
  for (const advisory of advisories) {
    output(
      `- [${advisory.severity}] ${advisory.packageName}: ${advisory.title} ${advisory.url}`,
    );
  }
}

export function main() {
  const productionReport = JSON.parse(runNpmAuditJson({ omitDev: true }));
  const fullReport = JSON.parse(runNpmAuditJson());
  const result = evaluateAuditPolicy({ fullReport, productionReport });

  if (result.productionFailures.length > 0) {
    printAdvisories(
      "Production dependency advisories must be fixed:",
      result.productionFailures,
    );
  }

  if (result.developmentFailures.length > 0) {
    printAdvisories(
      "Unexpected or patchable development dependency advisories found:",
      result.developmentFailures,
    );
  }

  if (result.allowedDevelopment.length > 0) {
    console.warn("Tracked development-only advisories under explicit policy:");
    for (const advisory of result.allowedDevelopment) {
      console.warn(
        `- [${advisory.severity}] ${advisory.packageName}: ${advisory.title} ${advisory.url}`,
      );
      console.warn(`  Reason: ${advisory.reason}`);
    }
  }

  if (
    result.productionFailures.length > 0 ||
    result.developmentFailures.length > 0
  ) {
    process.exitCode = 1;
    return;
  }

  console.log("Production dependency audit passed with no advisories.");
  console.log(
    "Full dependency policy audit passed with explicitly tracked development-only advisories.",
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
