import { createHash, createHmac, pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";

export const DATABASE_PASSWORD_ROLES = Object.freeze(["authenticator", "postgres", "supabase_admin", "supabase_storage_admin"]);
const pattern = /^SCRAM-SHA-256\$(\d+):([A-Za-z0-9+/]+=*)\$([A-Za-z0-9+/]+=*):([A-Za-z0-9+/]+=*)$/u;
function derive(password, salt, iterations) {
  const salted = pbkdf2Sync(password, salt, iterations, 32, "sha256");
  return {
    stored: createHash("sha256").update(createHmac("sha256", salted).update("Client Key").digest()).digest(),
    server: createHmac("sha256", salted).update("Server Key").digest(),
  };
}
export function createPasswordVerifier(password) {
  // The operator generates ASCII hex, so no Unicode normalization ambiguity.
  if (!/^[a-f0-9]{64}$/u.test(password)) throw new Error("ROTATION_PASSWORD_INVALID");
  const salt = randomBytes(16);
  const keys = derive(password, salt, 4096);
  return `SCRAM-SHA-256$4096:${salt.toString("base64")}$${keys.stored.toString("base64")}:${keys.server.toString("base64")}`;
}
export function passwordMatchesVerifier(password, verifier) {
  const match = typeof verifier === "string" ? pattern.exec(verifier) : null;
  if (!match || Number(match[1]) < 4096 || Number(match[1]) > 1000000) return false;
  const keys = derive(password, Buffer.from(match[2], "base64"), Number(match[1]));
  return [keys.stored, keys.server].every((key, index) => {
    const actual = Buffer.from(match[index + 3], "base64");
    return key.length === actual.length && timingSafeEqual(key, actual);
  });
}
export function assertRotationRoles(rows, oldPassword) {
  if (!Array.isArray(rows) || rows.length > 100 || new Set(rows.map((row) => row.name)).size !== rows.length) throw new Error("ROTATION_ROLE_INVENTORY_INVALID");
  const matched = rows.filter((row) => passwordMatchesVerifier(oldPassword, row.password)).map((row) => row.name).sort();
  if (JSON.stringify(matched) !== JSON.stringify(DATABASE_PASSWORD_ROLES)) throw new Error("ROTATION_ROLE_INVENTORY_MISMATCH");
}
export function renderPasswordRotationSql(verifiers) {
  if (!verifiers || JSON.stringify(Object.keys(verifiers).sort()) !== JSON.stringify(DATABASE_PASSWORD_ROLES)
    || Object.values(verifiers).some((value) => !pattern.test(value) || !value.startsWith("SCRAM-SHA-256$4096:"))) throw new Error("ROTATION_VERIFIERS_INVALID");
  // Separate statements over psql stdin: protect the session before any
  // credential material is sent. Never echo or put passwords in argv/SQL.
  return ["\\set ON_ERROR_STOP on", "SET log_statement = 'none';", "SET log_min_error_statement = 'panic';",
    "SET log_error_verbosity = 'terse';", "SET log_parameter_max_length_on_error = 0;", "SET log_min_duration_statement = -1;",
    "SET log_min_duration_sample = -1;", "SET log_transaction_sample_rate = 0;", "SET pgaudit.log = 'none';", "BEGIN;",
    ...DATABASE_PASSWORD_ROLES.map((role) => `ALTER ROLE ${role} PASSWORD '${verifiers[role]}';`), "COMMIT;", ""].join("\n");
}
