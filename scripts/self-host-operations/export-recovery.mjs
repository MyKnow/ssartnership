#!/usr/bin/env node
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { assertOperatorInput } from "../self-host-ci/lib.mjs";
import { sealRecoveryPayload } from "../self-host-ci/recovery-envelope.mjs";
import { cleanOperatorEnvironment } from "../self-host-ci/deployment.mjs";

const secrets = "/etc/myknow/secrets/ssartnership-preview";
const image = "restic/restic:0.19.1@sha256:136600b6ff6843d61d355f7f71f460a166429f35de6fd11b568fece3c9a4d510";
async function exportRecovery() {
  if (process.getuid?.() !== 0 || process.env.DOCKER_HOST) throw new Error("RECOVERY_OPERATOR_REQUIRED");
  await assertOperatorInput(path.join(secrets, "deployment.json"));
  const state = JSON.parse(await readFile(path.join(secrets, "deployment.json"), "utf8"));
  if (!/^[a-f0-9]{40}$/u.test(state.sha) || state.environment !== "synthetic-preview" || state.release !== `/srv/services/ssartnership/releases/${state.sha}`) throw new Error("RECOVERY_STATE_INVALID");
  await assertOperatorInput(state.release, { directory: true });
  let publicPem = "";
  for await (const chunk of process.stdin) { publicPem += chunk; if (publicPem.length > 16 * 1024) throw new Error("RECOVERY_RECIPIENT_TOO_LARGE"); }
  const lib = await import(pathToFileURL(path.join(state.release, "scripts/self-host-operations/lib.mjs")));
  const context = await lib.loadOperationsContext({ dataEnvFile: path.join(secrets, "data.env"), operationsEnvFile: path.join(secrets, "operations.env") });
  const release = await lib.acquireOperationsLock(context.stateDirectory);
  const startedAt = new Date().toISOString();
  const id = randomUUID();
  try {
    const paired = lib.selectBackupManifest(await lib.readManifest(lib.defaultManifestPath(context.operationsEnvFile)));
    const bundle = path.join(context.stateDirectory, `export-${id}`);
    await mkdir(bundle, { mode: 0o700 });
    const material = { version: 1, project: context.projectName, platform: "linux/amd64", sha: state.sha, pairedId: paired.id, environment: {} };
    for (const name of ["data.env", "operations.env", "app.env"]) {
      const file = path.join(secrets, name); await assertOperatorInput(file);
      const value = await readFile(file, "utf8");
      if (value.length > 16 * 1024) throw new Error("RECOVERY_KEYS_TOO_LARGE");
      material.environment[name] = value;
    }
    const sealed = sealRecoveryPayload(publicPem, Buffer.from(JSON.stringify(material)));
    await writeFile(path.join(bundle, "keys.envelope.json"), `${JSON.stringify(sealed)}\n`, { mode: 0o600, flag: "wx" });
    await writeFile(path.join(bundle, "manifest.jsonl"), `${JSON.stringify(paired)}\n`, { mode: 0o600, flag: "wx" });
    await new Promise((resolve, reject) => {
      const child = spawn("docker", ["run", "--rm", "--network", "none", "--read-only", "--cap-drop", "ALL", "--cap-add", "DAC_READ_SEARCH", "--security-opt", "no-new-privileges",
        "--volume", `${context.operations.PGBACKREST_REPOSITORY_VOLUME}:/export/bundle/pgbackrest:ro`, "--volume", `${context.operations.RESTIC_REPOSITORY_VOLUME}:/export/bundle/storage-repository:ro`,
        "--volume", `${bundle}/manifest.jsonl:/export/bundle/manifest.jsonl:ro`, "--volume", `${bundle}/keys.envelope.json:/export/bundle/keys.envelope.json:ro`,
        "--entrypoint", "/bin/tar", image, "-cf", "-", "-C", "/export", "bundle"], { env: cleanOperatorEnvironment(), stdio: ["ignore", process.stdout, "pipe"] });
      child.stderr.on("data", () => {});
      child.once("error", () => reject(new Error("RECOVERY_EXPORT_FAILED")));
      child.once("close", (code) => { if (code === 0) resolve(); else reject(new Error("RECOVERY_EXPORT_FAILED")); });
    });
    await lib.appendManifest(lib.defaultManifestPath(context.operationsEnvFile), { version: 1, kind: "offhost-export", id, result: "success", startedAt, finishedAt: new Date().toISOString(), pairedId: paired.id, recipient: sealed.recipient });
  } finally { await release(); }
}
if (process.argv[1] && import.meta.url === new URL(process.argv[1], "file:").href) {
  try { await exportRecovery(); }
  catch { process.stderr.write('{"error":"RECOVERY_EXPORT_FAILED"}\n'); process.exitCode = 1; }
}
