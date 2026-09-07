import path from "node:path";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { initializePair, loadPair, pairComposeArgs, fail, assertPrivatePath } from "./lib.mjs";
import { root, run, assertIdentity, migrations, psql, startData } from "./cli.mjs";
import { buildSanitizationSql, validateSnapshotLedger, storageObjectPath } from "./sanitize.mjs";
import { createProcessRunner, performRestoreDrill } from "../self-host-operations/cli.mjs";
import { loadOperationsContext, acquireOperationsLock, composeArguments } from "../self-host-operations/lib.mjs";
import { renderMigrationRunnerSql } from "../self-host-database/lib.mjs";
import { shouldSyncPreviewStorageBucket, isInvalidPreviewRequiredStorageBucket } from "../supabase-sync-preview-storage.mjs";

const CATALOG_SQL = "SELECT coalesce(json_agg(json_build_object('table',table_name,'column',column_name,'nullable',is_nullable='YES','dataType',data_type,'udt',udt_name) ORDER BY table_name,ordinal_position),'[]') FROM information_schema.columns WHERE table_schema='public';";
const TABLES_SQL = "SELECT coalesce(json_agg(tablename ORDER BY tablename),'[]') FROM pg_tables WHERE schemaname='public';";
const q = name => { if (!/^[a-z_][a-z0-9_]*$/u.test(name)) fail("COPY_IDENTIFIER_INVALID"); return `"${name}"`; };
const lit = value => `'${value.replaceAll("'", "''")}'`;

export const VERIFY_FOREIGN_KEYS = `
DO $verify$
DECLARE r record; predicate text; nonnull text; broken boolean;
BEGIN
 FOR r IN SELECT * FROM pg_constraint WHERE contype='f' AND connamespace='public'::regnamespace LOOP
  SELECT string_agg(format('s.%I = t.%I',a.attname,b.attname),' AND ' ORDER BY x.n),
         string_agg(format('s.%I IS NOT NULL',a.attname),' AND ' ORDER BY x.n)
    INTO predicate,nonnull
    FROM unnest(r.conkey,r.confkey) WITH ORDINALITY x(src,dst,n)
    JOIN pg_attribute a ON a.attrelid=r.conrelid AND a.attnum=x.src
    JOIN pg_attribute b ON b.attrelid=r.confrelid AND b.attnum=x.dst;
  IF r.confmatchtype <> 's' THEN RAISE EXCEPTION 'PREVIEW_UNSUPPORTED_FOREIGN_KEY_MATCH'; END IF;
  EXECUTE format('SELECT EXISTS (SELECT 1 FROM %s s WHERE %s AND NOT EXISTS (SELECT 1 FROM %s t WHERE %s))',r.conrelid::regclass,nonnull,r.confrelid::regclass,predicate) INTO broken;
  IF broken THEN RAISE EXCEPTION 'PREVIEW_COPY_FOREIGN_KEY_MISMATCH'; END IF;
 END LOOP;
END $verify$;`;

// Single-purpose helper: source is a read-only restored snapshot, destination
// is a fresh volume. Copies only ledger-referenced, policy-eligible objects.
export const COPY_STORAGE_PROGRAM = `
const fs=require('node:fs'),p=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const input=JSON.parse(fs.readFileSync(0,'utf8'));
if(!Array.isArray(input))throw Error('INPUT');
let count=0,bytes=0;const hashes=[];
for(const item of input){
 if(typeof item!=='string'||!item.startsWith('stub/stub/')||item.split('/').some(x=>!x||x==='.'||x==='..')||/[\\\\\\x00-\\x1f]/.test(item))throw Error('PATH');
 let current='/source';
 for(const component of item.split('/')){current=p.join(current,component);if(fs.lstatSync(current).isSymbolicLink())throw Error('SYMLINK');}
 const target=p.join('/target',item);fs.mkdirSync(p.dirname(target),{recursive:true});
 if(fs.existsSync(target)||fs.statSync(current).size>52428800)throw Error('TARGET_OR_SIZE');
 // Storage file backend persists HTTP metadata in extended attributes.
 // Byte-only copies hash correctly but fail API reads with ENODATA.
 const copied=cp.spawnSync('cp',['--preserve=mode,timestamps,xattr','--no-clobber','--',current,target],{stdio:'ignore',timeout:60000});
 if(copied.status!==0)throw Error('COPY_METADATA');
 const source=fs.readFileSync(current);
 if(!crypto.timingSafeEqual(crypto.createHash('sha256').update(source).digest(),crypto.createHash('sha256').update(fs.readFileSync(target)).digest()))throw Error('HASH');
 hashes.push(crypto.createHash('sha256').update(source).digest('hex'));count++;bytes+=source.length;
}
console.log(JSON.stringify({count,bytes,hashesVerified:true,hashes}));`;

export async function prepareCopy(directory, job) {
  await assertPrivatePath(job, true);
  // BuildKit's cached base layer is not necessarily an engine image. Fail
  // before any restore if the pinned copy helper has not been pulled.
  const helperImage = JSON.parse((await run("docker", ["image", "inspect", "node:24.18.1-bookworm-slim@sha256:235600a8101ab264e117b1768e925532262668dc9b581ef1dd7d96ced463b8e7"])).stdout)[0].Id;
  const pair = await loadPair(directory);
  const production = await assertIdentity(directory, "production");
  const preview = await assertIdentity(directory, "preview");
  if (production.systemId === preview.systemId) fail("COPY_SOURCE_TARGET_IDENTICAL");
  const productionBase = path.join(directory, "production");
  const context = await loadOperationsContext({ dataEnvFile: path.join(productionBase, "data.env"), operationsEnvFile: path.join(productionBase, "operations.env") });
  if (context.projectName !== pair.production.project) fail("COPY_SOURCE_PROJECT_MISMATCH");
  const releaseLock = await acquireOperationsLock(context.stateDirectory);
  let drill;
  let drillArgs;
  let stage = "restore";
  const candidate = path.join(job, "candidate");
  try {
    // Reading an existing paired backup does not pause or mutate live Prod.
    // Backup creation is an explicit separate operation with its own window.
    drill = await performRestoreDrill(context, createProcessRunner({ cwd: root, environment: { PATH: process.env.PATH, HOME: process.env.HOME } }), { removeContainer: false });
    drillArgs = composeArguments(context, { projectName: drill.isolatedProject });
    await run("docker", [...drillArgs, "start", "restore-drill-db"]);
    // psql connection readiness, bounded independently of test retries.
    await run("docker", [...drillArgs, "exec", "-T", "restore-drill-db", "sh", "-ec", "for n in 1 2 3 4 5 6 7 8 9 10; do pg_isready -U supabase_admin -d postgres >/dev/null && exit 0; sleep 1; done; exit 1"]);
    const sourceSql = sql => psql(drillArgs, sql, "restore-drill-db");
    const plan = await migrations();
    const ledger = JSON.parse(await sourceSql("SELECT json_agg(json_build_object('name',name,'checksum',checksum) ORDER BY name) FROM self_host.migration_ledger;"));
    validateSnapshotLedger(ledger, plan);
    const catalog = JSON.parse(await sourceSql(CATALOG_SQL));
    stage = "sanitize";
    // A new pair allocates new keys/volumes. Its Production entry is never
    // started or used: only the explicit preview role is a candidate target.
    await initializePair(candidate, { productionPort: pair.production.appPort, productionGatewayPort: pair.production.gatewayPort, previewPort: pair.preview.appPort + 100, previewGatewayPort: pair.preview.gatewayPort + 100 });
    const next = (await loadPair(candidate)).preview;
    stage = "candidate-init";
    await startData(candidate, "preview", { migrationPlan: plan.slice(0, ledger.length) });
    const args = pairComposeArgs(root, candidate, next);
    await run("docker", [...args, "stop", "rest", "storage", "gateway"]);
    const expectedCatalog = JSON.parse(await psql(args, CATALOG_SQL));
    if (JSON.stringify(expectedCatalog) !== JSON.stringify(catalog)) fail("COPY_SOURCE_CATALOG_DRIFT");
    stage = "sanitize";
    await sourceSql(buildSanitizationSql(catalog, { sourceStorageOrigin: pair.production.data.SUPABASE_URL, targetStorageOrigin: next.data.SUPABASE_URL }));
    const buckets = JSON.parse(await sourceSql("SELECT coalesce(json_agg(json_build_object('id',id,'name',name,'public',public)),'[]') FROM storage.buckets;"));
    stage = "storage-selection";
    if (buckets.some(isInvalidPreviewRequiredStorageBucket)) fail("COPY_PRIVATE_BUCKET_POLICY");
    const eligible = buckets.filter(shouldSyncPreviewStorageBucket).map(b => b.id);
    const selected = eligible.length ? eligible.map(lit).join(",") : "NULL";
    await sourceSql(`BEGIN; SET LOCAL session_replication_role=replica; DELETE FROM storage.objects WHERE ${eligible.length ? `bucket_id NOT IN (${selected})` : "true"}; DELETE FROM storage.buckets WHERE ${eligible.length ? `id NOT IN (${selected})` : "true"}; COMMIT;`);
    const objects = JSON.parse(await sourceSql("SELECT coalesce(json_agg(json_build_object('bucket_id',bucket_id,'name',name,'version',version)),'[]') FROM storage.objects;"));
    const files = objects.map(storageObjectPath);
    if (new Set(files).size !== files.length) fail("COPY_STORAGE_DUPLICATE");
    // Only sanitized public data and selected Storage metadata leave quarantine.
    const dump = (await run("docker", [...drillArgs, "exec", "-T", "--user", "postgres", "restore-drill-db", "pg_dump", "-U", "supabase_admin", "-d", "postgres", "--data-only", "--no-owner", "--no-acl", "--quote-all-identifiers", "--table=public.*", "--table=storage.buckets", "--table=storage.objects"], { timeout: 600_000 })).stdout;
    if (!dump.includes("COPY ")) fail("COPY_DUMP_EMPTY");
    // Initialize source schema, load its data, then apply the reviewed dev
    // suffix. A destructive dev migration cannot break source-format COPY.
    const tables = JSON.parse(await psql(args, TABLES_SQL));
    const deletes = [...tables.map(t => `DELETE FROM public.${q(t)};`), "DELETE FROM storage.objects;", "DELETE FROM storage.buckets;"].join("\n");
    stage = "candidate-import";
    // pg_dump restrict/unrestrict are trusted client guards, not transaction
    // control. Keep them intact; the matching pinned psql understands them.
    await psql(args, `BEGIN; SET LOCAL session_replication_role=replica;\n${deletes}\n${dump}\nSET LOCAL session_replication_role=origin;\n${VERIFY_FOREIGN_KEYS}\nCOMMIT;`);
    await psql(args, renderMigrationRunnerSql(plan));
    stage = "storage-copy";
    const copied = JSON.parse((await run("docker", ["run", "--rm", "-i", "--network", "none", "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges", "--memory", "256m", "--cpus", "0.5", "--mount", `type=volume,src=${drill.targetVolumes.storage},dst=/source,readonly`, "--mount", `type=volume,src=${next.project}_storage-data,dst=/target`, "--entrypoint", "node", helperImage, "-e", COPY_STORAGE_PROGRAM], { input: JSON.stringify(files), timeout: 600_000 })).stdout);
    if (copied.count !== files.length || !copied.hashesVerified) fail("COPY_STORAGE_VERIFY_FAILED");
    await run("docker", [...args, "up", "-d", "--no-build", "--wait", "--wait-timeout", "120", "rest", "storage", "gateway"]);
    stage = "final-verify";
    for (const [index, object] of objects.entries()) {
      const objectUrl = `${next.data.SUPABASE_URL}/storage/v1/object/${encodeURIComponent(object.bucket_id)}/${object.name.split("/").map(encodeURIComponent).join("/")}`;
      const response = await fetch(objectUrl, { headers: { apikey: next.data.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${next.data.SUPABASE_SERVICE_ROLE_KEY}` }, redirect: "error", signal: AbortSignal.timeout(60_000) });
      if (!response.ok) { await response.body?.cancel(); fail("COPY_STORAGE_API_FAILED"); }
      const hash = createHash("sha256");
      for await (const chunk of response.body) hash.update(chunk);
      if (hash.digest("hex") !== copied.hashes[index]) fail("COPY_STORAGE_API_HASH_MISMATCH");
    }
    delete copied.hashes; // no per-object identifiers/digests in public receipts
    copied.apiHashesVerified = true;
    // Original identities and data volumes remain untouched throughout.
    await assertIdentity(directory, "production");
    await assertIdentity(directory, "preview");
    const receipt = { version: 1, prepared: true, activated: false, sourceBackupId: drill.sourceBackupId, sourceStorageSnapshotId: drill.sourceStorageSnapshotId, snapshotTime: drill.target.time, candidate, candidateProject: next.project, storage: copied, migrations: plan.length, skippedPrivateBuckets: buckets.length - eligible.length, productionMutated: false, completedAt: new Date().toISOString() };
    await writeFile(path.join(job, "receipt.json"), JSON.stringify(receipt), { flag: "wx", mode: 0o600 });
    return receipt;
  } catch (error) {
    const diagnostic = String(error.diagnostic ?? "");
    const signatures = ["syntax error", "violates check constraint", "does not exist", "permission denied", "must be type", "foreign key", "connection", "invalid input", "not-null constraint"].filter(text => diagnostic.includes(text));
    const sqlState = diagnostic.match(/ERROR:\s+([0-9A-Z]{5})\b/u)?.[1] ?? null;
    await writeFile(path.join(job, "failure.json"), JSON.stringify({ version: 1, prepared: false, activated: false, stage, signatures, sqlState, existingPreviewPreserved: true, failedAt: new Date().toISOString() }), { flag: "wx", mode: 0o600 });
    throw error;
  } finally {
    try { if (drillArgs) await run("docker", [...drillArgs, "rm", "--force", "--stop", "restore-drill-db"]); }
    finally { await releaseLock(); }
  }
}
