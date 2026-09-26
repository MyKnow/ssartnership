import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("GitHub baseline is restricted to the lab ref and cannot publish deployments", () => {
  const workflow = readFileSync(new URL("../.github/workflows/build-lab-baseline.yml", import.meta.url), "utf8");
  assert.match(workflow, /branches: \[ci\/497-pve-build-lab\]/);
  assert.match(workflow, /paths: \[\.github\/workflows\/build-lab-baseline\.yml\]/);
  assert.match(workflow, /permissions:\n  contents: read/);
  assert.doesNotMatch(workflow, /\b(?:write|write-all)\b|secrets\.|pull_request_target|workflow_dispatch|docker login|ghcr\.io/);
  assert.match(workflow, /persist-credentials: false/);
  assert.match(workflow, /cancel-in-progress: false/);
  const script = readFileSync(new URL("../scripts/build-lab/github_baseline.py", import.meta.url), "utf8");
  assert.match(script, /for repetition in \(1, 2, 3\)/);
  assert.match(script, /for mode in \('cold', 'warm'\)/);
  assert.match(script, /BASE_ARCHIVE_HASH/);
  assert.doesNotMatch(script, /docker.*(?:push|login)|deliver_preview|pve-agent/);
});
