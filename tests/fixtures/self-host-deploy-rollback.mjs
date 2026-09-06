import assert from "node:assert/strict";
import path from "node:path";
import { runOperatorCommand, switchApplication } from "../../scripts/self-host-ci/deployment.mjs";

const cwd = process.cwd();
const run = (command, args, options = {}) => runOperatorCommand(command, args, { cwd, ...options });
const images = [];
for (const status of [200, 503]) {
  const tag = `ssartnership-ci/rollback-fixture:status-${status}`;
  await run("docker", ["build", "--tag", tag, "--build-arg", `RESPONSE_STATUS=${status}`, "--file", "tests/fixtures/self-host-deploy.Dockerfile", "."]);
  images.push((await run("docker", ["image", "inspect", "--format", "{{.Id}}", tag])).stdout.trim());
}
const composeArgs = ["compose", "--project-name", "ssartnership-rollback-fixture", "--file", path.join(cwd, "tests/fixtures/compose.self-host-deploy.yaml")];
try {
  await switchApplication({ composeArgs, cwd, nextImage: images[0], origin: "http://127.0.0.1:3131", timeout: 10_000 });
  await assert.rejects(switchApplication({ composeArgs, cwd, nextImage: images[1], previousImage: images[0], origin: "http://127.0.0.1:3131", timeout: 5000 }), { message: "DEPLOY_FAILED_ROLLED_BACK" });
  const container = (await run("docker", [...composeArgs, "ps", "--quiet", "app"], { env: { SELF_HOST_IMAGE: images[0] } })).stdout.trim();
  const active = JSON.parse((await run("docker", ["inspect", container])).stdout)[0];
  assert.equal(active.Config.Image, images[0]);
  assert.equal((await fetch("http://127.0.0.1:3131/api/health")).status, 200);
  console.log(JSON.stringify({ failedHealthRejected: true, previousImmutableImageRestored: true, health: 200 }));
} finally {
  // This fixture has no data volumes. Only its exact project is stopped.
  await run("docker", [...composeArgs, "down"], { env: { SELF_HOST_IMAGE: images[0] } });
}
