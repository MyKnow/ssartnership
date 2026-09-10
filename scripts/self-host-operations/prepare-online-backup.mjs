// Explicit operator preparation: permit only a local replication connection by
// the same superuser already trusted on the database's private Unix socket.
import { readFile, writeFile, lstat, realpath } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const RULE = 'local replication supabase_admin trust';
export function addLocalBackupReplicationRule(input) {
  if (typeof input !== 'string' || input.includes('\0')) throw Error('BACKUP_HBA_INVALID');
  if (input.split(/\r?\n/u).some(line => line.trim().replace(/\s+/gu, ' ') === RULE)) return input;
  return `${input.trimEnd()}\n# Local online backup; no TCP replication access.\n${RULE}\n`;
}
export async function prepareOnlineBackup() {
  const check = v => { if (!v) throw Error('BACKUP_PREPARATION_FAILED'); };
  check(process.platform === 'linux' && process.getuid() === 0);
  const run = query => execFileSync('docker', ['exec', 'ssartnership-production-data-db-1', 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-h', '/tmp', '-U', 'supabase_admin', '-d', 'postgres', '-c', query], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 15000 }).trim();
  const configPath = '/etc/myknow/secrets/ssartnership-production/backup.json';
  const stat = await lstat(configPath); check(stat.uid === 0 && stat.isFile() && !stat.isSymbolicLink() && !(stat.mode & 0o077));
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  check(run('SHOW hba_file') === '/data/pg_hba.conf');
  check(run('SELECT system_identifier::text FROM pg_control_system()') === config.databaseSystemId);
  const file = `${config.source}/data/pg_hba.conf`;
  check(file.startsWith('/opt/ssartnership/') && await realpath(file) === file);
  const before = await readFile(file, 'utf8'), after = addLocalBackupReplicationRule(before);
  if (before !== after) {
    // Keep operator-owned rollback files outside PGDATA: the online backup
    // server must be able to read every regular file inside PGDATA.
    await writeFile(`${config.source}/pg_hba.before-online-backup-20260910`, before, { mode: 0o600, flag: 'wx' });
    // Preserve existing inode/ownership; on reload failure restore exact bytes.
    await writeFile(file, after);
    try {
      check(run('SELECT pg_reload_conf()') === 't');
      check(run("SELECT count(*) FROM pg_hba_file_rules WHERE error IS NOT NULL") === '0');
    } catch (error) { await writeFile(file, before); run('SELECT pg_reload_conf()'); throw error; }
  }
  console.log(JSON.stringify({ localBackupReplicationPrepared: true, databaseRestarted: false, tcpReplicationAdded: false }));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await prepareOnlineBackup(); } catch { console.error('{"error":"BACKUP_PREPARATION_FAILED"}'); process.exitCode = 1; }
}
