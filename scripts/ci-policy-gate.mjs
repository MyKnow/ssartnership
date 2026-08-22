#!/usr/bin/env node

import { pathToFileURL } from "node:url";

import { deriveExecutionPolicy } from "./lib/change-policy.mjs";

function matchesExpectedStepResult(actual, shouldRun) {
  return actual === (shouldRun ? "success" : "skipped");
}

export function evaluatePolicyGate({
  classifyResult,
  verificationResult,
  level,
  eventName,
  baseRef,
  runJob,
  runVerify,
  runSmoke,
  runRelease,
  verifyStepResult,
  smokeStepResult,
  releaseStepResult,
}) {
  if (classifyResult !== "success") {
    return { ok: false, reason: "classification_failed" };
  }
  let expected;
  try {
    expected = deriveExecutionPolicy({ level, eventName, baseRef });
  } catch {
    return { ok: false, reason: "classification_missing" };
  }

  if (
    runJob !== expected.runJob ||
    runVerify !== expected.runVerify ||
    runSmoke !== expected.runSmoke ||
    runRelease !== expected.runRelease
  ) {
    return { ok: false, reason: "classification_plan_mismatch" };
  }

  const expectedVerificationResult = expected.runJob ? "success" : "skipped";
  if (verificationResult !== expectedVerificationResult) {
    return { ok: false, reason: "verification_result_mismatch" };
  }

  if (
    expected.runJob &&
    (!matchesExpectedStepResult(verifyStepResult, expected.runVerify) ||
      !matchesExpectedStepResult(smokeStepResult, expected.runSmoke) ||
      !matchesExpectedStepResult(releaseStepResult, expected.runRelease))
  ) {
    return { ok: false, reason: "verification_step_mismatch" };
  }
  return { ok: true, reason: "policy_satisfied" };
}

function parseBoolean(value) {
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = evaluatePolicyGate({
    classifyResult: process.env.CLASSIFY_RESULT || "",
    verificationResult: process.env.VERIFICATION_RESULT || "",
    level: process.env.CHANGE_LEVEL || "",
    eventName: process.env.EVENT_NAME || "",
    baseRef: process.env.BASE_REF || "",
    runJob: parseBoolean(process.env.RUN_JOB),
    runVerify: parseBoolean(process.env.RUN_VERIFY),
    runSmoke: parseBoolean(process.env.RUN_SMOKE),
    runRelease: parseBoolean(process.env.RUN_RELEASE),
    verifyStepResult: process.env.VERIFY_STEP_RESULT || "",
    smokeStepResult: process.env.SMOKE_STEP_RESULT || "",
    releaseStepResult: process.env.RELEASE_STEP_RESULT || "",
  });
  process.stdout.write(`CI 정책 게이트: ${result.reason}\n`);
  if (!result.ok) process.exit(1);
}
