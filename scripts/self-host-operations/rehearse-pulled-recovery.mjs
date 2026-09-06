#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { lstat, readFile, writeFile, mkdir, realpath, statfs } from "node:fs/promises";
import path from "node:path";
import { openRecoveryPayload } from "../self-host-ci/recovery-envelope.mjs";
import { sha256File } from "../self-host-ci/lib.mjs";
import { runOperatorCommand } from "../self-host-ci/deployment.mjs";
import { createProcessRunner } from "./cli.mjs";
import { OFFHOST_IMAGE, rehearseRecoveredBundle } from "./offhost.mjs";
import { assertAbsentVolume, parseEnvText, parseManifestLines, selectBackupManifest } from "./lib.mjs";

export function validateRecoveryReceipt(receipt, size, hash) {
  if (receipt?.version !== 1 || receipt.transport !== "pinned-vpn-ssh-pull" || !Number.isSafeInteger(size)
    || size < 1024 || size > 10 * 1024 ** 3 || receipt.bytes !== size || receipt.sha256 !== hash) throw new Error("RECOVERY_RECEIPT_INVALID");
}
export function recoveryBackupKeys(material, image, pairedId) {
  if (material?.version !== 1 || material.project !== "ssartnership-home-preview" || material.platform !== "linux/amd64"
    || !/^[a-f0-9]{40}$/u.test(material.sha ?? "") || material.pairedId !== pairedId
    || `${image?.Os}/${image?.Architecture}` !== material.platform
    || image.Config?.Labels?.["org.opencontainers.image.revision"] !== material.sha) throw new Error("RECOVERY_MATERIAL_INVALID");
  const parsed = parseEnvText(material.environment?.["operations.env"]);
  const keys = Object.fromEntries(["PGBACKREST_REPO1_CIPHER_PASS", "RESTIC_PASSWORD"].map((key) => [key, parsed[key]]));
  if (Object.values(keys).some((value) => !/^[a-f0-9]{64}$/u.test(value ?? ""))) throw new Error("RECOVERY_BACKUP_KEYS_INVALID");
  // Only the two backup keys cross this boundary. Original Compose volumes,
  // runtime credentials, outbound integrations and host paths are not reused.
  return keys;
}
export function recoveryExtractArguments(archive, volume) {
  return ["run", "--rm", "--network", "none", "--read-only", "--cap-drop", "ALL",
    "--cap-add", "CHOWN", "--cap-add", "FOWNER", "--cap-add", "DAC_OVERRIDE",
    "--security-opt", "no-new-privileges", "--memory", "128m", "--cpus", "0.5", "--pids-limit", "64",
    "--mount", `type=bind,src=${archive},dst=/input.tar,readonly`, "--volume", `${volume}:/recovered`, "--entrypoint", "/bin/tar", OFFHOST_IMAGE,
    "--numeric-owner", "-xf", "/input.tar", "-C", "/recovered"];
}
export async function rehearsePulledRecovery(bundleDirectory, privateKeyFile, databaseImage) {
  if (process.platform !== "darwin" || !/^sha256:[a-f0-9]{64}$/u.test(databaseImage ?? "")) throw new Error("RECOVERY_MAC_IMAGE_REQUIRED");
  const directory = path.resolve(bundleDirectory);
  const temporary = path.resolve(".tmp");
  if (!directory.startsWith(`${temporary}/`) || await realpath(directory) !== directory) throw new Error("RECOVERY_PATH_INVALID");
  const archive = path.join(directory, "recovery.tar");
  const metadata = await lstat(archive); const keyMetadata = await lstat(privateKeyFile);
  if (!metadata.isFile() || metadata.isSymbolicLink() || !keyMetadata.isFile() || keyMetadata.isSymbolicLink()
    || (keyMetadata.mode & 0o077) !== 0 || keyMetadata.size > 16 * 1024) throw new Error("RECOVERY_FILES_INVALID");
  validateRecoveryReceipt(JSON.parse(await readFile(path.join(directory, "receipt.json"), "utf8")), metadata.size, await sha256File(archive));
  const disk = await statfs(temporary);
  if (disk.bavail * disk.bsize < Math.max(12 * 1024 ** 3, metadata.size * 4)) throw new Error("RECOVERY_DISK_HEADROOM_REQUIRED");
  const run = createProcessRunner();
  const volume = `ssartnership-pulled-offhost-${randomUUID().replaceAll("-", "")}`;
  await assertAbsentVolume(run, volume);
  // Pinned-transport/hash-verified archive is extracted only in a new Docker
  // volume. No host output mount, network, app or production volume is present.
  // Numeric PostgreSQL ownership must survive, otherwise its non-root restore
  // process cannot read 0750/0600 repository entries. These capabilities apply
  // only to this isolated container and its fresh destination volume.
  await runOperatorCommand("docker", recoveryExtractArguments(archive, volume), { timeout: 1_800_000 });
  const readBundle = async (file) => (await runOperatorCommand("docker", ["run", "--rm", "--network", "none", "--read-only", "--cap-drop", "ALL", "--volume", `${volume}:/recovered:ro`, "--entrypoint", "/bin/cat", OFFHOST_IMAGE, `/recovered/bundle/${file}`])).stdout;
  const paired = selectBackupManifest(parseManifestLines(await readBundle("manifest.jsonl")));
  const plaintext = openRecoveryPayload(await readFile(privateKeyFile, "utf8"), JSON.parse(await readBundle("keys.envelope.json")));
  let material;
  try { material = JSON.parse(plaintext.toString("utf8")); } finally { plaintext.fill(0); }
  const image = JSON.parse((await runOperatorCommand("docker", ["image", "inspect", databaseImage])).stdout)[0];
  const operations = recoveryBackupKeys(material, image, paired.id);
  const stateDirectory = path.join(directory, `rehearsal-${randomUUID()}`);
  await mkdir(stateDirectory, { mode: 0o700 });
  const result = await rehearseRecoveredBundle({ stateDirectory, operations }, run, volume, { databaseImage });
  const receipt = { version: 1, completedAt: new Date().toISOString(), sourceSha: material.sha, sourcePlatform: material.platform,
    databaseImage, sourceBundleVolume: volume, separateDevice: true, geographicDisasterProof: false, restored: true, drill: result };
  await writeFile(path.join(stateDirectory, "receipt.json"), `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600, flag: "wx" });
  return receipt;
}
if (process.argv[1] && import.meta.url === new URL(process.argv[1], "file:").href) {
  try { console.log(JSON.stringify(await rehearsePulledRecovery(...process.argv.slice(2)))); }
  catch { console.error('{"error":"RECOVERY_REHEARSAL_FAILED"}'); process.exitCode = 1; }
}
