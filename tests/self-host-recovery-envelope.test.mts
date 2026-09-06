import assert from "node:assert/strict";
import test from "node:test";
import { generateKeyPairSync, randomBytes } from "node:crypto";
import { sealRecoveryPayload, openRecoveryPayload } from "../scripts/self-host-ci/recovery-envelope.mjs";
import { recoveryBackupKeys, recoveryExtractArguments, validateRecoveryReceipt } from "../scripts/self-host-operations/rehearse-pulled-recovery.mjs";

test("recovery keys are sealed to the outside operator, authenticate ciphertext and reject wrong recipients", { timeout: 15_000 }, () => {
  const pair = generateKeyPairSync("rsa", { modulusLength: 3072, publicKeyEncoding: { type: "spki", format: "pem" }, privateKeyEncoding: { type: "pkcs8", format: "pem" } });
  const secret = randomBytes(48).toString("hex");
  const payload = Buffer.from(JSON.stringify({ key: secret }));
  const envelope = sealRecoveryPayload(pair.publicKey, payload);
  assert.ok(!JSON.stringify(envelope).includes(secret));
  assert.deepEqual(openRecoveryPayload(pair.privateKey, envelope), payload);
  const tag = Buffer.from(envelope.tag, "base64"); tag[0] ^= 1;
  assert.throws(() => openRecoveryPayload(pair.privateKey, { ...envelope, tag: tag.toString("base64") }));
  assert.throws(() => openRecoveryPayload(pair.privateKey, { ...envelope, recipient: randomBytes(32).toString("hex") }));
  assert.throws(() => openRecoveryPayload(pair.privateKey, { ...envelope, ciphertext: `${envelope.ciphertext}\n` }));
  assert.throws(() => sealRecoveryPayload(pair.publicKey, Buffer.alloc(64 * 1024 + 1)));
});

test("recovery extraction preserves database repository numeric ownership only inside its fresh volume", () => {
  const args = recoveryExtractArguments("/private/received.tar", "ssartnership-pulled-offhost-" + "a".repeat(32));
  assert.ok(args.includes("--numeric-owner"));
  assert.ok(!args.includes("--no-same-owner"));
  assert.deepEqual(args.filter((_, i) => args[i - 1] === "--cap-add"), ["CHOWN", "FOWNER", "DAC_OVERRIDE"]);
  assert.equal(args[args.indexOf("--network") + 1], "none");
  assert.equal(args.filter(value => value.includes("type=bind")).length, 1);
  assert.ok(args.includes("type=bind,src=/private/received.tar,dst=/input.tar,readonly"));
  assert.ok(args.includes("--read-only"));
});

test("pulled recovery accepts only paired server material and never reuses app credentials or source volumes", () => {
  const material = { version: 1, project: "ssartnership-home-preview", platform: "linux/amd64", sha: "a".repeat(40), pairedId: "backup-123", environment: {
    "data.env": "COMPOSE_PROJECT_NAME=ssartnership-home-preview\n",
    "app.env": "APP_SECRET=do-not-propagate\n",
    "operations.env": `PGBACKREST_REPO1_CIPHER_PASS=${"b".repeat(64)}\nRESTIC_PASSWORD=${"c".repeat(64)}\nPGBACKREST_REPOSITORY_VOLUME=original-volume\n`,
  } };
  const image = { Os: "linux", Architecture: "amd64", Config: { Labels: { "org.opencontainers.image.revision": material.sha } } };
  assert.deepEqual(Object.keys(recoveryBackupKeys(material, image, "backup-123")).sort(), ["PGBACKREST_REPO1_CIPHER_PASS", "RESTIC_PASSWORD"]);
  assert.throws(() => recoveryBackupKeys(material, { ...image, Architecture: "arm64" }, "backup-123"));
  assert.throws(() => recoveryBackupKeys(material, image, "different-backup"));
  assert.throws(() => recoveryBackupKeys({ ...material, environment: { ...material.environment, "operations.env": "RESTIC_PASSWORD=short\n" } }, image, "backup-123"));
  const receipt = { version: 1, transport: "pinned-vpn-ssh-pull", bytes: 2048, sha256: "a".repeat(64) };
  assert.doesNotThrow(() => validateRecoveryReceipt(receipt, 2048, "a".repeat(64)));
  assert.throws(() => validateRecoveryReceipt(receipt, 1024, "a".repeat(64)));
  assert.throws(() => validateRecoveryReceipt(receipt, 2048, "b".repeat(64)));
});
