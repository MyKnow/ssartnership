#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { assertOperatorInput, validateRequest } from "./lib.mjs";
import { runOperatorCommand, switchApplication } from "./deployment.mjs";

const controllerRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const secretRoot = "/etc/myknow/secrets/ssartnership-preview";
export function previewComposeArguments(release, secrets = secretRoot) {
  return ["compose", "--project-name", "ssartnership-home-preview", "--env-file", path.join(secrets, "data.env"), "--env-file", path.join(secrets, "operations.env"), "--env-file", path.join(secrets, "monitoring/monitoring.env"),
    ...["compose.yaml", "compose.supabase.yaml", "compose.operations.yaml", "compose.monitoring.yaml", "compose.monitoring.host.yaml"].flatMap((file) => ["--file", path.join(release, file)]), "--file", path.join(controllerRoot, "compose.server.yaml")];
}
export async function bootstrapPreview(requestFile, release, imageEnvironmentFile) {
  if (process.getuid?.() !== 0 || process.env.DOCKER_HOST || process.env.DOCKER_CONTEXT) throw new Error("DEPLOY_ROOTFUL_OPERATOR_REQUIRED");
  for (const file of [requestFile, imageEnvironmentFile]) await assertOperatorInput(file);
  await assertOperatorInput(release, { directory: true });
  const request = validateRequest(JSON.parse(await readFile(requestFile, "utf8")));
  if (release !== `/srv/services/ssartnership/releases/${request.sha}` || request.platform !== "linux/amd64" || request.siteOrigin !== "http://127.0.0.1:3100" || request.supabaseOrigin !== "http://127.0.0.1:54321") throw new Error("DEPLOY_PREVIEW_APPROVAL_INVALID");
  const approval = JSON.parse(await readFile(path.join(release, ".approved-source.json"), "utf8"));
  if (approval.sha !== request.sha || approval.sourceHash !== request.sourceHash) throw new Error("DEPLOY_SOURCE_APPROVAL_MISMATCH");
  process.chdir(release);
  const database = await import(pathToFileURL(path.join(release, "scripts/self-host-database/lib.mjs")));
  const operations = await import(pathToFileURL(path.join(release, "scripts/self-host-operations/lib.mjs")));
  const runtime = await import(pathToFileURL(path.join(release, "deploy/self-host/write-local-runtime-env.mjs")));
  const monitoring = await import(pathToFileURL(path.join(release, "scripts/self-host-operations/monitoring.mjs")));
  const images = operations.parseEnvText(await readFile(imageEnvironmentFile, "utf8"));
  if (Object.keys(images).sort().join() !== ["SELF_HOST_IMAGE", "SELF_HOST_PGBACKREST_IMAGE", "SELF_HOST_TELEMETRY_IMAGE"].sort().join() || Object.values(images).some((id) => !/^sha256:[a-f0-9]{64}$/u.test(id))) throw new Error("DEPLOY_IMAGES_INVALID");
  // Exclusive new secret directory is also the bootstrap-once guard. An
  // existing environment must use maintenance/deployment, never initialize.
  await assertOperatorInput(path.dirname(secretRoot), { directory: true });
  await mkdir(secretRoot, { mode: 0o700 });
  const data = database.createDatabaseEnvironment({ project: "ssartnership-home-preview", port: "54321" });
  const dataFile = path.join(secretRoot, "data.env");
  const operationsFile = path.join(secretRoot, "operations.env");
  const appFile = path.join(secretRoot, "app.env");
  const backup = { ...operations.createOperationsEnvironment(data.COMPOSE_PROJECT_NAME, operationsFile), ...images, SELF_HOST_RUNTIME_ENV_FILE: appFile };
  await writeFile(dataFile, database.renderEnvironmentFile(data), { mode: 0o600, flag: "wx" });
  await writeFile(operationsFile, operations.serializeEnvironment(backup), { mode: 0o600, flag: "wx" });
  await writeFile(appFile, operations.serializeEnvironment(runtime.createLocalRuntimeEnvironment(data)), { mode: 0o600, flag: "wx" });
  await monitoring.initializeMonitoring(path.join(secretRoot, "monitoring"));
  const args = previewComposeArguments(release);
  const run = (command, values, options = {}) => runOperatorCommand(command, values, { cwd: release, ...options });
  await run("docker", [...args, "up", "-d", "--no-build", "--wait", "--wait-timeout", "240", "db", "rest", "storage", "gateway"]);
  await run(process.execPath, ["scripts/self-host-database/cli.mjs", "migrate", "--env-file", dataFile], { timeout: 600_000 });
  await run(process.execPath, ["scripts/self-host-database/cli.mjs", "smoke", "--env-file", dataFile]);
  // Fresh synthetic Preview only: old migrations seed two images deliberately
  // removed from the product repository. Do not revive deleted design assets
  // or modify applied migrations. This never runs on an existing/restored DB.
  await run("docker", [...args, "exec", "-T", "--user", "postgres", "db", "psql", "-v", "ON_ERROR_STOP=1", "-U", "supabase_admin", "-d", "postgres"], { input: "UPDATE public.promotion_slides SET is_active=false WHERE image_src IN ('/ads/home-partnership-overview.svg','/ads/campus-partners.svg');\n" });
  await monitoring.installMonitorRole(await operations.loadOperationsContext({ dataEnvFile: dataFile, operationsEnvFile: operationsFile }), path.join(secretRoot, "monitoring"));
  await run("docker", [...args, "up", "-d", "--no-build", "prometheus", "alertmanager", "grafana", "node-exporter", "postgres-exporter", "telemetry"]);
  await switchApplication({ composeArgs: args, cwd: release, nextImage: images.SELF_HOST_IMAGE, origin: request.siteOrigin });
  const state = { version: 1, environment: "synthetic-preview", sha: request.sha, release, images, sourceHash: request.sourceHash, installedAt: new Date().toISOString(), productionCutover: false };
  await writeFile(path.join(secretRoot, "deployment.json"), `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600, flag: "wx" });
  return { deployed: true, environment: state.environment, sha: request.sha, productionCutover: false };
}
if (process.argv[1] && import.meta.url === new URL(process.argv[1], "file:").href) {
  try { console.log(JSON.stringify(await bootstrapPreview(...process.argv.slice(2)))); }
  catch { console.error('{"error":"PREVIEW_BOOTSTRAP_FAILED"}'); process.exitCode = 1; }
}
