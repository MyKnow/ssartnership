import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyChanges,
  normalizeRepositoryPath,
  parseNameStatusZ,
} from "../scripts/lib/change-policy.mjs";
import { evaluatePolicyGate } from "../scripts/ci-policy-gate.mjs";

const modified = (...paths: string[]) =>
  paths.map((path) => ({ status: "M", path }));

test("change policy parses NUL-delimited Git status including renames", () => {
  assert.deepEqual(
    parseNameStatusZ("M\0README.md\0R100\0old.ts\0new.ts\0"),
    [
      { status: "M", path: "README.md" },
      { status: "R100", oldPath: "old.ts", path: "new.ts" },
    ],
  );
});

test("change policy normalizes Windows separators and rejects unsafe paths", () => {
  assert.equal(normalizeRepositoryPath("src\\components\\Button.tsx"), "src/components/Button.tsx");
  assert.equal(normalizeRepositoryPath("./docs/README.md"), "docs/README.md");
  assert.equal(normalizeRepositoryPath("../secret.txt"), null);
  assert.equal(normalizeRepositoryPath("C:\\repo\\file.ts"), null);
  assert.equal(normalizeRepositoryPath("docs//guide.md"), null);
});

test("docs and Storybook-only changes select the lightweight runtime profiles", () => {
  const docs = classifyChanges(modified("README.md", "docs/operations/guide.md"));
  assert.deepEqual(
    { level: docs.level, profile: docs.verifyProfile, runJob: docs.runJob },
    { level: "docs", profile: "none", runJob: false },
  );

  const stories = classifyChanges(
    modified(
      "src/components/Button.stories.tsx",
      "tests/visual/__snapshots__/button.png",
    ),
  );
  assert.equal(stories.level, "development");
  assert.equal(stories.verifyProfile, "development");
  assert.equal(stories.runJob, true);
  assert.equal(stories.runRelease, false);
});

test("UI, standard, and high-risk paths select progressively stronger gates", () => {
  const ui = classifyChanges(modified("src/components/ui/Button.tsx"), {
    eventName: "pull_request",
    baseRef: "main",
  });
  assert.equal(ui.level, "ui");
  assert.equal(ui.verifyProfile, "ui");
  assert.equal(ui.runSmoke, true);
  assert.equal(ui.runRelease, false);

  const standard = classifyChanges(modified("src/lib/campuses.ts"), {
    eventName: "pull_request",
    baseRef: "main",
  });
  assert.equal(standard.level, "standard");
  assert.equal(standard.verifyProfile, "quick");
  assert.equal(standard.runSmoke, true);

  for (const path of [
    ".github/workflows/public-readiness.yml",
    "package-lock.json",
    "supabase/migrations/20260822000000_example.sql",
    "src/app/api/auth/login/route.ts",
    "src/lib/member-required-gates.ts",
    "src/lib/repositories/member.ts",
    "tests/e2e/auth-ops.spec.ts",
    "scripts/release.mjs",
  ]) {
    const high = classifyChanges(modified(path), {
      eventName: "pull_request",
      baseRef: "dev",
    });
    assert.equal(high.level, "high", path);
    assert.equal(high.runRelease, true, path);
  }
});

test("mixed changes take the highest required tier", () => {
  const policy = classifyChanges(
    modified("README.md", "src/components/Footer.tsx", "src/lib/campuses.ts"),
  );
  assert.equal(policy.level, "standard");
  assert.equal(policy.verifyProfile, "quick");
});

test("unknown, empty, deleted, renamed, and oversized changes fail closed", () => {
  const scenarios = [
    [],
    [{ status: "M", path: "unclassified.asset" }],
    [{ status: "D", path: "README.md" }],
    [{ status: "R100", oldPath: "README.md", path: "docs/README.md" }],
    Array.from({ length: 81 }, (_, index) => ({
      status: "M",
      path: `docs/${index}.md`,
    })),
  ];

  for (const changes of scenarios) {
    const policy = classifyChanges(changes, { eventName: "pull_request" });
    assert.equal(policy.level, "high");
    assert.equal(policy.structuralEscalation || changes.length === 1, true);
  }
});

test("ci:full-style force can only escalate to the high tier", () => {
  const policy = classifyChanges(modified("README.md"), {
    eventName: "pull_request",
    forceFull: true,
  });
  assert.equal(policy.level, "high");
  assert.equal(policy.runRelease, true);
});

test("pushes do not duplicate a PR release gate", () => {
  const policy = classifyChanges(modified("package.json"), {
    eventName: "push",
    baseRef: "dev",
  });
  assert.equal(policy.level, "high");
  assert.equal(policy.runVerify, true);
  assert.equal(policy.runRelease, false);
});

test("CI Policy Gate accepts only the exact expected conditional result", () => {
  assert.deepEqual(
    evaluatePolicyGate({
      classifyResult: "success",
      verificationResult: "success",
      level: "ui",
      eventName: "pull_request",
      baseRef: "main",
      runJob: true,
      runVerify: true,
      runSmoke: true,
      runRelease: false,
      verifyStepResult: "success",
      smokeStepResult: "success",
      releaseStepResult: "skipped",
    }),
    { ok: true, reason: "policy_satisfied" },
  );
  assert.deepEqual(
    evaluatePolicyGate({
      classifyResult: "success",
      verificationResult: "skipped",
      level: "docs",
      eventName: "pull_request",
      baseRef: "dev",
      runJob: false,
      runVerify: false,
      runSmoke: false,
      runRelease: false,
      verifyStepResult: "",
      smokeStepResult: "",
      releaseStepResult: "",
    }),
    { ok: true, reason: "policy_satisfied" },
  );
  assert.equal(
    evaluatePolicyGate({
      classifyResult: "success",
      verificationResult: "skipped",
      level: "high",
      eventName: "pull_request",
      baseRef: "dev",
      runJob: true,
      runVerify: true,
      runSmoke: false,
      runRelease: true,
      verifyStepResult: "",
      smokeStepResult: "",
      releaseStepResult: "",
    }).ok,
    false,
  );
  assert.equal(
    evaluatePolicyGate({
      classifyResult: "failure",
      verificationResult: "skipped",
      level: "docs",
      eventName: "pull_request",
      baseRef: "dev",
      runJob: false,
      runVerify: false,
      runSmoke: false,
      runRelease: false,
      verifyStepResult: "",
      smokeStepResult: "",
      releaseStepResult: "",
    }).ok,
    false,
  );

  assert.equal(
    evaluatePolicyGate({
      classifyResult: "success",
      verificationResult: "success",
      level: "high",
      eventName: "pull_request",
      baseRef: "dev",
      runJob: true,
      runVerify: true,
      runSmoke: false,
      runRelease: false,
      verifyStepResult: "success",
      smokeStepResult: "skipped",
      releaseStepResult: "skipped",
    }).reason,
    "classification_plan_mismatch",
  );

  assert.equal(
    evaluatePolicyGate({
      classifyResult: "success",
      verificationResult: "success",
      level: "high",
      eventName: "pull_request",
      baseRef: "dev",
      runJob: true,
      runVerify: true,
      runSmoke: false,
      runRelease: true,
      verifyStepResult: "success",
      smokeStepResult: "skipped",
      releaseStepResult: "skipped",
    }).reason,
    "verification_step_mismatch",
  );
});
