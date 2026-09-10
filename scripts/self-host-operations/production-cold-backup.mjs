#!/usr/bin/env node
// Production-only operator: ciphertext export is served by a separate unprivileged account.
import { createReadStream, createWriteStream } from 'node:fs';
import { readFile, writeFile, mkdir, lstat, realpath, readdir, rename, copyFile, rm, chmod, chown, statfs } from 'node:fs/promises';
import { execFileSync, spawn } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { validateBackupReceipt, selectBackupRetention, backupApplicationIdentity } from './production-backup-contract.mjs';

const ROOT = '/srv/backups/ssartnership-production';
const CONFIG = '/etc/myknow/secrets/ssartnership-production/backup.json';
const INTENT = `${ROOT}/resume-intent.json`;
const DB = 'ssartnership-production-data-db-1';
const WRITERS = ['ssartnership-production-app-1', 'ssartnership-production-data-gateway-1', 'ssartnership-production-data-rest-1', 'ssartnership-production-data-storage-1'];
const run = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 180000, maxBuffer: 16 * 1024 ** 2, env: { PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin' } });
const ensure = value => { if (!value) throw Error('PRODUCTION_BACKUP_CHECK_FAILED'); };
async function privateFile(file) {
  const info = await lstat(file);
  ensure(info.isFile() && !info.isSymbolicLink() && info.uid === 0 && !(info.mode & 0o077));
  return readFile(file, 'utf8');
}
async function saveIntent(value) {
  await writeFile(`${INTENT}.new`, JSON.stringify(value), { mode: 0o600 });
  await rename(`${INTENT}.new`, INTENT);
}
export async function resumeProductionBackup() {
  ensure(process.getuid?.() === 0);
  let state;
  try { state = JSON.parse(await privateFile(INTENT)); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
  ensure(Object.keys(state).sort().join() === 'database,writers' && typeof state.database === 'boolean'
    && Array.isArray(state.writers) && new Set(state.writers).size === state.writers.length && state.writers.every(x => WRITERS.includes(x)));
  if (state.database) {
    run('docker', ['start', DB]);
    run('docker', ['exec', DB, 'sh', '-ec', 'for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30; do pg_isready -h /tmp -U supabase_admin -d postgres >/dev/null && exit 0; sleep 1; done; exit 1']);
  }
  for (const name of [...WRITERS].reverse().filter(x => state.writers.includes(x))) run('docker', ['start', name]);
  await saveIntent({ database: false, writers: [] });
}
async function hashFile(file) {
  const hash = createHash('sha256');
  for await (const bytes of createReadStream(file)) hash.update(bytes);
  return hash.digest('hex');
}
async function inventory(root, prefix = '') {
  const result = [];
  for (const name of (await readdir(path.join(root, prefix))).sort()) {
    const relative = path.join(prefix, name), file = path.join(root, relative), info = await lstat(file);
    ensure(!info.isSymbolicLink());
    if (info.isDirectory()) result.push(...await inventory(root, relative));
    else { ensure(info.isFile()); result.push({ path: relative, bytes: info.size, sha256: await hashFile(file) }); }
  }
  return result;
}
export async function encryptBundle(directory, recipient, output) {
  const tar = spawn('tar', ['--create', '--format=ustar', '--file=-', '--directory', directory, 'database.tar.gz', 'storage.tar', 'data.env', 'compose.json', 'app.env', 'manifest.json'], { stdio: ['ignore', 'pipe', 'pipe'] });
  const age = spawn('/opt/ssartnership/age-v1.3.2/age', ['--encrypt', '--recipient', recipient], { stdio: ['pipe', 'pipe', 'pipe'] });
  const done = child => new Promise(resolve => { child.once('error', () => resolve(-1)); child.once('close', resolve); });
  const exited = [done(tar), done(age)]; tar.stderr.resume(); age.stderr.resume();
  const timer = setTimeout(() => { tar.kill('SIGTERM'); age.kill('SIGTERM'); }, 180000);
  try {
    await Promise.all([pipeline(tar.stdout, age.stdin), pipeline(age.stdout, createWriteStream(output, { mode: 0o600, flags: 'wx' }))]);
    ensure((await Promise.all(exited)).every(code => code === 0));
  } finally { clearTimeout(timer); if (tar.exitCode === null) tar.kill('SIGTERM'); if (age.exitCode === null) age.kill('SIGTERM'); }
}
async function capture() {
  ensure(process.platform === 'linux' && process.getuid?.() === 0); process.umask(0o077);
  const config = JSON.parse(await privateFile(CONFIG));
  ensure(Object.keys(config).sort().join() === 'databaseSystemId,exportGroupId,recipient,source'
    && /^age1[023456789acdefghjklmnpqrstuvwxyz]{58}$/u.test(config.recipient)
    && /^\/opt\/ssartnership\/production-migration-[a-f0-9]{12}-[0-9]+\/service-candidate$/u.test(config.source)
    && Number.isInteger(config.exportGroupId) && config.exportGroupId > 0 && /^[1-9][0-9]{0,19}$/u.test(config.databaseSystemId));
  await mkdir(ROOT, { recursive: true, mode: 0o700 });
  ensure(await realpath(ROOT) === ROOT && await realpath(config.source) === config.source);
  ensure((await lstat(ROOT)).uid === 0 && (await lstat(ROOT)).gid === 0 && ((await lstat(ROOT)).mode & 0o077) === 0);
  await resumeProductionBackup();
  const disk = await statfs(ROOT); ensure(disk.bavail * disk.bsize > 4 * 1024 ** 3);
  const current = JSON.parse(run('docker', ['inspect', DB]))[0];
  ensure(current.State.Running && current.State.Health.Status === 'healthy' && current.Mounts.some(m => m.Source === `${config.source}/data` && m.Destination === '/data')
    && current.Config.Labels['com.docker.compose.project'] === 'ssartnership-production-data');
  const sql = query => run('docker', ['exec', DB, 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-h', '/tmp', '-U', 'supabase_admin', '-d', 'postgres', '-c', query]).trim();
  ensure(sql('SELECT system_identifier::text FROM pg_control_system()') === config.databaseSystemId);
  ensure(sql("SELECT count(*) FROM pg_tablespace WHERE spcname NOT IN ('pg_default','pg_global')") === '0');
  const app = JSON.parse(run('docker', ['inspect', 'ssartnership-production-app-1']))[0];
  const application = backupApplicationIdentity(app, JSON.parse(run('docker', ['image', 'inspect', app.Image]))[0]);
  const id = randomUUID(), temporary = `${ROOT}/${id}.partial`;
  await mkdir(temporary, { mode: 0o700 });
  const selected = JSON.parse(run('docker', ['inspect', ...WRITERS])).filter(c => c.State.Running).map(c => c.Name.slice(1));
  await saveIntent({ database: false, writers: selected });
  try {
    if (selected.length) run('docker', ['stop', '--timeout', '30', ...selected]);
    const tables = JSON.parse(sql("SELECT coalesce(json_agg(json_build_object('schema',n.nspname,'name',c.relname) ORDER BY n.nspname,c.relname),'[]') FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind IN ('r','p') AND n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema'"));
    const ident = value => '"' + value.replaceAll('"', '""') + '"';
    for (const table of tables) Object.assign(table, JSON.parse(sql(`SELECT json_build_object('rows',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(j,E'\\n' ORDER BY j COLLATE "C"),''),'UTF8')),'hex')) FROM (SELECT to_jsonb(t)::text j FROM ${ident(table.schema)}.${ident(table.name)} t) q`)));
    await saveIntent({ database: true, writers: selected });
    run('docker', ['stop', '--timeout', '30', DB]);
    const stopped = JSON.parse(run('docker', ['inspect', DB]))[0]; ensure(!stopped.State.Running && stopped.State.ExitCode === 0);
    run('tar', ['--create', '--gzip', '--numeric-owner', '--file', `${temporary}/database.tar.gz`, '--directory', config.source, 'data']);
    const storage = await inventory(`${config.source}/storage`);
    run('tar', ['--create', '--xattrs', '--acls', '--numeric-owner', '--file', `${temporary}/storage.tar`, '--directory', config.source, 'storage']);
    ensure(JSON.stringify(await inventory(`${config.source}/storage`)) === JSON.stringify(storage));
    for (const name of ['data.env', 'compose.json']) { await privateFile(`${config.source}/${name}`); await copyFile(`${config.source}/${name}`, `${temporary}/${name}`); }
    const appFile = '/etc/myknow/secrets/ssartnership-production/app.env'; await privateFile(appFile); await copyFile(appFile, `${temporary}/app.env`);
    await writeFile(`${temporary}/manifest.json`, JSON.stringify({ version: 1, kind: 'production-cold-snapshot', id, capturedAt: new Date().toISOString(), databaseImage: current.Image, databaseSystemId: config.databaseSystemId, application, tables, storage, applicationWritesQuiesced: true, databaseCleanlyStopped: true, continuousPitr: false }), { mode: 0o600, flag: 'wx' });
  } finally { await resumeProductionBackup(); }
  await publishProductionBackup(temporary, config, id);
}
export async function publishProductionBackup(temporary, config, id) {
  const outgoing = '/srv/ssartnership-backup-export';
  ensure(temporary === `${ROOT}/${id}.partial` && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(id));
  await encryptBundle(temporary, config.recipient, `${temporary}/snapshot.tar.age`);
  const info = await lstat(`${temporary}/snapshot.tar.age`);
  const capturedAt = JSON.parse(await readFile(`${temporary}/manifest.json`, 'utf8')).capturedAt;
  const receipt = validateBackupReceipt({ version: 1, id, createdAt: capturedAt, bytes: info.size, sha256: await hashFile(`${temporary}/snapshot.tar.age`), recipient: config.recipient, databaseSystemId: config.databaseSystemId, continuousPitr: false });
  await mkdir(outgoing, { recursive: true, mode: 0o750 }); await chown(outgoing, 0, config.exportGroupId); await chmod(outgoing, 0o750);
  // Only finished ciphertext and receipts cross into the unprivileged export directory.
  const final = `${ROOT}/${id}.publish`; await mkdir(final, { mode: 0o750 }); await chown(final, 0, config.exportGroupId); await chmod(final, 0o750);
  await rename(`${temporary}/snapshot.tar.age`, `${final}/snapshot.tar.age`); await chown(`${final}/snapshot.tar.age`, 0, config.exportGroupId); await chmod(`${final}/snapshot.tar.age`, 0o640);
  await writeFile(`${final}/receipt.json`, JSON.stringify(receipt), { mode: 0o640, flag: 'wx' }); await chown(`${final}/receipt.json`, 0, config.exportGroupId); await chmod(`${final}/receipt.json`, 0o640);
  await rename(final, `${outgoing}/${id}`);
  await rm(temporary, { recursive: true }); // Only this successful capture's private staging files.
  const receipts = [];
  for (const name of await readdir(outgoing)) {
    if (!/^[a-f0-9-]{36}$/u.test(name)) continue;
    receipts.push(validateBackupReceipt(JSON.parse(await readFile(`${outgoing}/${name}/receipt.json`, 'utf8'))));
  }
  for (const old of selectBackupRetention(receipts, 7)) await rm(`${outgoing}/${old}`, { recursive: true });
  console.log(JSON.stringify({ captured: true, ...receipt }));
}
if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
  try { if (process.argv[2] === 'resume') await resumeProductionBackup(); else if (process.argv[2] === 'capture') await capture(); else throw Error(); }
  catch { console.error('{"error":"PRODUCTION_BACKUP_FAILED"}'); process.exitCode = 1; }
}
