import { createHash, createPublicKey, generateKeyPairSync, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const source = fileURLToPath(new URL("./keychain-helper.swift", import.meta.url));
export function validateKeyReference(value) {
  if (value?.version !== 1 || value.custody !== "macos-login-keychain" || value.synchronizable !== false
    || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(value.account ?? "")
    || !/^[a-f0-9]{64}$/u.test(value.fingerprint ?? "")
    || Object.keys(value).sort().join() !== "account,custody,fingerprint,synchronizable,version") throw new Error("RECOVERY_KEY_REFERENCE_INVALID");
  return value;
}
const fingerprint = (key) => createHash("sha256").update(createPublicKey(key).export({ type: "spki", format: "der" })).digest("hex");
export async function prepareKeychainHelper() {
  if (process.platform !== "darwin") throw new Error("RECOVERY_KEYCHAIN_MAC_REQUIRED");
  const directory = path.join(os.homedir(), "Library/Application Support/ssartnership-recovery");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const metadata = await lstat(directory);
  if (await realpath(directory) !== directory || metadata.uid !== process.getuid() || (metadata.mode & 0o077) !== 0) throw new Error("RECOVERY_KEYCHAIN_HELPER_PATH_INVALID");
  const digest = createHash("sha256").update(await readFile(source)).digest("hex");
  const binary = path.join(directory, `keychain-${digest}`);
  try { await lstat(binary); }
  catch (error) {
    if (error.code !== "ENOENT") throw error;
    execFileSync("xcrun", ["swiftc", "-O", "-framework", "Security", source, "-o", binary], { stdio: "pipe", timeout: 120_000 });
  }
  const executable = await lstat(binary);
  if (!executable.isFile() || executable.isSymbolicLink() || executable.uid !== process.getuid() || (executable.mode & 0o022) !== 0) throw new Error("RECOVERY_KEYCHAIN_HELPER_INVALID");
  return binary;
}
export function keychainOperation(binary, operation, account, input, namespace = "recovery") {
  if (!["put", "get", "delete-test"].includes(operation) || !["recovery", "test"].includes(namespace)
    || (operation === "delete-test" && namespace !== "test") || !/^[a-f0-9-]{36}$/u.test(account)) throw new Error("RECOVERY_KEYCHAIN_OPERATION_INVALID");
  try {
    return execFileSync(binary, [operation, namespace, account], { input, stdio: ["pipe", "pipe", "pipe"], maxBuffer: 16 * 1024, timeout: 60_000 });
  } catch { throw new Error("RECOVERY_KEYCHAIN_OPERATION_FAILED"); }
}
export async function createKeychainRecipient() {
  const binary = await prepareKeychainHelper();
  const pair = generateKeyPairSync("rsa", { modulusLength: 4096 });
  const privateKey = Buffer.from(pair.privateKey.export({ type: "pkcs8", format: "pem" }));
  const publicKey = pair.publicKey.export({ type: "spki", format: "pem" });
  const reference = { version: 1, custody: "macos-login-keychain", account: randomUUID(), fingerprint: fingerprint(privateKey), synchronizable: false };
  try {
    keychainOperation(binary, "put", reference.account, privateKey);
    const restored = keychainOperation(binary, "get", reference.account);
    try { if (fingerprint(restored) !== reference.fingerprint) throw new Error("RECOVERY_KEYCHAIN_READBACK_INVALID"); }
    finally { restored.fill(0); }
  } finally { privateKey.fill(0); }
  return { publicKey, reference };
}
export async function readKeychainRecipient(reference) {
  validateKeyReference(reference);
  const key = keychainOperation(await prepareKeychainHelper(), "get", reference.account);
  try { if (fingerprint(key) !== reference.fingerprint) throw new Error("RECOVERY_KEYCHAIN_RECIPIENT_MISMATCH"); }
  catch (error) { key.fill(0); throw error; }
  return key;
}
