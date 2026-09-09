#!/usr/bin/env node
import { pathToFileURL } from "node:url";

import { runNpmArguments } from "./lib/package-manager.mjs";

export function advisoryKey({ packageName, url }) {
  return `${packageName}:${url}`;
}

export const ALLOWED_DEVELOPMENT_ADVISORIES = new Map(
  [
    {
      packageName: "image-size",
      url: "https://github.com/advisories/GHSA-w3rx-r6r6-pgpr",
      reason:
        "Storybook-only dependency; npm's replacement line requires an unpublished stable Storybook peer. Temporary grace expires 2026-09-09.",
      allowPatchableUntil: "2026-09-09T00:00:00.000Z",
    },
    {
      packageName: "image-size",
      url: "https://github.com/advisories/GHSA-5p2g-fcmc-qvqq",
      reason:
        "Storybook-only dependency; npm's replacement line requires an unpublished stable Storybook peer. Temporary grace expires 2026-09-09.",
      allowPatchableUntil: "2026-09-09T00:00:00.000Z",
    },
  ].map((advisory) => [advisoryKey(advisory), advisory]),
);

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
    const patchableGraceDeadline = policy?.allowPatchableUntil
      ? Date.parse(policy.allowPatchableUntil)
      : Number.NaN;
    const patchableGraceActive =
      advisory.fixAvailable === true &&
      Number.isFinite(patchableGraceDeadline) &&
      now.getTime() < patchableGraceDeadline;

    if (
      policy &&
      (advisory.fixAvailable === false || patchableGraceActive)
    ) {
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
