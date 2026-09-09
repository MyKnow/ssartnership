import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import { DATABASE_PASSWORD_ROLES, assertRotationRoles, createPasswordVerifier, passwordMatchesVerifier, renderPasswordRotationSql } from "../scripts/self-host-operations/database-credentials.mjs";

test("rotation SCRAM verifiers are salted, validate both keys, and reject other passwords", () => {
  const password = randomBytes(32).toString("hex");
  const verifier = createPasswordVerifier(password);
  assert.ok(passwordMatchesVerifier(password, verifier));
  assert.notEqual(createPasswordVerifier(password), verifier);
  assert.equal(passwordMatchesVerifier("wrong", verifier), false);
  assert.equal(passwordMatchesVerifier(password, verifier.replace("4096", "999999999")), false);
  assert.equal(passwordMatchesVerifier(password, `${verifier.slice(0, -4)}AAAA`), false);
  assert.throws(() => createPasswordVerifier("';unsafe"), /ROTATION_PASSWORD_INVALID/);
});
test("rotation rejects missing or additional consumers of the shared database password", () => {
  const password = randomBytes(32).toString("hex");
  const rows = DATABASE_PASSWORD_ROLES.map((name) => ({name, password: createPasswordVerifier(password)}));
  assert.doesNotThrow(() => assertRotationRoles([...rows, {name: "monitor", password: null}], password));
  assert.throws(() => assertRotationRoles(rows.slice(1), password), /ROTATION_ROLE_INVENTORY_MISMATCH/);
  assert.throws(() => assertRotationRoles([...rows, {...rows[0], name: "unknown"}], password), /ROTATION_ROLE_INVENTORY_MISMATCH/);
  assert.throws(() => assertRotationRoles([...rows, rows[0]], password), /ROTATION_ROLE_INVENTORY_INVALID/);
});
test("rotation SQL accepts only exact roles and SCRAM material after session privacy settings", () => {
  const password = randomBytes(32).toString("hex");
  const values = Object.fromEntries(DATABASE_PASSWORD_ROLES.map((role) => [role, createPasswordVerifier(password)]));
  const sql = renderPasswordRotationSql(values);
  assert.ok(!sql.includes(password));
  assert.ok(sql.indexOf("SET log_statement") < sql.indexOf("BEGIN;"));
  assert.equal((sql.match(/ALTER ROLE/g) ?? []).length, 4);
  assert.ok(sql.endsWith("COMMIT;\n"));
  assert.throws(() => renderPasswordRotationSql({...values, postgres: "';COMMIT;"}), /ROTATION_VERIFIERS_INVALID/);
  assert.throws(() => renderPasswordRotationSql({...values, unknown: values.postgres}), /ROTATION_VERIFIERS_INVALID/);
});
