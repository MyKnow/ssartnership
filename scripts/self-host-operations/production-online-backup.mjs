#!/usr/bin/env node
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readFile, writeFile, lstat, realpath, readdir, copyFile, statfs, chown } from 'node:fs/promises';
import { execFileSync, spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { backupApplicationIdentity } from './production-backup-contract.mjs';
import { publishProductionBackup } from './production-cold-backup.mjs';

const ROOT = '/srv/backups/ssartnership-production';
const DB = 'ssartnership-production-data-db-1';
const APP = 'ssartnership-production-app-1';
const IMAGE = /^sha256:[a-f0-9]{64}$/u;
let backupPhase = 'preflight';
const ensure = value => { if (!value) throw new Error('PRODUCTION_ONLINE_BACKUP_CHECK_FAILED'); };
const run = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 180000, maxBuffer: 64 * 1024 ** 2 });
const ident = value => '"' + value.replaceAll('"', '""') + '"';
const sql = (container, query) => run('docker', ['exec', container, 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-h', '/tmp', '-U', 'supabase_admin', '-d', 'postgres', '-c', query]).trim();
const TABLES = "SELECT coalesce(json_agg(json_build_object('schema',n.nspname,'name',c.relname) ORDER BY n.nspname,c.relname),'[]') FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind IN ('r','p') AND n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema'";

export function onlineBaseBackupArguments(container) {
  ensure(/^[a-z0-9][a-z0-9-]{1,100}$/u.test(container));
  // fetch includes the required WAL in this single tar stream. Missing recycled
  // WAL fails the command; no success receipt is published for an unusable base.
  return ['exec', '--user', '100:101', container, 'pg_basebackup', '-h', '/tmp', '-U', 'supabase_admin', '--no-password', '--format=tar', '--gzip', '--wal-method=fetch', '--checkpoint=fast', '--pgdata=-'];
}

async function privateFile(file) {
  const s = await lstat(file);
  ensure(s.isFile() && !s.isSymbolicLink() && s.uid === 0 && !(s.mode & 0o077));
  return readFile(file, 'utf8');
}
async function sha256(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

export function storageVersionPath(object) {
  const segment = value => typeof value === 'string' && value.length > 0 && value.length <= 1024 && value !== '.' && value !== '..' && !/[\\/\x00-\x1f\x7f]/u.test(value);
  ensure(segment(object?.bucket_id) && typeof object?.name === 'string' && object.name.split('/').every(segment)
    && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(object.version)
    && Number.isSafeInteger(object?.metadata?.size) && object.metadata.size >= 0);
  return `stub/stub/${object.bucket_id}/${object.name}/${object.version}`;
}

// A private, independent copy: never hard-link mutable live files into a backup.
// Each pass is strict. A disappearing/changed file aborts rather than hiding a
// race. Saved versions survive a later live deletion; new versions are copied
// after the database recovery point has been established.
export async function copyVersionFiles(source, destination, prefix = '') {
  ensure(await realpath(source) === source && await realpath(destination) === destination);
  for (const name of (await readdir(path.join(source, prefix))).sort()) {
    const relative = path.join(prefix, name), from = path.join(source, relative), to = path.join(destination, relative);
    const before = await lstat(from);
    ensure(!before.isSymbolicLink());
    if (before.isDirectory()) {
      await mkdir(to, { recursive: true, mode: 0o700 });
      await copyVersionFiles(source, destination, relative);
    } else {
      ensure(before.isFile());
      // Keep the captured old version if its live path is later removed.
      // Reusing a version path with different bytes is an unsupported mutation.
      let existing;
      try { existing = await lstat(to); } catch (error) { if (error.code !== 'ENOENT') throw error; }
      if (existing) ensure(existing.isFile() && !existing.isSymbolicLink() && await sha256(from) === await sha256(to));
      else run('cp', ['--archive', '--reflink=auto', '--', from, to]);
      const after = await lstat(from);
      ensure(before.ino === after.ino && before.size === after.size && before.mtimeMs === after.mtimeMs
        && await sha256(from) === await sha256(to));
    }
  }
}

export async function verifyReferencedStorage(directory, objects) {
  ensure(Array.isArray(objects));
  const seen = new Set();
  for (const object of objects) {
    const relative = storageVersionPath(object);
    ensure(!seen.has(relative)); seen.add(relative);
    const full = path.join(directory, relative);
    ensure(await realpath(full) === full);
    const s = await lstat(full);
    ensure(s.isFile() && !s.isSymbolicLink() && s.size === object.metadata.size);
  }
  return seen.size;
}

async function inventory(root, prefix = '') {
  const result = [];
  for (const name of (await readdir(path.join(root, prefix))).sort()) {
    const relative = path.join(prefix, name), full = path.join(root, relative), s = await lstat(full);
    ensure(!s.isSymbolicLink());
    if (s.isDirectory()) result.push(...await inventory(root, relative));
    else { ensure(s.isFile()); result.push({ path: relative, bytes: s.size, sha256: await sha256(full) }); }
  }
  return result;
}

async function streamBaseBackup(container, output) {
  const child = spawn('docker', onlineBaseBackupArguments(container), { stdio: ['ignore', 'pipe', 'pipe'] });
  let stderrBytes = 0, diagnostic = '';
  child.stderr.on('data', chunk => { stderrBytes += chunk.length; if (diagnostic.length < 8192) diagnostic += chunk.toString(); });
  const done = new Promise((resolve, reject) => {
    child.once('error', () => reject(new Error('ONLINE_BASEBACKUP_PROCESS_FAILED')));
    child.once('close', code => code === 0 && stderrBytes === 0 ? resolve() : reject(new Error('ONLINE_BASEBACKUP_FAILED')));
  });
  const timer = setTimeout(() => child.kill('SIGKILL'), 10 * 60_000);
  const copy = pipeline(child.stdout, createWriteStream(output, { flags: 'wx', mode: 0o600 }));
  try { await Promise.all([done, copy]); }
  catch {
    child.kill('SIGKILL'); await Promise.allSettled([done, copy]);
    const reason = /no pg_hba.conf entry/u.test(diagnostic) ? 'hba' : /Permission denied/u.test(diagnostic) ? 'file-permissions' : /WAL segment.*removed/u.test(diagnostic) ? 'wal-retention' : 'process';
    backupPhase = `basebackup-${reason}`;
    throw new Error('ONLINE_BASEBACKUP_FAILED');
  }
  finally { clearTimeout(timer); }
}

/** Internal boundary for synthetic Docker drills; the Production CLI uses fixed identities. */
export async function captureOnlinePair({ source, stage, container = DB, image, databaseSystemId, afterBaseBackup = async () => {} }) {
  ensure(process.platform === 'linux' && IMAGE.test(image) && /^[1-9][0-9]{0,19}$/u.test(databaseSystemId));
  ensure(path.isAbsolute(stage) && await realpath(stage) === stage && (await readdir(stage)).length === 0);
  const startedAt = new Date().toISOString();
  const original = JSON.parse(run('docker', ['inspect', container]))[0];
  ensure(original.State.Running && original.Image === image
    && original.Mounts.some(m => m.Source === path.join(source, 'data') && m.Destination === '/data'));
  ensure(sql(container, 'SELECT system_identifier::text FROM pg_control_system()') === databaseSystemId);
  ensure(sql(container, "SELECT count(*) FROM pg_tablespace WHERE spcname NOT IN ('pg_default','pg_global')") === '0');
  ensure(sql(container, "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relpersistence='u' AND n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema'") === '0');
  const data = path.join(stage, 'data'), storage = path.join(stage, 'storage');
  await mkdir(data, { mode: 0o700 }); await mkdir(storage, { mode: 0o700 });
  backupPhase = 'storage-before';
  await copyVersionFiles(path.join(source, 'storage'), storage);
  const base = path.join(stage, 'base.tar.gz');
  backupPhase = 'basebackup';
  await streamBaseBackup(container, base);
  await afterBaseBackup();
  backupPhase = 'storage-after';
  await copyVersionFiles(path.join(source, 'storage'), storage);
  // No external tablespaces or filesystem links may escape the private clone.
  backupPhase = 'extract';
  const names = run('tar', ['--list', '--gzip', '--file', base]).trim().split('\n');
  const kinds = run('tar', ['--list', '--verbose', '--gzip', '--file', base]).trim().split('\n');
  ensure(names.length === kinds.length && names.every(n => !n.startsWith('/') && !n.split('/').includes('..')) && kinds.every(n => /^[-d]/u.test(n)));
  run('tar', ['--extract', '--gzip', '--numeric-owner', '--file', base, '--directory', data]);
  // pg_basebackup archives its children, not the destination directory owner.
  await chown(data, 100, 101);
  await chown(path.join(data, 'backup_manifest'), 100, 101);
  const clone = `ssartnership-online-drill-${randomUUID()}`;
  const isolation = ['--network', 'none', '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--user', '100:101', '--memory', '1g', '--cpus', '1', '--pids-limit', '128', '--tmpfs', '/tmp:mode=1777,size=64m', '--mount', `type=bind,src=${data},dst=/data`];
  let created = false;
  try {
    backupPhase = 'verify-basebackup';
    run('docker', ['run', '--rm', ...isolation, '--entrypoint', 'pg_verifybackup', image, '/data']);
    backupPhase = 'start-clone';
    run('docker', ['run', '-d', '--name', clone, ...isolation, '--entrypoint', 'postgres', image, '-D', '/data', '-c', 'listen_addresses=', '-c', 'unix_socket_directories=/tmp', '-c', 'archive_mode=off', '-c', 'archive_command=', '-c', 'shared_preload_libraries=', '-c', 'log_statement=none', '-c', 'log_min_error_statement=panic', '-c', 'log_error_verbosity=terse', '-c', 'log_parameter_max_length_on_error=0']);
    created = true;
    const deadline = Date.now() + 30000;
    for (;;) { try { sql(clone, 'SELECT 1'); break; } catch { ensure(Date.now() < deadline); await new Promise(resolve => setTimeout(resolve, 500)); } }
    ensure(sql(clone, 'SELECT system_identifier::text FROM pg_control_system()') === databaseSystemId);
    backupPhase = 'verify-storage-references';
    const objects = JSON.parse(sql(clone, "SELECT coalesce(json_agg(json_build_object('bucket_id',bucket_id,'name',name,'version',version,'metadata',metadata)),'[]') FROM storage.objects"));
    const referencedFiles = await verifyReferencedStorage(storage, objects);
    backupPhase = 'table-comparison';
    const tables = JSON.parse(sql(clone, TABLES));
    for (const table of tables) Object.assign(table, JSON.parse(sql(clone, `SELECT json_build_object('rows',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(j,E'\\n' ORDER BY j COLLATE "C"),''),'UTF8')),'hex')) FROM (SELECT to_jsonb(t)::text j FROM ${ident(table.schema)}.${ident(table.name)} t) q`)));
    backupPhase = 'archive-clone';
    run('docker', ['stop', '--time', '30', clone]);
    ensure(JSON.parse(run('docker', ['inspect', clone]))[0].State.ExitCode === 0);
    // This stops only the isolated clone, never the running source services.
    run('tar', ['--create', '--gzip', '--numeric-owner', '--file', path.join(stage, 'database.tar.gz'), '--directory', stage, 'data']);
    run('tar', ['--create', '--xattrs', '--acls', '--numeric-owner', '--file', path.join(stage, 'storage.tar'), '--directory', stage, 'storage']);
    const current = JSON.parse(run('docker', ['inspect', container]))[0];
    ensure(current.Id === original.Id && current.State.Running && current.State.StartedAt === original.State.StartedAt);
    return { version: 1, kind: 'production-online-snapshot', capturedAt: startedAt, databaseImage: image, databaseSystemId, tables, storage: await inventory(storage), applicationWritesQuiesced: false, databaseCleanlyStopped: true, sourceRemainedRunning: true, onlineBaseBackupVerified: true, storageReferencesVerified: referencedFiles, continuousPitr: false };
  } finally {
    if (created) { run('docker', ['stop', '--time', '30', clone]); run('docker', ['rm', clone]); }
  }
}

export async function captureProductionOnlineBackup() {
  ensure(process.platform === 'linux' && process.getuid?.() === 0); process.umask(0o077);
  const config = JSON.parse(await privateFile('/etc/myknow/secrets/ssartnership-production/backup.json'));
  ensure(Object.keys(config).sort().join() === 'databaseSystemId,exportGroupId,recipient,source'
    && /^age1[023456789acdefghjklmnpqrstuvwxyz]{58}$/u.test(config.recipient)
    && /^\/opt\/ssartnership\/[A-Za-z0-9._/-]+$/u.test(config.source) && !config.source.split('/').includes('..')
    && await realpath(config.source) === config.source && Number.isSafeInteger(config.exportGroupId) && config.exportGroupId > 0);
  ensure(await realpath(ROOT) === ROOT);
  const rootStat = await lstat(ROOT); ensure(rootStat.uid === 0 && rootStat.gid === 0 && !(rootStat.mode & 0o077));
  const free = await statfs(ROOT); ensure(Number(free.bavail) * Number(free.bsize) > 10 * 1024 ** 3);
  const id = randomUUID(), stage = `${ROOT}/${id}.partial`;
  const app = JSON.parse(run('docker', ['inspect', APP]))[0];
  const application = backupApplicationIdentity(app, JSON.parse(run('docker', ['image', 'inspect', app.Image]))[0]);
  const image = JSON.parse(run('docker', ['inspect', DB]))[0].Image;
  await mkdir(stage, { mode: 0o700 });
  const manifest = await captureOnlinePair({ source: config.source, stage, image, databaseSystemId: config.databaseSystemId });
  const currentApp = JSON.parse(run('docker', ['inspect', APP]))[0];
  ensure(currentApp.Id === app.Id && currentApp.State.Running && currentApp.State.StartedAt === app.State.StartedAt);
  backupPhase = 'private-config';
  for (const name of ['data.env', 'compose.json']) { await privateFile(`${config.source}/${name}`); await copyFile(`${config.source}/${name}`, `${stage}/${name}`); }
  await privateFile('/etc/myknow/secrets/ssartnership-production/app.env');
  await copyFile('/etc/myknow/secrets/ssartnership-production/app.env', `${stage}/app.env`);
  await writeFile(`${stage}/manifest.json`, JSON.stringify({ ...manifest, id, application }), { mode: 0o600, flag: 'wx' });
  backupPhase = 'publish';
  await publishProductionBackup(stage, config, id);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { ensure(process.argv.length === 3 && process.argv[2] === 'capture'); await captureProductionOnlineBackup(); }
  catch { console.error(JSON.stringify({ error: 'PRODUCTION_ONLINE_BACKUP_FAILED', phase: backupPhase })); process.exitCode = 1; }
}
