import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, realpath, readFile, writeFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createEnvironmentPair, validateEnvironmentPair, environmentOverlay, renderEnvironmentOverlay, initializePair, loadPair } from "../scripts/self-host-environments/lib.mjs";
import { withPairLock } from "../scripts/self-host-environments/cli.mjs";
import { buildSanitizationSql, validateSnapshotLedger, storageObjectPath } from "../scripts/self-host-environments/sanitize.mjs";

test("two persistent environments have distinct projects, ports, volumes and all secrets", () => {
  const pair = createEnvironmentPair({ prefix: "ssartnership-dual-test", productionPort: 3210, previewPort: 3220, productionGatewayPort: 58110, previewGatewayPort: 58120 });
  validateEnvironmentPair(pair);
  for (const key of ["POSTGRES_PASSWORD", "JWT_SECRET", "SUPABASE_SERVICE_ROLE_KEY"]) assert.notEqual(pair.production.data[key], pair.preview.data[key]);
  for (const key of ["ADMIN_SESSION_SECRET", "USER_SESSION_SECRET", "PARTNER_SESSION_SECRET", "CRON_SECRET"] as const) assert.notEqual(pair.production.runtime[key], pair.preview.runtime[key]);
  assert.throws(() => validateEnvironmentPair({ ...pair, preview: pair.production }), /ENVIRONMENT_PAIR_INVALID/);
  assert.throws(() => validateEnvironmentPair({ ...pair, preview: { ...pair.preview, appPort: pair.production.appPort } }), /ENVIRONMENT_PAIR_INVALID/);
  assert.throws(() => validateEnvironmentPair({ ...pair, preview: { ...pair.preview, data: { ...pair.preview.data, JWT_SECRET: pair.production.data.JWT_SECRET } } }), /ENVIRONMENT_PAIR_INVALID/);
});

test("Preview blocks network egress and neither environment exposes PostgreSQL", () => {
  const pair = createEnvironmentPair({ prefix: "ssartnership-dual-test" });
  const preview = environmentOverlay(pair.preview);
  assert.match(renderEnvironmentOverlay(pair.preview), /networks: !override \[default\]/);
  assert.match(renderEnvironmentOverlay(pair.preview), /ports: !reset \[\]/);
  assert.match(renderEnvironmentOverlay(pair.preview), /preview-ingress:/);
  assert.equal(preview.services.app.mem_limit, "512m");
  assert.equal(preview.services.db.mem_limit, "768m");
  assert.equal(preview.services.app.environment.SELF_HOST_ENVIRONMENT, "preview");
  assert.equal(preview.services.app.environment.SELF_HOST_OUTBOUND_MODE, "blocked");
  assert.equal(Object.hasOwn(preview.services.db, "ports"), false);
  assert.equal(environmentOverlay(pair.production).networks.edge.internal, false);
});

test("sanitization requires a reviewed catalog and clears replayable credentials", () => {
  const catalog = [
    { table: "members", column: "password_hash", nullable: true },
    { table: "members", column: "password_salt", nullable: true },
    { table: "members", column: "email", nullable: true },
    { table: "members", column: "email_normalized", nullable: true },
    { table: "partner_accounts", column: "password_hash", nullable: false },
    { table: "partner_accounts", column: "initial_setup_token_hash", nullable: true },
    { table: "mattermost_sender_credentials", column: "encrypted_ciphertext", nullable: false },
    { table: "admin_push_subscriptions", column: "endpoint", nullable: false },
  ];
  const sql = buildSanitizationSql(catalog);
  assert.match(sql, /"members" SET "password_hash" = NULL/);
  assert.match(sql, /"partner_accounts" SET "password_hash" =/);
  assert.match(sql, /DELETE FROM public\."mattermost_sender_credentials"/);
  assert.match(sql, /DELETE FROM public\."admin_push_subscriptions"/);
  assert.match(sql, /@preview\.invalid/);
  assert.doesNotMatch(sql, /CASCADE|ALTER ROLE|DROP SCHEMA/);
  assert.throws(() => buildSanitizationSql([{ table: "unknown_table", column: "id", nullable: false }]), /UNREVIEWED_TABLE/);
  assert.throws(() => buildSanitizationSql([{ table: "members", column: "new_api_secret", nullable: true }]), /UNREVIEWED_SECRET_COLUMN/);
});

test("snapshot migrations must be a checksum-identical prefix of dev", () => {
  const plan = [{ name: "a", checksum: "1" }, { name: "b", checksum: "2" }];
  validateSnapshotLedger([{ name: "a", checksum: "1" }], plan);
  assert.throws(() => validateSnapshotLedger([{ name: "b", checksum: "2" }], plan), /SNAPSHOT_LEDGER/);
  assert.throws(() => validateSnapshotLedger([{ name: "a", checksum: "3" }], plan), /SNAPSHOT_LEDGER/);
  assert.throws(() => validateSnapshotLedger([], plan), /SNAPSHOT_LEDGER/);
});

test("Storage file copy accepts only canonical file-backend paths", () => {
  assert.equal(storageObjectPath({ bucket_id: "member-profile-images", name: "nested/photo.png", version: "11111111-1111-4111-8111-111111111111" }), "stub/stub/member-profile-images/nested/photo.png/11111111-1111-4111-8111-111111111111");
  for (const name of ["../secret", "/secret", "a/../../secret", "a\\secret", "a//b"]) assert.throws(() => storageObjectPath({ bucket_id: "public", name, version: "11111111-1111-4111-8111-111111111111" }), /STORAGE_PATH/);
});

test("paired email/password checks update atomically and integer arrays are not cast to text arrays", () => {
  const sql = buildSanitizationSql([
    { table: "members", column: "email", nullable: true, dataType: "text" },
    { table: "members", column: "email_normalized", nullable: true, dataType: "text" },
    { table: "admin_accounts", column: "password_hash", nullable: true },
    { table: "admin_accounts", column: "password_salt", nullable: true },
    { table: "promotion_slides", column: "allowed_years", nullable: true, dataType: "ARRAY", udt: "_int4" },
  ], { sourceStorageOrigin: "http://127.0.0.1:58110", targetStorageOrigin: "http://127.0.0.1:58120" });
  assert.match(sql, /SET "email" = [^;]+, "email_normalized" = /);
  assert.match(sql, /SET "password_hash" = NULL, "password_salt" = NULL;/);
  assert.doesNotMatch(sql, /allowed_years/);
});

test("private environment state rejects reinitialization, env drift, shared backup mounts and symlinks", async () => {
  const parent = await realpath(await mkdtemp(path.join(tmpdir(), "self-host-pair-")));
  try {
    const dir = path.join(parent, "pair");
    await initializePair(dir);
    const pair = await loadPair(dir);
    await assert.rejects(() => initializePair(dir), /EEXIST/);
    const opsFile = path.join(dir, "preview", "operations.env");
    const before = await readFile(opsFile, "utf8");
    await writeFile(opsFile, before.replace(`${pair.preview.project}_pgbackrest-repo`, `${pair.production.project}_pgbackrest-repo`));
    await assert.rejects(() => loadPair(dir), /ENVIRONMENT_OPERATIONS_DRIFT/);
    await writeFile(opsFile, before);
    await symlink(dir, path.join(parent, "alias"));
    await assert.rejects(() => loadPair(path.join(parent, "alias")), /SYMLINK/);
    await withPairLock(dir, async () => {
      await assert.rejects(() => withPairLock(dir, async () => {}), /ENVIRONMENT_OPERATION_BUSY/);
    });
    await withPairLock(dir, async () => {});
  } finally { await rm(parent, { recursive: true, force: true }); }
});
