// Explicit Linux/Docker integration drill. Synthetic data only; no live config.
import { execFileSync, spawn } from 'node:child_process';
import { mkdir, writeFile, readFile, rm, unlink, chown, lstat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { captureOnlinePair, storageVersionPath } from '../../scripts/self-host-operations/production-online-backup.mjs';

const run = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 4 * 1024 ** 2, timeout: 180000 });
const check = value => { if (!value) throw Error('ONLINE_DRILL_CHECK_FAILED'); };
const image = process.argv[2];
check(process.platform === 'linux' && process.getuid() === 0 && /^sha256:[a-f0-9]{64}$/u.test(image));
const id = randomUUID(), root = `/srv/backups/ssartnership-production/online-synthetic-${id}`, container = `ssartnership-online-source-${id}`;
const query = q => run('docker', ['exec', container, 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-h', '/tmp', '-U', 'supabase_admin', '-d', 'postgres', '-c', q]).trim();
let created = false, writer;
try {
  await mkdir(root, { mode: 0o700 });
  await mkdir(`${root}/source`, { mode: 0o700 }); await mkdir(`${root}/stage`, { mode: 0o700 });
  await mkdir(`${root}/source/data`, { mode: 0o700 }); await chown(`${root}/source/data`, 100, 101);
  const mount = `type=bind,src=${root}/source/data,dst=/data`;
  run('docker', ['run', '--rm', '--network', 'none', '--user', '100:101', '--mount', mount, '--entrypoint', 'initdb', image, '-D', '/data', '-U', 'supabase_admin', '--auth=trust']);
  run('docker', ['run', '-d', '--name', container, '--network', 'none', '--user', '100:101', '--memory', '512m', '--cpus', '1', '--mount', mount, '--tmpfs', '/tmp:mode=1777', '--entrypoint', 'postgres', image, '-D', '/data', '-c', 'listen_addresses=', '-c', 'unix_socket_directories=/tmp', '-c', 'shared_preload_libraries=']); created = true;
  const deadline = Date.now() + 30000;
  for (;;) { try { query('SELECT 1'); break; } catch { check(Date.now() < deadline); await new Promise(r => setTimeout(r, 300)); } }
  query("CREATE SCHEMA storage; CREATE TABLE storage.objects(bucket_id text,name text,version text,metadata jsonb); CREATE TABLE public.online_marker(id text PRIMARY KEY); INSERT INTO public.online_marker VALUES ('before'); CREATE TABLE public.backup_load AS SELECT n,repeat(md5(n::text),20) AS data FROM generate_series(1,20000) n;");
  const object = { bucket_id: 'images', name: 'fixture.txt', version: '12345678-1234-4234-8234-123456789abc', metadata: { size: 3 } };
  await mkdir(`${root}/source/storage/stub/stub/images/fixture.txt`, { recursive: true, mode: 0o700 });
  const old = `${root}/source/storage/${storageVersionPath(object)}`;
  await writeFile(old, 'old');
  query(`INSERT INTO storage.objects VALUES ('images','fixture.txt','${object.version}','{"size":3}');`);
  // Keep SQL writes in an independent process: synchronous timer callbacks can
  // stall the parent's base-backup output pipe and create a false deadlock.
  const writes = 20;
  writer = spawn('docker', ['exec', '-i', container, 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-h', '/tmp', '-U', 'supabase_admin', '-d', 'postgres'], { stdio: ['pipe', 'ignore', 'pipe'] });
  let writerErrors = 0;
  writer.stderr.on('data', b => { writerErrors += b.length; });
  const writerDone = new Promise((resolve, reject) => { writer.once('error', reject); writer.once('close', code => code === 0 && writerErrors === 0 ? resolve() : reject(Error('SYNTHETIC_WRITER_FAILED'))); });
  writerDone.catch(() => {});
  writer.stdin.end(Array.from({ length: writes }, (_, i) => `INSERT INTO public.online_marker VALUES ('during-${i}');\nSELECT pg_sleep(0.1);\n`).join(''));
  const manifest = await captureOnlinePair({ source: `${root}/source`, stage: `${root}/stage`, container, image,
    databaseSystemId: query('SELECT system_identifier::text FROM pg_control_system()'),
    afterBaseBackup: async () => {
      await writerDone;
      query("INSERT INTO public.online_marker VALUES ('after'); DELETE FROM storage.objects;");
      await unlink(old);
      await writeFile(`${root}/source/storage/stub/stub/images/fixture.txt/22345678-1234-4234-8234-123456789abc`, 'new');
    },
  });
  check(writes > 0 && manifest.sourceRemainedRunning && manifest.storageReferencesVerified === 1);
  check(await readFile(`${root}/stage/storage/${storageVersionPath(object)}`, 'utf8') === 'old');
  const marker = manifest.tables.find(t => t.schema === 'public' && t.name === 'online_marker');
  check(marker.rows >= 1 && marker.rows < Number(query('SELECT count(*) FROM public.online_marker')));
  check(manifest.tables.find(t => t.schema === 'storage' && t.name === 'objects').rows === 1);
  console.log(JSON.stringify({ syntheticOnlineBackup: true, sourceUninterrupted: true, concurrentWrites: writes, snapshotExcludesLaterWrites: true, deletedVersionRetained: true, pgVerifyBackupPassed: true, isolatedRecoveryPassed: true }));
} catch (error) {
  for (const relative of ['stage/data', 'stage/data/backup_manifest', 'stage/data/PG_VERSION']) {
    try { const s = await lstat(`${root}/${relative}`); console.error(JSON.stringify({ syntheticPath: relative, uid: s.uid, gid: s.gid, mode: s.mode & 0o777 })); } catch { /* May fail before extraction. */ }
  }
  throw error;
} finally {
  if (writer?.exitCode === null) writer.kill('SIGKILL');
  if (created) { run('docker', ['stop', '--time', '30', container]); run('docker', ['rm', container]); }
  await rm(root, { recursive: true, force: true });
}
