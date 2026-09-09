#!/usr/bin/env node

import {
  classifyChanges,
  collectGitChanges,
  lintableChangedPaths,
} from "./lib/change-policy.mjs";
import {
  requireSuccessfulResult,
  runPackageScript,
} from "./lib/package-manager.mjs";

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith("--")) throw new Error("지원하지 않는 검증 인자입니다.");
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

function runRequired(name, forwardedArgs = []) {
  requireSuccessfulResult(
    runPackageScript(name, forwardedArgs),
    `npm run ${name}`,
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
    forceFull: options["force-full"] === "true" || options["force-full"] === true,
  });

  if (options["expected-level"] && options["expected-level"] !== policy.level) {
    throw new Error("분류 단계와 검증 단계의 위험 등급이 일치하지 않습니다.");
  }

  process.stdout.write(
    `변경 검증 실행: level=${policy.level}, profile=${policy.verifyProfile}\n`,
  );

  runRequired("check:docs");

  if (policy.verifyProfile === "none") {
    process.stdout.write("문서 전용 변경: 문서 계약 검증 후 런타임 검증을 생략합니다.\n");
  } else if (policy.verifyProfile === "quick") {
    runRequired("verify:quick");
  } else {
    const lintPaths = lintableChangedPaths(collected.changes);
    if (lintPaths.length > 0) {
      runRequired("lint", lintPaths);
    }
    runRequired("typecheck:ci");
    if (policy.verifyProfile === "ui") {
      runRequired("test");
    }
  }
} catch (error) {
  process.stderr.write(
    `변경 검증 실패: ${error instanceof Error ? error.message : "unknown"}\n`,
  );
  process.exit(1);
}
