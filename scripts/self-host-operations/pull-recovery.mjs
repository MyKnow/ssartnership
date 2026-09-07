#!/usr/bin/env node
import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, realpath, writeFile, rename, statfs } from "node:fs/promises";
import { spawn } from "node:child_process";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import os from "node:os";
import { createKeychainRecipient } from "./keychain.mjs";

const wrapper = path.join(os.homedir(), "coding", "myknow-server", "scripts", "ssh-codex-bootstrap.sh");
// Exact existing pinned VPN SSH transport. No port forwarding, new server
// listener, altered known_hosts or copied SSH private key is involved.
const remote = "sudo -n flock --nonblock --conflict-exit-code 75 /var/lib/ssartnership-ci/heavy.lock /opt/ssartnership/node24/node /opt/ssartnership/control/current/scripts/self-host-operations/export-recovery.mjs";
export async function pullRecovery(destination, keyDirectory) {
  if (process.platform !== "darwin") throw new Error("RECOVERY_MAC_OPERATOR_REQUIRED");
  const temporary = path.resolve(".tmp");
  if (await realpath(temporary) !== temporary) throw new Error("RECOVERY_OUTPUT_PATH_INVALID");
  const target = path.resolve(destination); const keys = path.resolve(keyDirectory);
  if (target === keys || ![target, keys].every((value) => value.startsWith(`${temporary}/`) && value !== temporary)) throw new Error("RECOVERY_OUTPUT_PATH_INVALID");
  for (const value of [target, keys]) if (await realpath(path.dirname(value)) !== path.dirname(value)) throw new Error("RECOVERY_OUTPUT_PATH_INVALID");
  const disk = await statfs(temporary);
  if (disk.bavail * disk.bsize < 12 * 1024 ** 3) throw new Error("RECOVERY_DISK_HEADROOM_REQUIRED");
  await mkdir(target, { mode: 0o700 }); await mkdir(keys, { mode: 0o700 });
  const pair = await createKeychainRecipient();
  await writeFile(path.join(keys, "recipient-keychain.json"), `${JSON.stringify(pair.reference)}\n`, { flag: "wx", mode: 0o600 });
  await writeFile(path.join(keys, "recipient-public.pem"), pair.publicKey, { flag: "wx", mode: 0o600 });
  const child = spawn("bash", [wrapper, remote], { stdio: ["pipe", "pipe", "pipe"] });
  child.stdin.end(pair.publicKey);
  child.stderr.on("data", () => {});
  const exited = new Promise((resolve) => { child.once("error", () => resolve(-1)); child.once("close", (code) => resolve(code)); });
  child.stdin.on("error", () => { child.kill("SIGTERM"); });
  const hash = createHash("sha256"); let bytes = 0;
  const counter = new Transform({ transform(chunk, _, callback) {
    bytes += chunk.length;
    if (bytes > 10 * 1024 ** 3) { callback(new Error("RECOVERY_SIZE_LIMIT")); return; }
    hash.update(chunk); callback(null, chunk);
  } });
  const timer = setTimeout(() => child.kill("SIGTERM"), 30 * 60_000);
  try {
    await pipeline(child.stdout, counter, createWriteStream(path.join(target, "recovery.tar.partial"), { flags: "wx", mode: 0o600 }));
    if (await exited !== 0 || bytes < 1024) throw new Error("RECOVERY_TRANSPORT_FAILED");
    await rename(path.join(target, "recovery.tar.partial"), path.join(target, "recovery.tar"));
    const receipt = { version: 1, copiedAt: new Date().toISOString(), transport: "pinned-vpn-ssh-pull", bytes, sha256: hash.digest("hex"), separateDevice: true, geographicDisasterProof: false, restored: false };
    await writeFile(path.join(target, "receipt.json"), `${JSON.stringify(receipt, null, 2)}\n`, { flag: "wx", mode: 0o600 });
    return receipt;
  } catch (error) { child.kill("SIGTERM"); await exited.catch(() => {}); throw error; }
  finally { clearTimeout(timer); }
}
if (process.argv[1] && import.meta.url === new URL(process.argv[1], "file:").href) {
  try { console.log(JSON.stringify(await pullRecovery(...process.argv.slice(2)))); }
  catch { console.error('{"error":"RECOVERY_PULL_FAILED"}'); process.exitCode = 1; }
}
