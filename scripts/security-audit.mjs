#!/usr/bin/env node
import { execFileSync } from "node:child_process";

const ALLOWED_ADVISORY_URLS = new Set([
  "https://github.com/advisories/GHSA-qx2v-qp2m-jg93",
]);

function runNpmAuditJson() {
  try {
    const stdout = execFileSync(
      "npm",
      ["audit", "--json", "--audit-level=moderate"],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    return stdout;
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "stdout" in error &&
      typeof error.stdout === "string"
    ) {
      return error.stdout;
    }
    throw error;
  }
}

function collectAdvisories(report) {
  const vulnerabilities =
    report && typeof report === "object" && "vulnerabilities" in report
      ? report.vulnerabilities
      : {};

  return Object.entries(vulnerabilities ?? {}).flatMap(([name, vulnerability]) => {
    if (!vulnerability || typeof vulnerability !== "object") {
      return [];
    }

    const via = Array.isArray(vulnerability.via) ? vulnerability.via : [];
    return via
      .filter((item) => item && typeof item === "object")
      .map((item) => ({
        packageName: name,
        severity:
          "severity" in item && typeof item.severity === "string"
            ? item.severity
            : "unknown",
        title:
          "title" in item && typeof item.title === "string"
            ? item.title
            : "unknown advisory",
        url: "url" in item && typeof item.url === "string" ? item.url : "",
      }));
  });
}

const report = JSON.parse(runNpmAuditJson());
const advisories = collectAdvisories(report);
const unknownAdvisories = advisories.filter(
  (advisory) => !ALLOWED_ADVISORY_URLS.has(advisory.url),
);

if (unknownAdvisories.length > 0) {
  console.error("Unexpected npm audit advisories found:");
  for (const advisory of unknownAdvisories) {
    console.error(
      `- [${advisory.severity}] ${advisory.packageName}: ${advisory.title} ${advisory.url}`,
    );
  }
  process.exit(1);
}

if (advisories.length > 0) {
  console.warn("Only tracked npm audit advisories remain:");
  for (const advisory of advisories) {
    console.warn(
      `- [${advisory.severity}] ${advisory.packageName}: ${advisory.title} ${advisory.url}`,
    );
  }
}

console.log("npm audit check passed with tracked advisories only.");
