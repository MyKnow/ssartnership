#!/usr/bin/env node
// Local TLS transport fixture. Production receivers must use their own host,
// certificate lifecycle and separately controlled retention credentials.
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { serializeEnvironment } from "./lib.mjs";

export async function initializeReceiver(directory) {
  const target = path.resolve(directory);
  await mkdir(target, { mode: 0o700 }); // Deliberately refuses an existing path.
  const credential = randomBytes(32).toString("hex");
  const htpasswd = execFileSync("htpasswd", ["-niB", "backup"], { input: `${credential}\n`, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
  await writeFile(path.join(target, "htpasswd"), htpasswd, { mode: 0o600, flag: "wx" });
  execFileSync("openssl", ["req", "-newkey", "rsa:3072", "-nodes", "-x509", "-days", "30", "-subj", "/CN=ssartnership-backup-fixture",
    "-addext", "subjectAltName=DNS:host.docker.internal,DNS:localhost,IP:127.0.0.1", "-keyout", path.join(target, "private-key.pem"), "-out", path.join(target, "certificate.pem")], { stdio: "pipe" });
  await writeFile(path.join(target, "receiver.env"), serializeEnvironment({ BACKUP_RECEIVER_SECRETS_DIR: target, BACKUP_RECEIVER_PORT: "58443" }), { mode: 0o600, flag: "wx" });
  await writeFile(path.join(target, "offhost.env"), serializeEnvironment({
    OFFHOST_REPOSITORY: "rest:https://host.docker.internal:58443/backup/ssartnership/",
    OFFHOST_PASSWORD: randomBytes(32).toString("hex"), OFFHOST_USERNAME: "backup",
    OFFHOST_CREDENTIAL: credential, OFFHOST_CA_FILE: path.join(target, "certificate.pem"),
  }), { mode: 0o600, flag: "wx" });
  return { initialized: true, fixtureOnly: true };
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], "file:").href) {
  try {
    if (process.argv.length !== 3 || !process.argv[2]) throw new Error("usage");
    process.stdout.write(`${JSON.stringify(await initializeReceiver(process.argv[2]))}\n`);
  } catch { process.stderr.write('{"error":"RECEIVER_INITIALIZATION_FAILED"}\n'); process.exitCode = 1; }
}
