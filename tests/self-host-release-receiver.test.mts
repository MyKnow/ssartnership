import assert from "node:assert/strict";
import test from "node:test";
import JSZip from "jszip";
import { createHash, randomBytes } from "node:crypto";
import { mkdtemp, readFile, writeFile, chmod, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isMainModule, isSameApprovedRelease, parseReleaseArtifact, selectFirstAttemptRun, validatePulledImage, receiveRelease } from "../scripts/self-host-ci/receive-release.mjs";
import { imageReference } from "../scripts/self-host-ci/github-contract.mjs";

const sha = randomBytes(20).toString("hex");
const digest = `sha256:${randomBytes(32).toString("hex")}`;
const supabaseTree = "a".repeat(40);
const migrationTree = "b".repeat(40);
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

test("receiver recognizes the same approved release across build and pulled image identities", () => {
  const images = manifest.images.map((item) => ({ ...item, id: `sha256:${randomBytes(32).toString("hex")}` }));
  const state = {
    version: 1, repository: manifest.repository, workflow: ".github/workflows/self-host-preview.yml",
    sha, runId: manifest.runId, attempt: 1, platform: manifest.platform, sourceHash: manifest.sourceHash,
    manifestHash: createHash("sha256").update(JSON.stringify(manifest)).digest("hex"),
    appImage: images[0].id, images,
  };
  assert.notEqual(state.appImage, manifest.images[0].id);
  assert.equal(isSameApprovedRelease(state, manifest), true);
  assert.equal(isSameApprovedRelease(null, manifest), false);
  for (const patch of [
    { version: 2 }, { repository: "different/repository" }, { workflow: "different.yml" },
    { sha: "0".repeat(40) }, { runId: 18 }, { attempt: 2 }, { platform: "linux/arm64" },
    { sourceHash: "0".repeat(64) }, { manifestHash: "0".repeat(64) }, { appImage: digest },
    { images: undefined }, { images: [...images, images[0]] }, { images: images.slice(1) },
    { images: images.map((item) => ({ ...item, id: "invalid" })) },
    { images: images.map((item) => ({ ...item, reference: "other@" + item.digest })) },
    { images: images.map((item) => ({ ...item, digest: "sha256:" + "0".repeat(64) })) },
    { images: [images[0], images[0], images[2]] },
  ]) assert.equal(isSameApprovedRelease({ ...state, ...patch }, manifest), false);
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
    if (value.endsWith(`/git/trees/${sha}`)) return new Response(JSON.stringify({ sha, truncated: false, tree: [{ path: "supabase", mode: "040000", type: "tree", sha: supabaseTree }] }), { status: 200 });
    if (value.endsWith(`/git/trees/${supabaseTree}`)) return new Response(JSON.stringify({ sha: supabaseTree, truncated: false, tree: [{ path: "migrations", mode: "040000", type: "tree", sha: migrationTree }] }), { status: 200 });
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
  const config = { tokenFile, schemaApprovalFile: path.join(root, "schema.json"), stateFile: path.join(root, "state.json"), releaseRoot: path.join(root, "releases"), composeFile: path.join(root, "compose.yaml"), composeCwd: root, runtimeEnvFile: path.join(root, "app.env"), composeProject: "test", healthOrigin: "http://127.0.0.1:3108" };
  let approval = { version: 1, repository: "MyKnow/ssartnership", environment: "original-preview", project: "ssartnership-original-preview-34141078185", migrationTree, verifiedSourceSha: sha, migrationCount: 199, verifiedAt: "2026-09-08T00:00:00.000Z" };
  const options = { config, fetcher, docker, readToken: async () => "t".repeat(40), readSchema: async () => approval, deploy: async () => ({ deployed: true, image: digest, previousImage: null }), operator: true, now: () => "2026-09-08T00:00:00.000Z" };
  try {
    const result = await receiveRelease(options);
    assert.equal(result.status, "deployed"); assert.equal(calls.filter((url) => url.includes("api.github.com")).length, 7); assert.ok(dockerCalls.some((args) => args[0] === "login"));
    const before = await readFile(config.stateFile, "utf8");
    const dockerCount = dockerCalls.length;
    approval = { ...approval, migrationTree: "0".repeat(40) };
    await assert.rejects(() => receiveRelease(options), /RECEIVER_SCHEMA_NOT_APPROVED/);
    assert.equal(dockerCalls.length, dockerCount, "schema drift must stop before any image pull or deployment");
    assert.equal(await readFile(config.stateFile, "utf8"), before, "an existing release must not bypass schema approval");
    await assert.rejects(() => receiveRelease({ ...options, readSchema: async () => { throw new Error("RECEIVER_SCHEMA_APPROVAL_FILE_INVALID"); } }), /RECEIVER_SCHEMA_APPROVAL_FILE_INVALID/);
    assert.equal(dockerCalls.length, dockerCount);
  } finally { await rm(root, { recursive: true, force: true }); }
});
