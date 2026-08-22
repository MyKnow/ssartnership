#!/usr/bin/env node

import { appendFileSync } from "node:fs";

import {
  classifyChanges,
  collectGitChanges,
} from "./lib/change-policy.mjs";

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith("--")) {
      throw new Error("지원하지 않는 변경 분류 인자입니다.");
    }
    const separator = argument.indexOf("=");
    if (separator > 2) {
      options[argument.slice(2, separator)] = argument.slice(separator + 1);
      continue;
    }
    const key = argument.slice(2);
    const value = argv[index + 1];
    if (value !== undefined && !value.startsWith("--")) {
      options[key] = value;
      index += 1;
    } else {
      options[key] = true;
    }
  }
  return options;
}

function asBoolean(value) {
  return value === true || value === "true" || value === "1";
}

function writeGitHubOutputs(path, policy, targetSha) {
  if (!path || /[\0\r\n]/u.test(path)) {
    throw new Error("GitHub output 경로가 유효하지 않습니다.");
  }
  const values = {
    level: policy.level,
    change_count: String(policy.changeCount),
    verify_profile: policy.verifyProfile,
    run_verify: String(policy.runVerify),
    run_smoke: String(policy.runSmoke),
    run_release: String(policy.runRelease),
    run_job: String(policy.runJob),
    requires_vercel: String(policy.requiresVercel),
    target_sha: targetSha,
  };
  appendFileSync(
    path,
    `${Object.entries(values)
      .map(([key, value]) => `${key}=${value}`)
      .join("\n")}\n`,
    "utf8",
  );
}

try {
  const options = parseArguments(process.argv.slice(2));
  const base = options.base || (options.head ? "HEAD^" : undefined);
  const hasExplicitRange = Boolean(base && options.head);
  const collected = collectGitChanges({
    base,
    head: options.head || undefined,
    includeWorkingTree: !hasExplicitRange,
  });
  const policy = classifyChanges(collected.changes, {
    eventName: options.event || "local",
    baseRef: options["base-ref"] || "",
    forceFull: asBoolean(options["force-full"]),
  });

  if (options["github-output"]) {
    writeGitHubOutputs(options["github-output"], policy, collected.head);
  }

  process.stdout.write(
    `CI 변경 등급: ${policy.level} (${policy.changeCount} files, profile=${policy.verifyProfile})\n`,
  );
  if (options.json) {
    process.stdout.write(`${JSON.stringify(policy)}\n`);
  }
} catch (error) {
  process.stderr.write(
    `CI 변경 분류 실패: ${error instanceof Error ? error.message : "unknown"}\n`,
  );
  process.exit(1);
}
