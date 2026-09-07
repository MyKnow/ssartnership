import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { exportContext, validateExportRequest, validatePreviewApi, EXPORT_BRANCH, EXPORT_WORKFLOW } from "../scripts/self-host-migration/github-export.mjs";

const environment = () => ({ GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "push", GITHUB_REPOSITORY: "MyKnow/ssartnership", GITHUB_REF: `refs/heads/${EXPORT_BRANCH}`,
  GITHUB_WORKFLOW_REF: `MyKnow/ssartnership/${EXPORT_WORKFLOW}@refs/heads/${EXPORT_BRANCH}`, GITHUB_SHA: "a".repeat(40), GITHUB_RUN_ID: "123", GITHUB_RUN_ATTEMPT: "1" });
test("one-time export binds repository, task branch, workflow, SHA and first attempt", () => {
  assert.deepEqual(exportContext(environment()), { sourceProject: "uuxzzanpxzvhauzxufuk", sha: "a".repeat(40), runId: 123 });
  for (const patch of [{ GITHUB_REPOSITORY: "someone/ssartnership" }, { GITHUB_REF: "refs/heads/main" }, { GITHUB_REF: "refs/heads/dev" },
    { GITHUB_EVENT_NAME: "pull_request" }, { GITHUB_RUN_ATTEMPT: "2" }, { GITHUB_WORKFLOW_REF: "other" }, { GITHUB_RUN_ID: "0" }, { GITHUB_SHA: "bad" }]) {
    assert.throws(() => exportContext({ ...environment(), ...patch }));
  }
});
test("export requires a short-lived explicit request and pinned Preview API identity", () => {
  const now = Date.parse("2026-09-08T00:00:00Z");
  const value = { version: 1, sourceProject: "uuxzzanpxzvhauzxufuk", expiresAt: "2026-09-08T06:00:00Z" };
  assert.deepEqual(validateExportRequest(value, now), value);
  for (const patch of [{ sourceProject: "jlcrhzmiuygqnkwmzfyr" }, { expiresAt: "2026-09-07T23:00:00Z" }, { expiresAt: "2026-09-10T00:00:00Z" }, { sourceUrl: "https://example.invalid" }]) {
    assert.throws(() => validateExportRequest({ ...value, ...patch }, now));
  }
  const token = (ref: string, role: string) => `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ ref, role })).toString("base64url")}.synthetic-signature`;
  assert.doesNotThrow(() => validatePreviewApi("https://uuxzzanpxzvhauzxufuk.supabase.co", token(value.sourceProject, "service_role")));
  assert.throws(() => validatePreviewApi("https://jlcrhzmiuygqnkwmzfyr.supabase.co", token(value.sourceProject, "service_role")));
  assert.throws(() => validatePreviewApi("https://uuxzzanpxzvhauzxufuk.supabase.co", token("jlcrhzmiuygqnkwmzfyr", "service_role")));
  assert.throws(() => validatePreviewApi("https://uuxzzanpxzvhauzxufuk.supabase.co", token(value.sourceProject, "anon")));
});
test("export workflow scopes cloud secrets to capture and uploads only ciphertext with finite retention", () => {
  const require = createRequire(import.meta.url);
  const workflow = require("js-yaml").load(readFileSync(EXPORT_WORKFLOW, "utf8"));
  assert.deepEqual(workflow.on, { push: { branches: [EXPORT_BRANCH], paths: ["deploy/self-host-migration/export-request.json"] } });
  assert.deepEqual(workflow.permissions, { contents: "read" });
  assert.equal(workflow.concurrency["cancel-in-progress"], false);
  assert.ok(!workflow.env && !workflow.jobs.export.env);
  const steps = workflow.jobs.export.steps;
  const capture = steps.findIndex((step: { id: string }) => step.id === "capture");
  for (const [index, step] of steps.entries()) {
    if (index !== capture) assert.ok(!JSON.stringify(step).includes("secrets.SUPABASE_"));
    if (step.uses?.startsWith("actions/checkout@")) assert.equal(step.with["persist-credentials"], false);
  }
  const upload = steps.find((step: { uses?: string }) => step.uses?.startsWith("actions/upload-artifact@"));
  assert.equal(upload.with.path, ".tmp/preview-cloud-export/encrypted/snapshot.tar.age\n.tmp/preview-cloud-export/encrypted/receipt.json\n");
  assert.equal(upload.with["retention-days"], 2);
  assert.equal(upload.with["if-no-files-found"], "error");
  assert.ok(!upload.if);
  assert.ok(!JSON.stringify(steps).includes("npm ci"));
});
