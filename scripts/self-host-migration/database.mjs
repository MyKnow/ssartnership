import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { createWriteStream, readFileSync } from "node:fs";
import { mkdir, lstat, realpath, writeFile, link, unlink } from "node:fs/promises";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { randomUUID, createHash, X509Certificate } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { PREVIEW_PROJECT, STORAGE_INVENTORY_SQL, validateStorageInventory } from "./storage.mjs";
import { SUPABASE_POSTGRES_DUMP_IMAGE } from "../supabase-sync-preview-dump-lib.mjs";
import { sha256File } from "../self-host-ci/lib.mjs";

/** @returns {never} */
const fail = code => { throw new Error(`MIGRATION_DATABASE_${code}`); };
const CA_FILE = fileURLToPath(new URL("../../deploy/self-host-migration/supabase-root-2021.crt", import.meta.url));
export function validateDatabaseCa(bytes, now = Date.now()) {
  if (!Buffer.isBuffer(bytes) || createHash("sha256").update(bytes).digest("hex") !== "700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7") fail("CA_INVALID");
  const cert = new X509Certificate(bytes);
  if (!cert.ca || now < Date.parse(cert.validFrom) || now >= Date.parse(cert.validTo)) fail("CA_INVALID");
}
const SNAPSHOT = /^[0-9A-F]{8}-[0-9A-F]{8}-[1-9][0-9]*$/u;
const SNAPSHOT_SQL = `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT jsonb_build_object('snapshot',pg_export_snapshot(),'readOnly',current_setting('transaction_read_only'),
 'database',current_database(),'serverVersion',current_setting('server_version_num'));`;
const PSQL = ["--no-psqlrc", "--quiet", "--tuples-only", "--no-align", "--set=ON_ERROR_STOP=1"];
const ROLES_SQL = `SELECT jsonb_build_object(
 'roles',(SELECT jsonb_agg(to_jsonb(r)-'rolpassword' ORDER BY r.rolname) FROM pg_roles r),
 'memberships',(SELECT coalesce(jsonb_agg(jsonb_build_object('role',r.rolname,'member',m.rolname,'grantor',g.rolname,
 'admin',a.admin_option,'inherit',a.inherit_option,'set',a.set_option) ORDER BY r.rolname,m.rolname,g.rolname),'[]')
 FROM pg_auth_members a JOIN pg_roles r ON r.oid=a.roleid JOIN pg_roles m ON m.oid=a.member JOIN pg_roles g ON g.oid=a.grantor)
);`;

export function previewConnection(databaseUrl) {
  try {
    const url = new URL(databaseUrl);
    const user = decodeURIComponent(url.username), password = decodeURIComponent(url.password);
    const direct = url.hostname === `db.${PREVIEW_PROJECT}.supabase.co` && user === "postgres";
    const pooler = /^aws-[0-9]+-[a-z]+(?:-[a-z]+)+-[0-9]+\.pooler\.supabase\.com$/u.test(url.hostname) && user === `postgres.${PREVIEW_PROJECT}`;
    // A stored transaction-pooler URL can identify the same reviewed project;
    // always select its session port for the exported-snapshot owner session.
    if (!["postgres:", "postgresql:"].includes(url.protocol) || !(direct || pooler) || (url.port && url.port !== "5432" && !(pooler && url.port === "6543"))
      || url.pathname !== "/postgres" || url.hash || !password || /[\u0000-\u001f\u007f]/u.test(password)
      || [...url.searchParams.keys()].some(key => key !== "sslmode") || url.searchParams.getAll("sslmode").length > 1
      || (url.searchParams.has("sslmode") && !["require", "verify-ca", "verify-full"].includes(url.searchParams.get("sslmode")))) fail("CONNECTION_INVALID");
    return {
      PGHOST: url.hostname, PGPORT: "5432", PGUSER: user, PGPASSWORD: password, PGDATABASE: "postgres",
      PGSSLMODE: "verify-full", PGSSLROOTCERT: "/etc/ssartnership-migration-ca.crt", PGCONNECT_TIMEOUT: "15",
      PGAPPNAME: "ssartnership-preview-export",
      PGOPTIONS: "-c default_transaction_read_only=on -c statement_timeout=600000 -c idle_in_transaction_session_timeout=900000",
    };
  } catch { fail("CONNECTION_INVALID"); }
}
export function databaseClientPlan(connection, tool, args, name) {
  if (!["psql", "pg_dump"].includes(tool) || !/^ssartnership-migration-[a-z0-9-]{1,80}$/u.test(name)) fail("CLIENT_INVALID");
  const keys = ["PGHOST", "PGPORT", "PGUSER", "PGPASSWORD", "PGDATABASE", "PGSSLMODE", "PGSSLROOTCERT", "PGCONNECT_TIMEOUT", "PGAPPNAME", "PGOPTIONS"];
  if (Object.keys(connection).sort().join() !== keys.sort().join()) fail("CONNECTION_INVALID");
  /** @type {Record<string, string | undefined>} */
  const env = { PATH: process.env.PATH, ...Object.fromEntries(keys.map(key => [key, connection[key]])) };
  return { command: "docker", args: ["run", "--rm", "--init", "--name", name, "--interactive", "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges",
    "--user", "65534:65534", "--pids-limit", "64", "--memory", "512m", "--cpus", "1", "--network", "bridge",
    "--tmpfs", "/tmp:mode=1777,size=64m", "--mount", `type=bind,src=${CA_FILE},dst=/etc/ssartnership-migration-ca.crt,readonly`,
    ...keys.flatMap(key => ["--env", key]), "--entrypoint", tool, SUPABASE_POSTGRES_DUMP_IMAGE, ...args],
  env };
}
export function validateSnapshot(value) {
  if (!value || Object.keys(value).sort().join() !== "database,readOnly,serverVersion,snapshot" || !SNAPSHOT.test(value.snapshot)
    || value.readOnly !== "on" || value.database !== "postgres" || !/^17[0-9]{4}$/u.test(value.serverVersion)) fail("SNAPSHOT_INVALID");
  return value;
}
export function snapshotDumpArguments(snapshot) {
  if (!SNAPSHOT.test(snapshot)) fail("SNAPSHOT_INVALID");
  // Keep all schema/data/ACL/function/event-trigger information as an original
  // custom archive. This is evidence, NOT permission to blindly pg_restore
  // Supabase-managed internals onto incompatible self-hosted service schemas.
  return ["--format=custom", "--compress=6", "--quote-all-identifiers", "--lock-wait-timeout=10000", `--snapshot=${snapshot}`];
}
function processClient(plan) {
  const child = spawn(plan.command, plan.args, { env: plan.env, stdio: ["pipe", "pipe", "pipe"] });
  let stderrBytes = 0, failed = false, killer;
  const stop = () => { failed = true; child.kill("SIGTERM"); killer ??= setTimeout(() => child.kill("SIGKILL"), 5000); };
  const timer = setTimeout(stop, 12 * 60_000);
  child.stderr.on("data", chunk => { stderrBytes += chunk.length; });
  child.stdin.on("error", stop);
  const done = new Promise((resolve, reject) => {
    child.once("error", () => { stop(); reject(new Error("MIGRATION_DATABASE_CLIENT_UNAVAILABLE")); });
    child.once("close", code => {
      clearTimeout(timer); clearTimeout(killer);
      if (code === 0 && !failed && stderrBytes === 0) resolve(); else reject(new Error("MIGRATION_DATABASE_CLIENT_FAILED"));
    });
  });
  // A process can exit while the caller awaits a stdout line. Observe now,
  // but require the same promise at query/end boundaries; no retry into green.
  done.catch(() => {});
  return { child, done, stop };
}
// planFor is an internal dependency boundary for synthetic Docker fixtures.
// The Cloud CLI must always construct it from previewConnection() above.
export function openDatabaseReader(planFor) {
  const client = processClient(planFor("psql", PSQL));
  let bytes = 0;
  client.child.stdout.on("data", chunk => { bytes += chunk.length; if (bytes > 128 * 1024 ** 2) client.stop(); });
  const lines = createInterface({ input: client.child.stdout, crlfDelay: Infinity });
  const iterator = lines[Symbol.asyncIterator]();
  const ended = client.done.then(() => { fail("READER_EARLY_EXIT"); });
  ended.catch(() => {});
  return {
    async query(sql) {
      client.child.stdin.write(`${sql}\n`);
      const line = await Promise.race([iterator.next(), ended]);
      if (line.done || Buffer.byteLength(line.value) > 64 * 1024 ** 2) fail("QUERY_INVALID");
      try { return JSON.parse(line.value); } catch { fail("QUERY_INVALID"); }
    },
    async close() { client.child.stdin.end("ROLLBACK;\n\\q\n"); await client.done; lines.close(); },
    async abort() { client.stop(); await client.done.catch(() => {}); lines.close(); },
  };
}
async function dump(plan, file) {
  const client = processClient(plan); client.child.stdin.end();
  let bytes = 0;
  const limit = new Transform({ transform(chunk, _encoding, done) {
    bytes += chunk.length; done(bytes > 2 * 1024 ** 3 ? new Error("MIGRATION_DATABASE_SIZE_LIMIT") : null, chunk);
  } });
  const copy = pipeline(client.child.stdout, limit, createWriteStream(file, { flags: "wx", mode: 0o600 }));
  try { await Promise.all([copy, client.done]); }
  catch { client.stop(); client.child.stdout.destroy(); await Promise.allSettled([copy, client.done]); fail("DUMP_FAILED"); }
  if (bytes < 5) fail("DUMP_EMPTY");
  return bytes;
}
export function cloudDatabaseClient(databaseUrl) {
  if (process.platform !== "linux") fail("LINUX_EXPORT_HOST_REQUIRED");
  validateDatabaseCa(readFileSync(CA_FILE));
  const connection = previewConnection(databaseUrl);
  return (tool, args) => databaseClientPlan(connection, tool, args, `ssartnership-migration-${randomUUID()}`);
}
export async function captureDatabase(directory, planFor) {
  let reader;
  try {
    if (!path.isAbsolute(directory) || path.resolve(directory) !== directory || await realpath(path.dirname(directory)) !== path.dirname(directory)) fail("DIRECTORY_INVALID");
    const parent = await lstat(path.dirname(directory));
    if (!parent.isDirectory() || parent.uid !== process.getuid() || (parent.mode & 0o077) !== 0) fail("DIRECTORY_INVALID");
    await mkdir(directory, { mode: 0o700 });
    const startedAt = new Date().toISOString();
    reader = openDatabaseReader(planFor);
    const snapshot = validateSnapshot(await reader.query(SNAPSHOT_SQL));
    const storageInventory = validateStorageInventory(await reader.query(STORAGE_INVENTORY_SQL));
    const roles = await reader.query(ROLES_SQL);
    const partial = path.join(directory, "database.dump.partial");
    const bytes = await dump(planFor("pg_dump", snapshotDumpArguments(snapshot.snapshot)), partial);
    // Exported snapshots become invalid on source-session loss; pg_dump must
    // finish and the owning read-only transaction must close successfully.
    await reader.close(); reader = undefined;
    await link(partial, path.join(directory, "database.dump")); await unlink(partial);
    await writeFile(path.join(directory, "storage-inventory.json"), JSON.stringify(storageInventory), { flag: "wx", mode: 0o600 });
    // pg_dump does not include cluster-global role definitions. Retain role
    // attributes/membership without database login password material. Their
    // reviewed mapping and new login credentials are a restore prerequisite.
    await writeFile(path.join(directory, "roles.json"), JSON.stringify(roles), { flag: "wx", mode: 0o600 });
    const receipt = { version: 1, sourceProject: PREVIEW_PROJECT, startedAt, completedAt: new Date().toISOString(), snapshot, bytes, sha256: await sha256File(path.join(directory, "database.dump")), restoreApproved: false };
    await writeFile(path.join(directory, "receipt.json"), JSON.stringify(receipt), { flag: "wx", mode: 0o600 });
    return { storageInventory, receipt };
  } catch { fail("CAPTURE_FAILED"); }
  finally { if (reader) await reader.abort(); }
}
export async function currentStorageInventory(planFor) {
  const reader = openDatabaseReader(planFor);
  try {
    const value = await reader.query(`BEGIN READ ONLY;\n${STORAGE_INVENTORY_SQL}`);
    await reader.close(); return validateStorageInventory(value);
  } catch { await reader.abort(); fail("INVENTORY_FAILED"); }
}
