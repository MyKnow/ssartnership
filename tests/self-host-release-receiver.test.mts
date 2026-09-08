import assert from "node:assert/strict";
import test from "node:test";
import JSZip from "jszip";
import { createHash, randomBytes } from "node:crypto";
import { mkdtemp, readFile, writeFile, chmod, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isMainModule, parseReleaseArtifact, selectFirstAttemptRun, validatePulledImage, receiveRelease } from "../scripts/self-host-ci/receive-release.mjs";
import { imageReference } from "../scripts/self-host-ci/github-contract.mjs";

const sha = randomBytes(20).toString("hex");
const digest = `sha256:${randomBytes(32).toString("hex")}`;
const manifest = {
  version: 1, repository: "MyKnow/ssartnership", sha, runId: 17, attempt: 1, platform: "linux/amd64", sourceHash: randomBytes(32).toString("hex"),
  gate: { tests: 103, failures: 0, errors: 0, skipped: 0, retries: 0, e2eRuntime: "production-test-only", fixtureBuildDeployable: false },
  images: ["app", "telemetry", "database"].map((component) => ({ component, id: digest, digest, reference: `${imageReference(component, sha).split(":")[0]}@${digest}` })),
};
const run = { id: 17, repository: { full_name: "MyKnow/ssartnership" }, head_repository: { full_name: "MyKnow/ssartnership" }, head_sha: sha, head_branch: "dev", event: "push", run_attempt: 1, status: "completed", conclusion: "success", path: ".github/workflows/self-host-preview.yml" };
const jobs = [
  { name: "Isolated AMD64 Release Gate", run_id: 17, run_attempt: 1, head_sha: sha, status: "completed", conclusion: "success", steps: [{ name: "Build without publishing credentials", status: "completed", conclusion: "success" }, { name: "Upload only validated image archives", status: "completed", conclusion: "success" }] },
  { name: "Publish Verified Preview Images", run_id: 17, run_attempt: 1, head_sha: sha, status: "completed", conclusion: "success", steps: [{ name: "Authenticate registry for publication only", status: "completed", conclusion: "success" }, { name: "Verify archives and current dev before publication", status: "completed", conclusion: "success" }, { name: "Publish immutable deployment manifest", status: "completed", conclusion: "success" }, { name: "Remove registry session", status: "completed", conclusion: "success" }] },
];

async function artifactBytes(value = manifest, compression: "STORE" | "DEFLATE" = "STORE") {
  const zip = new JSZip(); zip.file("release.json", JSON.stringify(value));
  return zip.generateAsync({ type: "nodebuffer", compression });
}

test("receiver accepts only one regular release.json artifact", async () => {
  const bytes = await artifactBytes();
  assert.deepEqual(await parseReleaseArtifact(bytes, { size_in_bytes: bytes.length, digest: `sha256:${createHash("sha256").update(bytes).digest("hex")}` }), manifest);
  const compressed = await artifactBytes(manifest, "DEFLATE");
  assert.deepEqual(await parseReleaseArtifact(compressed, { size_in_bytes: compressed.length, digest: `sha256:${createHash("sha256").update(compressed).digest("hex")}` }), manifest);
  const bad = new JSZip(); bad.file("../release.json", "{}");
  const badBytes = await bad.generateAsync({ type: "nodebuffer" });
  await assert.rejects(() => parseReleaseArtifact(badBytes, { size_in_bytes: badBytes.length }), /RECEIVER_ARTIFACT_CONTENT_INVALID/);
});

test("receiver runtime keeps ZIP parsing self-contained", async () => {
  const source = await readFile(new URL("../scripts/self-host-ci/receive-release.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /from ["']jszip["']/u);
  assert.match(source, /inflateRawSync/u);
});

test("receiver main detection follows the control/current symlink", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "ssartnership-receiver-main-"));
  const linked = path.join(directory, "receive-release.mjs");
  const source = fileURLToPath(new URL("../scripts/self-host-ci/receive-release.mjs", import.meta.url));
  try {
    await symlink(source, linked);
    const moduleUrl = new URL("../scripts/self-host-ci/receive-release.mjs", import.meta.url).href;
    assert.equal(isMainModule(linked, moduleUrl), true);
    assert.equal(isMainModule(path.join(directory, "missing.mjs"), moduleUrl), false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("receiver rejects duplicate, retried and non-success runs", () => {
  assert.equal(selectFirstAttemptRun({ workflow_runs: [run] }, sha), run);
  assert.equal(selectFirstAttemptRun({ workflow_runs: [{ ...run, run_attempt: 2 }, { ...run, conclusion: "failure" }] }, sha), null);
  assert.throws(() => selectFirstAttemptRun({ workflow_runs: [run, run] }, sha), /RECEIVER_RUN_AMBIGUOUS/);
});

test("pulled images must match immutable digest, platform, revision and repository digest", () => {
  const item = manifest.images[0];
  const pulledId = `sha256:${randomBytes(32).toString("hex")}`;
  assert.notEqual(pulledId, item.id);
  assert.doesNotThrow(() => validatePulledImage({ Id: pulledId, Os: "linux", Architecture: "amd64", Config: { Labels: { "org.opencontainers.image.revision": sha } }, RepoDigests: [item.reference] }, item, sha));
  for (const patch of [{ Architecture: "arm64" }, { RepoDigests: [] }, { Id: "not-a-content-address" }]) assert.throws(() => validatePulledImage({ Id: pulledId, Os: "linux", Architecture: "amd64", Config: { Labels: { "org.opencontainers.image.revision": sha } }, RepoDigests: [item.reference], ...patch }, item, sha));
});

test("receiver independently verifies GitHub API, manifest, jobs and deploy callback", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "ssartnership-receiver-"));
  const tokenFile = path.join(root, "token"); await writeFile(tokenFile, `${"t".repeat(40)}\n`, { mode: 0o600 }); await chmod(tokenFile, 0o600);
  const bytes = await artifactBytes();
  const calls: string[] = [];
  const fetcher = async (url: RequestInfo | URL): Promise<Response> => {
    calls.push(String(url));
    const value = String(url);
    if (value.endsWith("/git/ref/heads/dev")) return new Response(JSON.stringify({ object: { sha } }), { status: 200 });
    if (value.includes("/runs?") && value.includes("head_sha=")) return new Response(JSON.stringify({ workflow_runs: [run] }), { status: 200 });
    if (value.endsWith("/jobs?per_page=100")) return new Response(JSON.stringify({ jobs }), { status: 200 });
    if (value.endsWith("/artifacts?per_page=100")) return new Response(JSON.stringify({ artifacts: [{ name: "ssartnership-preview-release", expired: false, workflow_run: { id: 17 }, size_in_bytes: bytes.length, digest: `sha256:${createHash("sha256").update(bytes).digest("hex")}`, archive_download_url: "https://api.github.com/repos/MyKnow/ssartnership/actions/artifacts/1/zip" }] }), { status: 200 });
    if (value.endsWith("/zip")) return new Response(bytes, { status: 200 });
    throw new Error("unexpected fetch");
  };
  const dockerCalls: string[][] = [];
  const pulledId = `sha256:${randomBytes(32).toString("hex")}`;
  const docker = async (args: string[]): Promise<{ stdout: string }> => {
    dockerCalls.push(args);
    if (args[0] === "image") return { stdout: JSON.stringify({ Id: pulledId, Os: "linux", Architecture: "amd64", Config: { Labels: { "org.opencontainers.image.revision": sha } }, RepoDigests: [manifest.images.find((item) => item.reference === args.at(-1))?.reference] }) };
    return { stdout: "" };
  };
  const config = { tokenFile, stateFile: path.join(root, "state.json"), releaseRoot: path.join(root, "releases"), composeFile: path.join(root, "compose.yaml"), composeCwd: root, runtimeEnvFile: path.join(root, "app.env"), composeProject: "test", healthOrigin: "http://127.0.0.1:3108" };
  const result = await receiveRelease({ config, fetcher, docker, readToken: async () => "t".repeat(40), deploy: async () => ({ deployed: true, image: digest, previousImage: null }), operator: true, now: () => "2026-09-08T00:00:00.000Z" });
  assert.equal(result.status, "deployed"); assert.equal(calls.filter((url) => url.includes("api.github.com")).length, 5); assert.ok(dockerCalls.some((args) => args[0] === "login"));
});
